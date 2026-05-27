import { v4 as uuidv4 } from 'uuid';

function hydrateRoom(raw) {
  const room = typeof raw === 'string' ? JSON.parse(raw) : { ...raw };
  const peerList = room.peerIds || room.peers || [];
  room.peers = new Set(Array.isArray(peerList) ? peerList : [...peerList]);
  room.participants = Array.isArray(room.participants) ? room.participants : [];
  room.streams = Array.isArray(room.streams) ? room.streams : [];
  return room;
}

function serializeRoom(room) {
  return {
    ...room,
    peers: room.peers instanceof Set ? [...room.peers] : room.peers || [],
    peerIds: room.peers instanceof Set ? [...room.peers] : room.peerIds || [],
  };
}

export class RoomManager {
  constructor(io, redisClient = null) {
    this.io = io;
    this.redis = redisClient;
    this.rooms = new Map();
    this.activeParticipants = new Map();
    this.joinTokens = new Map();
  }

  async createRoom(roomName, hostId, settings = {}) {
    const roomId = uuidv4();
    const roomConfig = hydrateRoom({
      id: roomId,
      roomId,
      name: roomName || 'Studio room',
      hostId,
      createdAt: Date.now(),
      settings: {
        maxParticipants: settings.maxParticipants || 50,
        recordingEnabled: settings.recordingEnabled || false,
        chatEnabled: settings.chatEnabled !== false,
        screenSharing: settings.screenSharing !== false,
        bitrateLimit: settings.bitrateLimit || 8000,
        layout: settings.layout || 'grid',
        ...settings,
      },
      participants: [],
      streams: [],
      peers: [],
    });

    if (this.redis) {
      await this.redis.set(`room:${roomId}`, JSON.stringify(serializeRoom(roomConfig)), {
        EX: 86400,
      });
      await this.redis.sAdd('active-rooms', roomId);
    }

    this.rooms.set(roomId, roomConfig);
    return roomConfig;
  }

  /**
   * Signaling: pass peerId string. REST: pass participant object { userId, displayName, ... }.
   */
  async joinRoom(roomId, participant) {
    const room = await this.fetchRoom(roomId);
    if (!room) {
      if (typeof participant === 'string') return false;
      throw new Error('Room not found');
    }

    if (typeof participant === 'string') {
      const peerId = participant;
      if (room.peers.size >= room.settings.maxParticipants) return false;
      room.peers.add(peerId);
      if (!room.participants.some((p) => p.peerId === peerId || p.id === peerId)) {
        room.participants.push({
          id: peerId,
          peerId,
          joinedAt: Date.now(),
          status: 'active',
          audioEnabled: true,
          videoEnabled: true,
          bitrate: room.settings.bitrateLimit,
        });
      }
      await this.updateRoom(roomId, room);
      return true;
    }

    if (room.participants.length >= room.settings.maxParticipants) {
      throw new Error('Room is full');
    }

    const participantWithMeta = {
      ...participant,
      joinedAt: Date.now(),
      id: participant.id || uuidv4(),
      peerId: participant.peerId || participant.userId || participant.id,
      status: 'active',
      audioEnabled: participant.audioEnabled !== false,
      videoEnabled: participant.videoEnabled !== false,
      bitrate: room.settings.bitrateLimit,
    };

    room.participants.push(participantWithMeta);
    if (participantWithMeta.peerId) {
      room.peers.add(participantWithMeta.peerId);
    }
    this.activeParticipants.set(participantWithMeta.id, { roomId, participant: participantWithMeta });
    await this.updateRoom(roomId, room);

    this.io?.to(roomId).emit('participant-joined', participantWithMeta);
    return participantWithMeta;
  }

  async leaveRoom(roomId, participantId) {
    const room = await this.fetchRoom(roomId);
    if (!room) return;

    room.participants = room.participants.filter(
      (p) => p.id !== participantId && p.peerId !== participantId
    );
    room.peers.delete(participantId);
    this.activeParticipants.delete(participantId);
    await this.updateRoom(roomId, room);

    this.io?.to(roomId).emit('participant-left', participantId);

    if (room.participants.length === 0 && room.peers.size === 0) {
      await this.deleteRoom(roomId);
    }
  }

  /** Sync read from in-process cache (used by WebRTC signaling). */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  async fetchRoom(roomId) {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    if (this.redis) {
      try {
        const raw = await this.redis.get(`room:${roomId}`);
        if (raw) {
          const room = hydrateRoom(raw);
          this.rooms.set(roomId, room);
          return room;
        }
      } catch {
        /* memory only */
      }
    }

    return null;
  }

  async updateRoom(roomId, room) {
    const snapshot = serializeRoom(room);
    if (this.redis) {
      await this.redis.set(`room:${roomId}`, JSON.stringify(snapshot), { EX: 86400 });
    }
    this.rooms.set(roomId, hydrateRoom(snapshot));
  }

  async deleteRoom(roomId) {
    if (this.redis) {
      await this.redis.del(`room:${roomId}`);
      await this.redis.sRem('active-rooms', roomId);
    }
    this.rooms.delete(roomId);
    for (const [pid, meta] of this.activeParticipants.entries()) {
      if (meta.roomId === roomId) this.activeParticipants.delete(pid);
    }
    this.io?.to(roomId).emit('room-closed');
  }

  async generateJoinToken(roomId, userId) {
    const room = await this.fetchRoom(roomId);
    if (!room) throw new Error('Room not found');

    const secret = process.env.JWT_SECRET;
    if (secret) {
      const jwt = (await import('jsonwebtoken')).default;
      return jwt.sign(
        { sub: userId, roomId, role: 'viewer' },
        secret,
        { expiresIn: '1h', issuer: 'researchium-stream', audience: 'researchium-signaling' }
      );
    }

    const token = Buffer.from(
      JSON.stringify({ roomId, userId, expires: Date.now() + 3600000 })
    ).toString('base64url');

    if (this.redis) {
      await this.redis.setEx(`token:${token}`, 3600, roomId);
    } else {
      this.joinTokens.set(token, { roomId, expires: Date.now() + 3600000 });
    }

    return token;
  }

  async validateJoinToken(token) {
    if (this.redis) {
      const roomId = await this.redis.get(`token:${token}`);
      return roomId || null;
    }
    const entry = this.joinTokens.get(token);
    if (!entry || entry.expires < Date.now()) return null;
    return entry.roomId;
  }

  getActiveRoomsCount() {
    return this.rooms.size;
  }
}
