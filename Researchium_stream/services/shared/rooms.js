const MAX_PEERS_PER_ROOM = Number(process.env.MAX_PEERS_PER_ROOM) || 50;
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 500;

/** roomId -> Map(peerId -> socketId) */
export class RoomRegistry {
  constructor() {
    this.rooms = new Map();
  }

  join(roomId, peerId, socketId) {
    if (!this.rooms.has(roomId) && this.rooms.size >= MAX_ROOMS) {
      const err = new Error('Server at room capacity');
      err.status = 503;
      throw err;
    }
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map());
    const peers = this.rooms.get(roomId);
    if (peers.size >= MAX_PEERS_PER_ROOM && !peers.has(peerId)) {
      const err = new Error('Room is full');
      err.status = 403;
      throw err;
    }
    peers.set(peerId, socketId);
  }

  leave(roomId, peerId) {
    const peers = this.rooms.get(roomId);
    if (!peers) return;
    peers.delete(peerId);
    if (peers.size === 0) this.rooms.delete(roomId);
  }

  getSocketId(roomId, peerId) {
    return this.rooms.get(roomId)?.get(peerId);
  }

  listPeers(roomId) {
    const peers = this.rooms.get(roomId);
    return peers ? [...peers.keys()] : [];
  }
}
