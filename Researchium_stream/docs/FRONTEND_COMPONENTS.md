# Frontend components (React)

React 18 components for platform connections, unified chat, stream controls, and live viewer counts. Built with Vite and embeddable in existing static pages (`studio.html`, `stream-dashboard.html`).

## Build

```bash
cd frontend
npm install
npm run build
```

Output: `dist/stream-components/stream-components.js` (+ CSS)

From repo root:

```bash
npm run build:frontend
```

## Embed in HTML

```html
<link rel="stylesheet" href="dist/stream-components/stream-components.css"/>
<script src="js/studio-auth.js"></script>
<script src="dist/stream-components/stream-components.js"></script>
<script>
  const room = 'your-room-slug';
  ResearchiumStreamComponents.mount.viewerCounter(
    document.getElementById('viewerRoot'),
    { roomSlug: room, intervalMs: 5000, compact: true }
  );
  ResearchiumStreamComponents.mount.unifiedChatRoom(
    document.getElementById('chatRoot'),
    { roomSlug: room, authorName: 'Host' }
  );
  ResearchiumStreamComponents.mount.streamControlPanel(
    document.getElementById('controlsRoot'),
    { roomSlug: room, title: 'My stream' }
  );
  ResearchiumStreamComponents.mount.platformConnectionManager(
    document.getElementById('platformsRoot'),
    { showGoLive: true }
  );
</script>
```

Requires `window.ResearchiumStudio` (login token) and studio backend on `:5050`.

## Components

| Component | Purpose |
|-----------|---------|
| `PlatformConnectionManager` | Connect / remove YouTube, Twitch, Facebook, LinkedIn via OAuth |
| `UnifiedChatRoom` | Merged chat UI + Socket.IO `chat-relay-*` |
| `StreamControlPanel` | Start/stop stream, scene chips, layout presets |
| `ViewerCounter` | Total + per-platform viewers, **5s** refresh (REST + Socket) |

## Dev server

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/?room=your-slug` after logging in at `studio-lobby.html`.

## Pages

- `stream-components.html` — all four components on one page
- `stream-dashboard.html` — destinations panel uses React platform manager (when bundle built)

## Vue

These components are React-only. For Vue, wrap the built bundle with a thin adapter or call the REST/WebSocket APIs from `docs/BACKEND_API.md` directly.
