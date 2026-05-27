export class TranscoderService {
  constructor() {
    this.recordings = new Map();
  }

  async startRecording(roomId) {
    this.recordings.set(roomId, { status: 'recording', startedAt: Date.now() });
    return { roomId, status: 'recording' };
  }

  async stopRecording(roomId) {
    const rec = this.recordings.get(roomId);
    if (!rec) return null;
    rec.status = 'stopped';
    rec.endedAt = Date.now();
    return rec;
  }

  isRecording(roomId) {
    return this.recordings.get(roomId)?.status === 'recording';
  }
}
