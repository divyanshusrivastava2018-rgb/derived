-- Researchium live chat integration (run after 002_studio.sql)
-- Sessions map to stream room_slug; messages sync with studio + external webhooks.

CREATE TABLE IF NOT EXISTS researchium_chat_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_slug           TEXT NOT NULL UNIQUE,
  stream_id           UUID REFERENCES streams(id) ON DELETE SET NULL,
  external_session_id TEXT UNIQUE,
  title               TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'live', 'ended', 'archived')),
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_researchium_chat_sessions_status
  ON researchium_chat_sessions(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS researchium_chat_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES researchium_chat_sessions(id) ON DELETE CASCADE,
  external_message_id  TEXT UNIQUE,
  direction            TEXT NOT NULL DEFAULT 'outbound'
                         CHECK (direction IN ('inbound', 'outbound')),
  author_id            TEXT,
  author_name          TEXT NOT NULL,
  author_role          TEXT NOT NULL DEFAULT 'viewer'
                         CHECK (author_role IN ('host', 'guest', 'viewer', 'system', 'integration')),
  body                 TEXT NOT NULL,
  is_private           BOOLEAN NOT NULL DEFAULT false,
  sentiment            TEXT,
  delivery_status      TEXT NOT NULL DEFAULT 'delivered'
                         CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_researchium_chat_messages_session
  ON researchium_chat_messages(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_researchium_chat_messages_pending
  ON researchium_chat_messages(delivery_status) WHERE delivery_status = 'pending';

CREATE TABLE IF NOT EXISTS researchium_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  session_id      UUID REFERENCES researchium_chat_sessions(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  attempt_count   INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 5,
  next_retry_at   TIMESTAMPTZ,
  last_error      TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_researchium_webhook_retry
  ON researchium_webhook_events(status, next_retry_at)
  WHERE status IN ('pending', 'failed');
