-- Parking app schema. Run once against a fresh database:
--   psql "$DATABASE_URL" -f schema.sql
-- No Alembic: this schema is created fresh, not migrated from an earlier version.
-- Add a real migration tool the first time you need to change a schema that already holds data.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
    id                  BIGSERIAL PRIMARY KEY,
    username            TEXT NOT NULL,
    points_balance      INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    photo_unlock_until  TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_uidx ON users (username);

-- Separate from `users` so Google/Apple/phone sign-in can be added later as new rows
-- (same or new user_id for account linking) without touching `users` or existing data.
CREATE TABLE auth_credentials (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          TEXT NOT NULL,           -- 'password' today; 'google'/'apple'/'phone' later
    provider_subject  TEXT NOT NULL,           -- lowercased username for 'password'; provider's subject id otherwise
    password_hash     TEXT NULL,               -- bcrypt hash, only set when provider='password'
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX auth_credentials_provider_subject_uidx ON auth_credentials (provider, provider_subject);

-- Opaque bearer session tokens. Only the hash is stored, same reasoning as password hashing:
-- a DB dump shouldn't hand out live sessions.
CREATE TABLE sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ NULL
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Replaces results.json. Gets a real primary key, which the old coordinate-identity model lacked.
CREATE TABLE parking_spots (
    id              BIGSERIAL PRIMARY KEY,
    source          TEXT NOT NULL,             -- 'photo' | 'taipei-open-data'
    count           INTEGER NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    location        GEOGRAPHY(POINT, 4326) NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL,       -- was `timestamp` in results.json
    name            TEXT NOT NULL DEFAULT '',
    price           TEXT NOT NULL DEFAULT '',
    total           INTEGER NULL,               -- null, not 0 -- 0 would read as "no spaces here"
    image_filename  TEXT NULL,
    uploaded_by     BIGINT NULL REFERENCES users(id),  -- who earns the +4 for this row; null for
                                                        -- taipei-open-data and pre-auth migrated rows
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX parking_spots_location_gix ON parking_spots USING GIST (location);
CREATE INDEX parking_spots_source_idx ON parking_spots (source);

-- Points transaction ledger -- audit trail, not just a mutated integer column.
CREATE TABLE points_ledger (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(id),
    delta            INTEGER NOT NULL,          -- +4 upload reward, -2 unlock spend, +4 welcome grant
    reason           TEXT NOT NULL,             -- 'upload_reward' | 'photo_unlock' | 'welcome_grant'
    related_spot_id  BIGINT NULL REFERENCES parking_spots(id) ON DELETE SET NULL,
    balance_after    INTEGER NOT NULL,          -- snapshot for dispute resolution without recomputation
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX points_ledger_user_id_idx ON points_ledger (user_id, created_at);
