import { ObsBridge } from './obs-bridge.js';
import { OverlayManager } from './overlay-manager.js';
import { AnalyticsCollector } from './analytics-collector.js';
import { SceneController } from './scene-controller.js';

const obsBridge = new ObsBridge();
export const overlayManager = new OverlayManager();
export const analyticsCollector = new AnalyticsCollector();

export function createSceneController(sceneCompositor) {
  return new SceneController(obsBridge, sceneCompositor);
}
