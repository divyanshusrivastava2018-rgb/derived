-- Unified cross-platform chat aggregation

CREATE TABLE IF NOT EXISTS unified_chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_slug       TEXT NOT NULL,
  platform        TEXT NOT NULL
                    CHECK (platform IN ('youtube', 'twitch', 'facebook', 'linkedin', 'studio')),
  external_id     TEXT,
  author_id       TEXT,
  author_name     TEXT NOT NULL,
  body            TEXT NOT NULL,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_slug, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_chat_room_time
  ON unified_chat_messages(room_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS unified_chat_moderation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_slug       TEXT NOT NULL,
  moderator_id    TEXT NOT NULL,
  action          TEXT NOT NULL
                    CHECK (action IN ('timeout', 'ban', 'delete', 'untimeout', 'unban')),
  target_platform TEXT,
  target_user_id  TEXT,
  target_username TEXT,
  message_id      UUID REFERENCES unified_chat_messages(id) ON DELETE SET NULL,
  duration_sec    INT,
  success         BOOLEAN NOT NULL DEFAULT true,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_mod_room
  ON unified_chat_moderation_log(room_slug, created_at DESC);
