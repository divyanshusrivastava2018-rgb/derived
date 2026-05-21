'use strict';

/**
 * Researchium — Electron Main Process
 * Uses Electron app API: lifecycle, single-instance, tray, deep-link,
 * notifications, auto-launch, and graceful shutdown.
 */

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  shell,
  ipcMain,
  nativeImage,
  Notification,
  dialog,
  protocol,
  session,
} = require('electron');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────
const APP_NAME    = 'Researchium';
const APP_VERSION = app.getVersion();
const BASE_URL    = process.env.RESEARCHIUM_URL || 'http://localhost:3000';
const ICON_PATH   = path.join(__dirname, 'assets', 'icon.png'); // provide 256×256 PNG
const PROTOCOL    = 'researchium';              // deep-link: researchium://

// ─── Single-instance lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another instance is already running → quit immediately
  console.log('[app] Second instance detected — quitting.');
  app.quit();
}

// ─── Windows: set App User Model ID for toast notifications ──────────────────
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_NAME);
}

// ─── Custom deep-link protocol (researchium://) ───────────────────────────────
// Must be registered before 'ready' on Windows/Linux
if (process.platform !== 'darwin') {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow  = null;
let splashWindow = null;
let tray        = null;
let isQuitting  = false;

// ─── Splash window ────────────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 340,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: { contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

// ─── Main window ──────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    show: false,  // shown after ready-to-show
    title: APP_NAME,
    icon: ICON_PATH,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(BASE_URL);

  // ── Show once paint is ready (avoids white flash) ──────────────────────────
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();

    sendWelcomeNotification();
  });

  // ── Minimise to tray on close (instead of quitting) ───────────────────────
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (process.platform === 'darwin') app.dock.hide();
    }
  });

  // ── Open external links in the OS browser ─────────────────────────────────
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(BASE_URL)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(BASE_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  buildAppMenu();
}

// ─── System tray ─────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH);
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.setToolTip(`${APP_NAME} v${APP_VERSION}`);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Researchium',
      click: showMainWindow,
    },
    { type: 'separator' },
    {
      label: 'Courses',
      click: () => navigateTo('/courses.html'),
    },
    {
      label: 'Live Classes',
      click: () => navigateTo('/live-classes.html'),
    },
    {
      label: 'MCQ Test',
      click: () => navigateTo('/mcq-test.html'),
    },
    { type: 'separator' },
    {
      label: 'Check for updates…',
      click: () => checkForUpdates(),
    },
    { type: 'separator' },
    {
      label: `v${APP_VERSION}`,
      enabled: false,
    },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: () => quitApp(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', showMainWindow);
}

// ─── Native app menu ──────────────────────────────────────────────────────────
function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Preferences…',
                accelerator: 'Cmd+,',
                click: () => navigateTo('/pricing.html'),
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: '&File',
      submenu: [
        {
          label: 'New MCQ Test',
          accelerator: 'CmdOrCtrl+T',
          click: () => navigateTo('/mcq-test.html'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: '&Navigate',
      submenu: [
        { label: 'Home',         click: () => navigateTo('/') },
        { label: 'Courses',      click: () => navigateTo('/courses.html') },
        { label: 'Live Classes', click: () => navigateTo('/live-classes.html') },
        { label: 'Research Blog',click: () => navigateTo('/blog.html') },
        { label: 'Pricing',      click: () => navigateTo('/pricing.html') },
        { label: 'About',        click: () => navigateTo('/about.html') },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: '&Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.reload(),
        },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
      ],
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Open in Browser',
          click: () => shell.openExternal(BASE_URL),
        },
        {
          label: 'GitHub Repository',
          click: () =>
            shell.openExternal(
              'https://github.com/divyanshusrivastava2018-rgb/derived'
            ),
        },
        { type: 'separator' },
        {
          label: `Version ${APP_VERSION}`,
          enabled: false,
        },
        {
          label: 'Check for updates…',
          click: () => checkForUpdates(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (process.platform === 'darwin') app.dock.show();
}

function navigateTo(urlPath) {
  if (!mainWindow) return;
  showMainWindow();
  mainWindow.loadURL(BASE_URL + urlPath);
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

function sendWelcomeNotification() {
  if (!Notification.isSupported()) return;
  new Notification({
    title: APP_NAME,
    body: 'Ready to learn! Courses, live classes & MCQ tests await.',
    icon: ICON_PATH,
  }).show();
}

function checkForUpdates() {
  // Placeholder — wire in electron-updater when you publish releases
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Updates',
    message: `${APP_NAME} v${APP_VERSION}`,
    detail:
      'You are running the latest version.\n\n' +
      'Auto-update support will be enabled when releases are published to GitHub.',
    buttons: ['OK'],
  });
}

// Handle deep-link navigation (researchium://courses → /courses.html)
function handleDeepLink(url) {
  if (!url || !url.startsWith(`${PROTOCOL}://`)) return;
  const route = url.slice(`${PROTOCOL}://`.length).replace(/^\//, '');
  const pageMap = {
    courses:      '/courses.html',
    live:         '/live-classes.html',
    blog:         '/blog.html',
    pricing:      '/pricing.html',
    about:        '/about.html',
    mcq:          '/mcq-test.html',
  };
  navigateTo(pageMap[route] || '/');
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

// Second instance → focus primary
app.on('second-instance', (_event, argv) => {
  showMainWindow();
  // Windows passes the deep-link URL as a CLI arg
  const deepLink = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (deepLink) handleDeepLink(deepLink);
});

// macOS: handle deep-link while app is running
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// ── Ready ──────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  console.log(
    `[app] ${APP_NAME} v${APP_VERSION} — ${process.platform} / Electron ${process.versions.electron}`
  );

  // macOS: register deep-link after ready
  if (process.platform === 'darwin') {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  // Optional: start on system login (user preference stored elsewhere)
  // app.setLoginItemSettings({ openAtLogin: true });

  createSplash();
  createMainWindow();
  createTray();
});

// ── macOS: re-create window when dock icon is clicked ─────────────────────────
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  } else {
    showMainWindow();
  }
});

// ── All windows closed ─────────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  // On macOS stay in Tray; on other platforms quit
  if (process.platform !== 'darwin') {
    quitApp();
  }
});

// ── Before quit: confirm if unsaved work (optional UX) ───────────────────────
app.on('before-quit', () => {
  isQuitting = true; // let the 'close' handler on BrowserWindow pass through
});

// ── IPC — renderer → main ─────────────────────────────────────────────────────
ipcMain.handle('app:info', () => ({
  name:     APP_NAME,
  version:  APP_VERSION,
  platform: process.platform,
  electron: process.versions.electron,
}));

ipcMain.handle('app:navigate', (_e, route) => navigateTo(route));

ipcMain.handle('app:notify', (_e, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title: title || APP_NAME, body, icon: ICON_PATH }).show();
  }
});

ipcMain.handle('app:open-external', (_e, url) => {
  shell.openExternal(url);
});

ipcMain.handle('app:quit', () => quitApp());

// ─── Renderer crash guard ─────────────────────────────────────────────────────
app.on('render-process-gone', (_e, _wc, details) => {
  console.error('[app] Renderer gone:', details.reason);
  dialog
    .showMessageBox({
      type: 'error',
      title: 'Oops — something crashed',
      message:
        'The Researchium page crashed unexpectedly.\nWould you like to reload?',
      buttons: ['Reload', 'Quit'],
      defaultId: 0,
    })
    .then(({ response }) => {
      if (response === 0 && mainWindow) mainWindow.reload();
      else quitApp();
    });
});
