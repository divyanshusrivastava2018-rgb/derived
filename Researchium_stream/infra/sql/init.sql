CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE researchers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcid      TEXT UNIQUE,
  name       TEXT NOT NULL,
  institution TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  researcher_id UUID REFERENCES researchers(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_hash ON password_reset_tokens(token_hash);

CREATE TABLE streams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id             UUID NOT NULL REFERENCES researchers(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  topic               TEXT,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'live', 'ended', 'recorded')),
  room_slug           TEXT NOT NULL UNIQUE,
  is_gated            BOOLEAN NOT NULL DEFAULT false,
  gate_password_hash  TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE stream_edges (
  from_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  to_id   UUID NOT NULL,
  rel     TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id, rel)
);

CREATE INDEX idx_streams_host ON streams(host_id);
CREATE INDEX idx_streams_status ON streams(status);
CREATE INDEX idx_streams_room_slug ON streams(room_slug);

-- Studio (browser broadcast room)
CREATE TABLE studio_sessions (
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

CREATE TABLE studio_scenes (
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

CREATE TABLE studio_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id    UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  author_role  TEXT NOT NULL DEFAULT 'viewer'
                 CHECK (author_role IN ('host', 'guest', 'viewer', 'system')),
  body         TEXT NOT NULL,
  is_private   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_studio_messages_stream ON studio_messages(stream_id, created_at);

CREATE TABLE studio_guests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id    UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE,
  display_name TEXT,
  status       TEXT NOT NULL DEFAULT 'invited'
                 CHECK (status IN ('invited', 'joined', 'left')),
  joined_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE studio_notes (
  stream_id   UUID PRIMARY KEY REFERENCES streams(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE studio_sources (
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
