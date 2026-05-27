import { log } from './logger.js';

let RTCPeerConnection = null;
let RTCSessionDescription = null;
let RTCIceCandidate = null;
let loaded = false;

export async function loadWrtc() {
  if (loaded) {
    return { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, available: Boolean(RTCPeerConnection) };
  }
  loaded = true;
  if (process.env.DISABLE_SERVER_WEBRTC === '1') {
    log.info('Server WebRTC (wrtc) disabled by env');
    return { RTCPeerConnection: null, available: false };
  }
  try {
    const wrtc = await import('wrtc');
    RTCPeerConnection = wrtc.default?.RTCPeerConnection || wrtc.RTCPeerConnection;
    RTCSessionDescription = wrtc.default?.RTCSessionDescription || wrtc.RTCSessionDescription;
    RTCIceCandidate = wrtc.default?.RTCIceCandidate || wrtc.RTCIceCandidate;
    log.info('wrtc loaded — server-side peer connections enabled');
  } catch (e) {
    log.warn(`wrtc not available (${e.message}); using mesh relay only`);
    RTCPeerConnection = null;
  }
  return { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, available: Boolean(RTCPeerConnection) };
}

export function iceServersFromEnv() {
  const custom = process.env.WEBRTC_ICE_SERVERS;
  if (custom) {
    try {
      return JSON.parse(custom);
    } catch {
      log.warn('Invalid WEBRTC_ICE_SERVERS JSON; using defaults');
    }
  }
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
}
