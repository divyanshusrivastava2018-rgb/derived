-- Studio tables (run after init.sql)

CREATE TABLE IF NOT EXISTS studio_sessions (
  stream_id         UUID PRIMARY KEY REFERENCES streams(id) ON DELETE CASCADE,
  layout            TEXT NOT NULL DEFAULT 'side'
                    CHECK (layout IN ('solo', 'side', 'pip', 'grid', 'present')),
  recording_enabled BOOLEAN NOT NULL DEFAULT false,
  stream_quality    TEXT NOT NULL DEFAULT '720p'
                    CHECK (stream_quality IN ('480p', '720p', '1080p')),
  active_scene_id   UUID,
  scheduled_at      TIMESTAMPTZ,
  live_started_at   TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_scenes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id   UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  layout_type TEXT NOT NULL DEFAULT 'side',
  sort_order  INT NOT NULL DEFAULT 0,
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (stream_id, slug)
);

CREATE TABLE IF NOT EXISTS studio_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id    UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  author_role  TEXT NOT NULL DEFAULT 'viewer'
                 CHECK (author_role IN ('host', 'guest', 'viewer', 'system')),
  body         TEXT NOT NULL,
  is_private   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_messages_stream ON studio_messages(stream_id, created_at);

CREATE TABLE IF NOT EXISTS studio_guests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id    UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE,
  display_name TEXT,
  status       TEXT NOT NULL DEFAULT 'invited'
                 CHECK (status IN ('invited', 'joined', 'left')),
  joined_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_notes (
  stream_id   UUID PRIMARY KEY REFERENCES streams(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id   UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('camera', 'screen', 'media', 'guest')),
  label       TEXT NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE studio_sessions
  ADD CONSTRAINT fk_active_scene
  FOREIGN KEY (active_scene_id) REFERENCES studio_scenes(id) ON DELETE SET NULL;
