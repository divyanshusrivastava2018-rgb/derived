import { v4 as uuidv4 } from 'uuid';
import { loadWrtc, iceServersFromEnv } from '../lib/wrtc-loader.js';
import { log } from '../lib/logger.js';

function peerKey(roomId, userId) {
  return `${roomId}:${userId}`;
}

function extractSdp(sdp) {
  if (typeof sdp === 'string') return sdp;
  if (sdp && typeof sdp.sdp === 'string') return sdp.sdp;
  if (sdp && typeof sdp === 'object') return JSON.stringify(sdp);
  return '';
}

export class WebRTCSignaling {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.peerSockets = new Map();
    this.peerConnections = new Map();
    this.wrtcReady = loadWrtc();
  }

  async getWrtc() {
    return this.wrtcReady;
  }

  registerSocket(socket, { peerId, roomId, role }) {
    socket.data.peerId = peerId;
    socket.data.roomId = roomId;
    socket.data.role = role;
    this.peerSockets.set(peerId, socket.id);
    socket.join(roomId);
    void this.roomManager.joinRoom(roomId, peerId);
    socket.to(roomId).emit('peer-joined', { peerId });
    const peers = [...(this.roomManager.getRoom(roomId)?.peers || [])].filter((p) => p !== peerId);
    socket.emit('room-peers', peers);
  }

  connectionKey(socket, roomId, userId) {
    const uid = userId || socket.data.peerId || socket.id;
    return peerKey(roomId, uid);
  }

  relayToRoom(socket, roomId, event, payload) {
    socket.to(roomId).emit(event, payload);
  }

  async handleOffer(socket, roomId, sdp, userId, bitrateStrategy) {
    const peerId = userId || socket.data.peerId;
    const key = this.connectionKey(socket, roomId, peerId);
    const sdpText = extractSdp(sdp);

    const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, available } =
      await this.getWrtc();

    if (available && RTCPeerConnection && sdpText && process.env.WEBRTC_MODE !== 'relay') {
      try {
        await this.handleOfferServerSide(socket, {
          roomId,
          peerId,
          key,
          sdpText,
          bitrateStrategy,
          RTCPeerConnection,
          RTCSessionDescription,
          RTCIceCandidate,
        });
        return;
      } catch (error) {
        log.error(`WebRTC offer (server): ${error.message}`);
        socket.emit('webrtc-error', { error: error.message, roomId, peerId });
      }
    }

    this.relayOfferMesh(socket, roomId, peerId, sdp, bitrateStrategy);
  }

  async handleOfferServerSide(
    socket,
    { roomId, peerId, key, sdpText, bitrateStrategy, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate }
  ) {
    this.closePeerConnection(key);

    const peerConnection = new RTCPeerConnection({
      iceServers: iceServersFromEnv(),
      sdpSemantics: 'unified-plan',
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit('ice-candidate', {
        roomId,
        candidate: event.candidate,
        fromPeerId: peerId,
      });
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'failed') {
        socket.emit('webrtc-error', { error: 'connection_failed', roomId, peerId });
      }
    };

    await this.applyBitrateConstraints(peerConnection, bitrateStrategy);

    this.peerConnections.set(key, {
      pc: peerConnection,
      socketId: socket.id,
      roomId,
      peerId,
      bitrateStrategy,
      sessionId: uuidv4(),
    });

    const offerDesc = new RTCSessionDescription({ type: 'offer', sdp: sdpText });
    await peerConnection.setRemoteDescription(offerDesc);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    const localSdp =
      typeof peerConnection.localDescription === 'object'
        ? peerConnection.localDescription.sdp
        : peerConnection.localDescription;

    socket.emit('webrtc-answer', {
      sdp: localSdp,
      type: 'answer',
      roomId,
      userId: peerId,
    });

    socket.emit('bitrate-strategy', bitrateStrategy);

    this.relayToRoom(socket, roomId, 'webrtc-offer', {
      fromPeerId: peerId,
      sdp: sdpText,
      bitrateStrategy,
      serverRelay: true,
    });
  }

  relayOfferMesh(socket, roomId, peerId, sdp, bitrateStrategy) {
    this.relayToRoom(socket, roomId, 'webrtc-offer', {
      fromPeerId: peerId,
      sdp,
      bitrateStrategy,
    });
    this.relayToRoom(socket, roomId, 'signal', {
      fromPeerId: peerId,
      payload: { type: 'offer', sdp },
    });
    socket.emit('bitrate-strategy', bitrateStrategy);
  }

  async applyBitrateConstraints(peerConnection, strategy) {
    const maxKbps = strategy?.maxBitrate ?? 1500;
    const maxBitrate = maxKbps * 1000;
    const minBitrate = (strategy?.minBitrate ?? Math.floor(maxKbps * 0.25)) * 1000;
    const frameRate = strategy?.frameRate ?? 30;

    const transceiver = peerConnection.addTransceiver('video', {
      direction: 'recvonly',
    });
    const sender = transceiver.sender;
    if (!sender?.getParameters) return transceiver;

    const parameters = sender.getParameters();
    parameters.encodings = [
      {
        maxBitrate,
        minBitrate,
        maxFramerate: frameRate,
        scaleResolutionDownBy: 1,
        active: true,
      },
    ];
    await sender.setParameters(parameters);
    return transceiver;
  }

  async handleAnswer(socket, roomId, sdp) {
    const key = this.connectionKey(socket, roomId, socket.data.peerId);
    const connection = this.peerConnections.get(key);
    const sdpText = extractSdp(sdp);

    if (connection?.pc && sdpText) {
      try {
        const { RTCSessionDescription } = await this.getWrtc();
        const desc = RTCSessionDescription
          ? new RTCSessionDescription({ type: 'answer', sdp: sdpText })
          : { type: 'answer', sdp: sdpText };
        await connection.pc.setRemoteDescription(desc);
        return;
      } catch (e) {
        log.warn(`setRemoteDescription answer: ${e.message}`);
      }
    }

    this.relayToRoom(socket, roomId, 'webrtc-answer', {
      fromPeerId: socket.data.peerId,
      sdp,
    });
    this.relayToRoom(socket, roomId, 'signal', {
      fromPeerId: socket.data.peerId,
      payload: { type: 'answer', sdp },
    });
  }

  async handleIceCandidate(socket, roomId, candidate) {
    const key = this.connectionKey(socket, roomId, socket.data.peerId);
    const connection = this.peerConnections.get(key);

    if (connection?.pc && candidate) {
      try {
        const { RTCIceCandidate } = await this.getWrtc();
        const ice = RTCIceCandidate ? new RTCIceCandidate(candidate) : candidate;
        await connection.pc.addIceCandidate(ice);
        return;
      } catch (e) {
        log.warn(`addIceCandidate: ${e.message}`);
      }
    }

    this.relayToRoom(socket, roomId, 'ice-candidate', {
      fromPeerId: socket.data.peerId,
      candidate,
    });
    this.relayToRoom(socket, roomId, 'signal', {
      fromPeerId: socket.data.peerId,
      payload: { type: 'ice', candidate },
    });
  }

  closePeerConnection(key) {
    const existing = this.peerConnections.get(key);
    if (existing?.pc) {
      try {
        existing.pc.close();
      } catch {
        /* ignore */
      }
      this.peerConnections.delete(key);
    }
  }

  handleDisconnect(socket) {
    const { peerId, roomId } = socket.data;

    for (const [key, value] of this.peerConnections.entries()) {
      if (value.socketId === socket.id || (roomId && peerId && key === peerKey(roomId, peerId))) {
        try {
          value.pc?.close();
        } catch {
          /* ignore */
        }
        this.peerConnections.delete(key);
      }
    }

    if (peerId) this.peerSockets.delete(peerId);
    if (roomId && peerId) {
      void this.roomManager.leaveRoom(roomId, peerId);
      socket.to(roomId).emit('peer-left', { peerId });
    }
  }

  handleLegacySignal(socket, { targetPeerId, payload }) {
    const { roomId, peerId } = socket.data;
    if (!targetPeerId || !payload || !roomId) return;
    const targetSocketId = this.peerSockets.get(targetPeerId);
    if (!targetSocketId) return;
    if (JSON.stringify(payload).length > 16384) return;
    this.io.to(targetSocketId).emit('signal', { fromPeerId: peerId, payload });
  }

  handleStudioChat(socket, msg) {
    const { roomId, peerId } = socket.data;
    if (!roomId || !msg?.body) return;
    const body = String(msg.body).replace(/<[^>]*>/g, '').slice(0, 2000);
    socket.to(roomId).emit('studio-chat', {
      authorName: msg.authorName || 'Guest',
      body,
      fromPeerId: peerId,
      at: Date.now(),
    });
  }

  handleStudioState(socket, patch) {
    const { roomId, role } = socket.data;
    if (!roomId || !patch || typeof patch !== 'object') return;
    if (role !== 'presenter' && role !== 'moderator') return;
    const allowed = {};
    if (typeof patch.layout === 'string') allowed.layout = patch.layout.slice(0, 20);
    if (typeof patch.isLive === 'boolean') allowed.isLive = patch.isLive;
    socket.to(roomId).emit('studio-state', { ...allowed, fromPeerId: socket.data.peerId });
  }
}
