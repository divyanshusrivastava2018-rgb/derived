import os from 'os';

const ROOM_KEY = (roomId) => `metrics:${roomId}`;
const ROOM_AGG_KEY = (roomId) => `metrics:room:${roomId}`;

export class MetricsCollector {
  constructor(redisClient = null) {
    this.redis = redisClient;
    this.memory = new Map();
    this.timeseries = [];
    this.systemFields = new Map();
    this.events = [];
    this.metricsInterval = null;

    if (process.env.DISABLE_SYSTEM_METRICS !== '1') {
      this.startCollecting();
    }
  }

  startCollecting() {
    if (this.metricsInterval) return;
    const intervalMs = Number(process.env.METRICS_SYSTEM_INTERVAL_MS) || 5000;
    this.metricsInterval = setInterval(() => {
      void this.collectSystemMetrics().catch(() => {});
    }, intervalMs);
    if (this.metricsInterval.unref) this.metricsInterval.unref();
  }

  async collectSystemMetrics() {
    const metrics = {
      timestamp: Date.now(),
      cpu: {
        usage: os.loadavg()[0] / Math.max(1, os.cpus().length),
        cores: os.cpus().length,
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: 1 - os.freemem() / os.totalmem(),
      },
      network: this.getNetworkMetrics(),
      uptime: process.uptime(),
    };

    const ts = String(metrics.timestamp);
    const serialized = JSON.stringify(metrics);

    if (this.redis) {
      await this.redis.hSet('metrics:system', ts, serialized);
      await this.redis.lPush('metrics:timeseries', serialized);
      await this.redis.lTrim('metrics:timeseries', 0, 1000);
    } else {
      this.systemFields.set(ts, serialized);
      if (this.systemFields.size > 200) {
        const oldest = [...this.systemFields.keys()].sort()[0];
        this.systemFields.delete(oldest);
      }
      this.timeseries.unshift(serialized);
      if (this.timeseries.length > 1000) this.timeseries.length = 1000;
    }

    return metrics;
  }

  getNetworkMetrics() {
    const interfaces = os.networkInterfaces();
    let totalBytesReceived = 0;
    let totalBytesSent = 0;

    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (!net.internal) {
          totalBytesReceived += net.bytesReceived || 0;
          totalBytesSent += net.bytesSent || 0;
        }
      }
    }

    return { received: totalBytesReceived, sent: totalBytesSent };
  }

  /** Per-field room sample (used by APIs / legacy callers). */
  async record(roomId, key, value) {
    const entry = this.memory.get(roomId) || {};
    entry[key] = value;
    entry.updatedAt = Date.now();
    this.memory.set(roomId, entry);

    if (this.redis) {
      await this.redis.hSet(ROOM_KEY(roomId), key, String(value));
    }
  }

  /** Bulk room metrics (participants, bitrate, latency, …). */
  async updateRoom(roomId, fields = {}) {
    const patch = { ...fields, updatedAt: String(Date.now()) };
    const entry = { ...(this.memory.get(roomId) || {}), ...patch };
    this.memory.set(roomId, entry);

    if (this.redis) {
      const flat = Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
      );
      await this.redis.hSet(ROOM_KEY(roomId), flat);
      await this.redis.hSet(ROOM_AGG_KEY(roomId), flat);
    }
  }

  async getRoomMetrics(roomId) {
    const mem = this.memory.get(roomId) || {};
    let hash = { ...mem };

    if (this.redis) {
      const [raw, agg] = await Promise.all([
        this.redis.hGetAll(ROOM_KEY(roomId)),
        this.redis.hGetAll(ROOM_AGG_KEY(roomId)),
      ]);
      hash = { ...raw, ...agg, ...hash };
    }

    const participantCount = parseInt(hash.participants, 10) || 0;
    const totalBitrate = parseInt(hash.bitrate, 10) || parseInt(hash.bandwidth, 10) || 0;
    const averageLatency = parseFloat(hash.latency) || 0;
    const packetLoss = parseFloat(hash.packetLoss) || 0;
    const activeStreams = parseInt(hash.streams, 10) || 0;

    return {
      roomId,
      participantCount,
      totalBitrate,
      averageLatency,
      packetLoss,
      activeStreams,
      healthScore: this.calculateHealthScore({
        packetLoss,
        latency: averageLatency,
        bitrate: totalBitrate,
        participants: participantCount,
      }),
      bandwidth: parseInt(hash.bandwidth, 10) || totalBitrate,
      cpuUsage: parseFloat(hash.cpuUsage) || 0,
      bufferHealth: parseFloat(hash.bufferHealth) || 0,
      frameDropRate: parseFloat(hash.frameDropRate) || 0,
      updatedAt: hash.updatedAt ? Number(hash.updatedAt) : mem.updatedAt || null,
      raw: hash,
    };
  }

  calculateHealthScore(metrics) {
    const packetLoss = parseFloat(metrics.packetLoss) || 0;
    const latency = parseFloat(metrics.latency) || 0;
    const bitrate = parseInt(metrics.bitrate, 10) || 0;
    const participants = parseInt(metrics.participants, 10) || 0;

    let score = 100;
    if (packetLoss > 0.05) score -= 20;
    if (latency > 200) score -= 15;
    if (bitrate > 8000) score -= 10;
    if (participants > 30) score -= 15;
    return Math.max(0, score);
  }

  async getSystemMetrics(limit = 50) {
    if (this.redis) {
      const entries = await this.redis.hGetAll('metrics:system');
      return Object.values(entries)
        .map((v) => {
          try {
            return JSON.parse(v);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    }

    return [...this.systemFields.values()]
      .map((v) => {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getTimeseries(limit = 100) {
    if (this.redis) {
      const rows = await this.redis.lRange('metrics:timeseries', 0, limit - 1);
      return rows
        .map((v) => {
          try {
            return JSON.parse(v);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
    return this.timeseries.slice(0, limit).map((v) => JSON.parse(v));
  }

  async logEvent(eventType, data = {}) {
    const event = {
      type: eventType,
      data,
      timestamp: Date.now(),
      server: os.hostname(),
    };
    const payload = JSON.stringify(event);

    if (this.redis) {
      try {
        await this.redis.xAdd('events', '*', { event: payload });
        return event;
      } catch {
        await this.redis.lPush('events:log', payload);
        await this.redis.lTrim('events:log', 0, 2000);
        return event;
      }
    }

    this.events.unshift(payload);
    if (this.events.length > 500) this.events.length = 500;
    return event;
  }

  stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}
