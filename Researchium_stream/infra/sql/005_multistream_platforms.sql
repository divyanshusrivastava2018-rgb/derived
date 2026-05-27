-- Multi-platform streaming connections (encrypted credentials)

CREATE TABLE IF NOT EXISTS platform_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  platform          TEXT NOT NULL
                      CHECK (platform IN ('youtube', 'twitch', 'facebook', 'linkedin')),
  account_id        TEXT,
  account_name      TEXT,
  access_token_enc  TEXT,
  refresh_token_enc TEXT,
  stream_key_enc    TEXT,
  token_expires_at  TIMESTAMPTZ,
  scopes            TEXT[],
  metadata          JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'connected'
                      CHECK (status IN ('connected', 'expired', 'revoked', 'error')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_connections_user
  ON platform_connections(user_id, status);

CREATE TABLE IF NOT EXISTS multistream_broadcasts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  room_slug    TEXT,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'starting'
                 CHECK (status IN ('starting', 'live', 'partial', 'ended', 'failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS multistream_broadcast_targets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id          UUID NOT NULL REFERENCES multistream_broadcasts(id) ON DELETE CASCADE,
  platform              TEXT NOT NULL,
  external_broadcast_id TEXT,
  rtmp_url              TEXT,
  playback_url          TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'live', 'failed', 'ended')),
  error_message         TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_multistream_targets_broadcast
  ON multistream_broadcast_targets(broadcast_id);
