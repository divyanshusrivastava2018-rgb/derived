# Researchium — Electron Desktop App

Wraps your existing Express + static site in an Electron shell with:

- ✅ Single-instance lock (no duplicate windows)
- ✅ System Tray with context menu (Courses, Live, MCQ, Quit)
- ✅ Animated splash screen while the server/page loads
- ✅ Deep-link protocol `researchium://courses` etc.
- ✅ Native OS notifications (MCQ done, live class starting)
- ✅ Crash guard with reload/quit dialog
- ✅ App menu with keyboard shortcuts
- ✅ External links open in the OS browser (not the app window)
- ✅ Minimise-to-tray instead of quitting
- ✅ `electron-builder` config for Windows (NSIS), macOS (DMG), Linux (AppImage/deb)

---

## Folder structure

Place these files **alongside** your existing repo:

```
derived/                   ← your existing repo root
├── server/
├── public/
│   └── js/
│       └── electron-bridge.js   ← copy here
├── main.js                      ← Electron entry point
├── preload.js
├── splash.html
├── package.json                 ← merge with your existing one (see below)
└── assets/
    ├── icon.png   (256×256 PNG)
    ├── icon.ico   (Windows)
    └── icon.icns  (macOS)
```

---

## 1 — Merge package.json

Your existing `package.json` already has `"main": "server/index.js"`.
Change it to `"main": "main.js"` and add the Electron entries:

```jsonc
{
  "main": "main.js",
  // add under scripts:
  "scripts": {
    "start":   "node server/index.js",       // keep for web
    "electron":"electron .",                  // desktop
    "dist":    "electron-builder"
  },
  // add top-level:
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3"
  }
}
```

Then:
```bash
npm install
```

---

## 2 — Add the bridge script to every HTML page

In each `.html` file, before `</body>`:

```html
<script src="/js/electron-bridge.js"></script>
```

Copy `electron-bridge.js` into `public/js/`.

---

## 3 — Run in dev mode

Start your Express server in one terminal:
```bash
npm start          # http://localhost:3000
```

Open Electron in another:
```bash
npx electron .
# or
npm run electron
```

The splash screen appears, then the main window loads `http://localhost:3000`.

---

## 4 — Build installers

```bash
# all platforms (from the correct OS)
npm run dist

# Windows only
npm run dist:win

# macOS only
npm run dist:mac

# Linux only
npm run dist:linux
```

Outputs go to `dist/`.

> **Note:** macOS builds must run on macOS. Use GitHub Actions for cross-platform builds.

---

## 5 — Deep links

Register `researchium://` URIs to jump directly to a page:

| URI | Opens |
|-----|-------|
| `researchium://courses` | /courses.html |
| `researchium://live`    | /live-classes.html |
| `researchium://mcq`     | /mcq-test.html |
| `researchium://blog`    | /blog.html |
| `researchium://pricing` | /pricing.html |

On macOS/Linux the protocol is registered automatically.  
On Windows it's set in the NSIS installer via `electron-builder`'s `protocols` config.

---

## 6 — Trigger native notifications from your JS

From any of your existing JS files:

```js
// MCQ test finished
document.dispatchEvent(new CustomEvent('mcq:done', { detail: { score: '18/20' } }));

// Live class about to start
document.dispatchEvent(new CustomEvent('live:starting', { detail: { title: 'JEE Maths with Divyanshu Sir' } }));
```

These are caught by `electron-bridge.js` and converted to OS-level notifications.

---

## 7 — App API features used

| Electron `app` API | Where used |
|---|---|
| `app.requestSingleInstanceLock()` | Prevents duplicate instances |
| `app.setAsDefaultProtocolClient()` | `researchium://` deep links |
| `app.setAppUserModelId()` | Windows toast notifications |
| `app.whenReady()` | Boot sequence |
| `app.on('activate')` | macOS dock click re-opens window |
| `app.on('window-all-closed')` | Quit on Win/Linux, tray on macOS |
| `app.on('before-quit')` | Sets `isQuitting` flag |
| `app.on('second-instance')` | Focus primary + handle deep link |
| `app.on('render-process-gone')` | Crash guard dialog |
| `app.on('open-url')` | macOS deep-link while running |
| `app.getVersion()` / `app.getName()` | Version badge in tray & menu |
