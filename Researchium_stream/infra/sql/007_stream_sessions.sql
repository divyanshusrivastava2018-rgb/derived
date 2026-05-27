-- Stream sessions: lifecycle, viewer peaks, platform analytics snapshots

CREATE TABLE IF NOT EXISTS stream_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  room_slug           TEXT,
  broadcast_id        UUID REFERENCES multistream_broadcasts(id) ON DELETE SET NULL,
  title               TEXT NOT NULL DEFAULT 'Untitled stream',
  status              TEXT NOT NULL DEFAULT 'starting'
                        CHECK (status IN ('starting', 'live', 'ended', 'failed')),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ,
  peak_viewers        INT NOT NULL DEFAULT 0,
  peak_viewers_at     TIMESTAMPTZ,
  platform_peaks      JSONB NOT NULL DEFAULT '{}',
  last_viewer_total   INT NOT NULL DEFAULT 0,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_user_started
  ON stream_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_room
  ON stream_sessions(room_slug, status);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_broadcast
  ON stream_sessions(broadcast_id);

-- Optional time-series samples for analytics charts (retain last N per session)
CREATE TABLE IF NOT EXISTS stream_session_viewer_samples (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  total_viewers   INT NOT NULL DEFAULT 0,
  breakdown       JSONB NOT NULL DEFAULT '{}',
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_session_samples_session_time
  ON stream_session_viewer_samples(session_id, recorded_at DESC);
