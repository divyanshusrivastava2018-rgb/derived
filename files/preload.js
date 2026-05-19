'use strict';

/**
 * preload.js — Researchium Electron Preload
 * Exposes a safe `window.researchiumApp` bridge to the renderer
 * via contextBridge. No Node APIs leak to the web page.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('researchiumApp', {
  /** Returns { name, version, platform, electron } */
  getInfo: () => ipcRenderer.invoke('app:info'),

  /** Navigate to a route, e.g. '/courses.html' */
  navigate: (route) => ipcRenderer.invoke('app:navigate', route),

  /** Show a native OS notification */
  notify: (title, body) => ipcRenderer.invoke('app:notify', { title, body }),

  /** Open a URL in the default OS browser */
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  /** Quit the application */
  quit: () => ipcRenderer.invoke('app:quit'),

  /** True when running inside Electron (vs plain browser) */
  isElectron: true,
});
