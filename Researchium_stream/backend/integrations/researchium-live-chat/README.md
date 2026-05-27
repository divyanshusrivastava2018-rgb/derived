# Researchium Live Chat Integration

Production-ready Express module: REST messages API, signed webhooks, PostgreSQL persistence, retries, API key auth.

## Setup

1. Run SQL migration:

```bash
psql "$DATABASE_URL" -f infra/sql/004_researchium_live_chat.sql
```

2. Configure env (see `.env.example`).

3. Mount on studio backend (default) or run standalone.

## API (prefix `/api/integrations/researchium/v1`)

All integration routes (except webhooks) require:

```http
X-API-Key: {RESEARCHIUM_INTEGRATION_API_KEY}
```

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service + DB status |
| POST | `/sessions` | `{ roomSlug, title?, externalSessionId?, metadata? }` |
| GET | `/sessions/:roomSlug` | Get session |
| GET | `/sessions/:roomSlug/messages?since=&limit=` | List messages |
| POST | `/sessions/:roomSlug/messages` | Send message `{ body, authorName, authorId?, isPrivate? }` |
| POST | `/webhooks/events` | Researchium webhook (HMAC) |
| POST | `/admin/retry-webhooks` | Process pending webhook retries |

## Webhook

```http
POST /api/integrations/researchium/v1/webhooks/events
X-Researchium-Signature: sha256=<hmac-sha256-hex of raw body>
Content-Type: application/json

{
  "id": "evt_123",
  "type": "chat.message.created",
  "data": {
    "room_slug": "live-with-researchium-may26-abc",
    "body": "Hello",
    "author_name": "Viewer"
  }
}
```

Supported types: `chat.message.created`, `session.started`, `session.ended`, `session.updated`, `participant.joined`, `participant.left`.

## Standalone

```bash
cd backend
node integrations/researchium-live-chat/standalone-server.js
```

## Socket.IO

Outbound messages broadcast `studio-chat` to the room slug when mounted with `io` from studio backend.
