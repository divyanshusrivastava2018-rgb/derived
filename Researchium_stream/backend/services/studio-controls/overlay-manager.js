const DEFAULT_OVERLAYS = {
  alert: { enabled: true, durationMs: 6000, position: 'top' },
  donation: { enabled: true, durationMs: 8000, position: 'bottom-left' },
  follower: { enabled: true, durationMs: 5000, position: 'top-right' },
};

export class OverlayManager {
  constructor() {
    this.roomState = new Map();
    this.recentFollowers = new Map();
  }

  getState(roomSlug) {
    if (!this.roomState.has(roomSlug)) {
      this.roomState.set(roomSlug, {
        config: structuredClone(DEFAULT_OVERLAYS),
        queue: [],
        active: null,
      });
    }
    return this.roomState.get(roomSlug);
  }

  getConfig(roomSlug) {
    return this.getState(roomSlug).config;
  }

  updateConfig(roomSlug, patch) {
    const state = this.getState(roomSlug);
    state.config = { ...state.config, ...patch };
    return state.config;
  }

  buildEvent(type, payload) {
    const base = {
      id: `ov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      at: Date.now(),
      ...payload,
    };
    const cfg = DEFAULT_OVERLAYS[type] || { durationMs: 5000 };
    base.durationMs = payload.durationMs || cfg.durationMs;
    base.position = payload.position || cfg.position;
    return base;
  }

  trigger(roomSlug, type, payload, io) {
    const state = this.getState(roomSlug);
    const event = this.buildEvent(type, payload);
    state.active = event;
    state.queue.push(event);

    if (type === 'follower') {
      const list = this.recentFollowers.get(roomSlug) || [];
      list.unshift({ name: payload.user || payload.title, at: event.at, platform: payload.platform });
      this.recentFollowers.set(roomSlug, list.slice(0, 20));
    }

    if (io) {
      io.to(roomSlug).emit('overlay-show', event);
      io.to(roomSlug).emit('studio-state', { overlay: event });
    }

    setTimeout(() => {
      if (state.active?.id === event.id) state.active = null;
      if (io) io.to(roomSlug).emit('overlay-hide', { id: event.id });
    }, event.durationMs);

    return event;
  }

  getRecentFollowers(roomSlug) {
    return this.recentFollowers.get(roomSlug) || [];
  }

  getFullState(roomSlug) {
    const state = this.getState(roomSlug);
    return {
      config: state.config,
      active: state.active,
      recentFollowers: this.getRecentFollowers(roomSlug),
    };
  }
}
