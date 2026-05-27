# Unified Chat Aggregator

Aggregate **YouTube Live Chat**, **Twitch IRC**, and **Facebook Live** comments into one studio chat drawer. Send and moderate from a single input.

## Prerequisites

1. Run `infra/sql/006_unified_chat.sql`
2. Connect platforms under **Stream Dashboard → Destinations** (OAuth)
3. **Go live everywhere** (creates platform broadcasts and stores IDs)
4. Open **studio.html** → Chat panel → **Sync platform chat**

## Real-time transport

| Platform | Backend connector |
|----------|-------------------|
| Twitch | `tmi.js` → Twitch IRC (WebSocket) |
| YouTube | Live Chat API polling (3s) |
| Facebook | Graph API comment polling (4s) |

Messages are pushed to the room via Socket.IO: `unified-chat-message`.

## Socket.IO (presenter)

| Event | Direction | Description |
|-------|-----------|-------------|
| `unified-chat-start` | → server | Start aggregators `{ roomId, config }` |
| `unified-chat-stop` | → server | Stop aggregators |
| `unified-chat-send` | → server | Send to all platforms `{ body, authorName }` |
| `unified-chat-moderate` | → server | `{ action, target }` |
| `unified-chat-message` | ← server | Normalized message |
| `unified-chat-moderation` | ← server | Mod action applied |

## Moderation actions

| Action | Twitch | YouTube | Facebook |
|--------|--------|---------|----------|
| `timeout` | IRC timeout | Live ban (temporary) | — |
| `ban` | IRC ban | Live ban (permanent) | — |
| `delete` | Helix API | liveChatMessages.delete | DELETE comment |

Right-click a message in the studio chat panel for mod buttons (presenter/moderator).

## REST API

Prefix: `/api/unified-chat/:roomSlug` (Bearer JWT)

- `POST /start` — `{ platforms?, broadcastId? }`
- `POST /stop`
- `GET /messages?since=&limit=`
- `POST /send` — `{ body, authorName }`
- `POST /moderate` — `{ action, platform?, userId?, username?, messageId?, durationSec? }`
