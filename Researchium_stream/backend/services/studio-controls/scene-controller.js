export class SceneController {
  constructor(obsBridge, sceneCompositor) {
    this.obsBridge = obsBridge;
    this.sceneCompositor = sceneCompositor;
  }

  async disconnectObs(userId) {
    return this.obsBridge.disconnect(userId);
  }

  async switchBrowserScene(io, roomSlug, { sceneId, layout, sceneConfig }) {
    const patch = { activeSceneId: sceneId };
    if (layout) patch.layout = layout;

    io.to(roomSlug).emit('studio-state', patch);

    if (sceneConfig) {
      const frame = await this.sceneCompositor.composeScene(sceneConfig);
      io.to(roomSlug).emit('scene-render', { frame, timestamp: Date.now() });
    }

    return { mode: 'browser', ...patch };
  }

  async switchObsScene(userId, sceneName) {
    return this.obsBridge.setScene(userId, sceneName);
  }

  async listObsScenes(userId) {
    return this.obsBridge.listScenes(userId);
  }

  async connectObs(userId, options) {
    return this.obsBridge.connect(userId, options);
  }

  async obsStatus(userId) {
    return this.obsBridge.getStatus(userId);
  }
}
