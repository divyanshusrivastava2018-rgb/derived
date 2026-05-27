import { log } from '../../lib/logger.js';

let OBSWebSocket = null;

async function loadObsModule() {
  if (OBSWebSocket !== undefined) return OBSWebSocket;
  try {
    const mod = await import('obs-websocket-js');
    OBSWebSocket = mod.default || mod.OBSWebSocket;
  } catch {
    OBSWebSocket = null;
  }
  return OBSWebSocket;
}

export class ObsBridge {
  constructor() {
    this.clients = new Map();
  }

  key(userId) {
    return String(userId);
  }

  async connect(userId, { host, port, password } = {}) {
    const Obs = await loadObsModule();
    if (!Obs) {
      throw new Error('obs_websocket_not_installed — run: npm install obs-websocket-js');
    }

    const addr = host || process.env.OBS_WEBSOCKET_HOST || '127.0.0.1';
    const p = Number(port || process.env.OBS_WEBSOCKET_PORT || 4455);
    const pass = password ?? process.env.OBS_WEBSOCKET_PASSWORD ?? '';

    await this.disconnect(userId);

    const obs = new Obs();
    await obs.connect(`ws://${addr}:${p}`, pass || undefined);
    this.clients.set(this.key(userId), { obs, host: addr, port: p });

    log.info(`OBS connected for user ${userId} at ${addr}:${p}`);
    return { connected: true, host: addr, port: p };
  }

  async disconnect(userId) {
    const entry = this.clients.get(this.key(userId));
    if (entry?.obs) {
      try {
        await entry.obs.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.clients.delete(this.key(userId));
  }

  getClient(userId) {
    return this.clients.get(this.key(userId))?.obs || null;
  }

  async listScenes(userId) {
    const obs = this.getClient(userId);
    if (!obs) throw new Error('obs_not_connected');
    const { scenes } = await obs.call('GetSceneList');
    const current = await obs.call('GetCurrentProgramScene');
    return { scenes: scenes || [], currentProgramScene: current?.currentProgramScene };
  }

  async setScene(userId, sceneName) {
    const obs = this.getClient(userId);
    if (!obs) throw new Error('obs_not_connected');
    await obs.call('SetCurrentProgramScene', { sceneName });
    return { sceneName };
  }

  async getStatus(userId) {
    const entry = this.clients.get(this.key(userId));
    if (!entry) return { connected: false };
    try {
      const ver = await entry.obs.call('GetVersion');
      return { connected: true, host: entry.host, port: entry.port, obsVersion: ver.obsVersion };
    } catch {
      return { connected: false };
    }
  }
}
