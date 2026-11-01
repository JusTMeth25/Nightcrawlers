-- Nightcrawlers initial schema (spec 4.3).

CREATE TABLE users (
    id              uuid         PRIMARY KEY,
    username        varchar(20)  NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$'),
    email           varchar(254) NOT NULL CHECK (email = lower(email)),
    password_hash   varchar(255) NOT NULL,
    email_verified  boolean      NOT NULL DEFAULT false,
    created_at      timestamptz  NOT NULL,
    failed_logins   integer      NOT NULL DEFAULT 0,
    locked_until    timestamptz
);
CREATE UNIQUE INDEX ux_users_username_lower ON users (lower(username));
CREATE UNIQUE INDEX ux_users_email ON users (email);

CREATE TABLE refresh_tokens (
    id          uuid         PRIMARY KEY,
    user_id     uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id   uuid         NOT NULL,
    token_hash  varchar(64)  NOT NULL,
    expires_at  timestamptz  NOT NULL,
    used_at     timestamptz,
    revoked_at  timestamptz,
    created_at  timestamptz  NOT NULL,
    user_agent  varchar(512)
);
CREATE UNIQUE INDEX ux_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX ix_refresh_tokens_family ON refresh_tokens (family_id);

CREATE TABLE email_tokens (
    id          uuid         PRIMARY KEY,
    user_id     uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose     varchar(16)  NOT NULL CHECK (purpose IN ('VERIFY', 'RESET')),
    token_hash  varchar(64)  NOT NULL,
    expires_at  timestamptz  NOT NULL,
    used_at     timestamptz
);
CREATE UNIQUE INDEX ux_email_tokens_token_hash ON email_tokens (token_hash);
CREATE INDEX ix_email_tokens_user ON email_tokens (user_id);

CREATE TABLE player_saves (
    user_id                   uuid    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    eurodollars               bigint  NOT NULL DEFAULT 0 CHECK (eurodollars >= 0),
    total_eurodollars_earned  bigint  NOT NULL DEFAULT 0 CHECK (total_eurodollars_earned >= 0),
    total_kills               bigint  NOT NULL DEFAULT 0 CHECK (total_kills >= 0),
    best_time_sec             integer NOT NULL DEFAULT 0 CHECK (best_time_sec >= 0),
    version                   bigint  NOT NULL DEFAULT 0
);

CREATE TABLE unlocked_characters (
    user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    character_id  varchar(32) NOT NULL,
    unlocked_at   timestamptz NOT NULL,
    PRIMARY KEY (user_id, character_id)
);

CREATE TABLE ripperdoc_upgrades (
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    upgrade_id  varchar(32) NOT NULL,
    rank        integer     NOT NULL CHECK (rank >= 0),
    PRIMARY KEY (user_id, upgrade_id)
);

CREATE TABLE enemy_kill_stats (
    user_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    enemy_id  varchar(32) NOT NULL,
    count     bigint      NOT NULL DEFAULT 0 CHECK (count >= 0),
    PRIMARY KEY (user_id, enemy_id)
);

CREATE TABLE character_stats (
    user_id        uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    character_id   varchar(32) NOT NULL,
    best_time_sec  integer     NOT NULL DEFAULT 0 CHECK (best_time_sec >= 0),
    runs           bigint      NOT NULL DEFAULT 0 CHECK (runs >= 0),
    PRIMARY KEY (user_id, character_id)
);

CREATE TABLE codex_entries (
    user_id        uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    entry_type     varchar(8)  NOT NULL CHECK (entry_type IN ('ENEMY', 'WEAPON')),
    entry_id       varchar(32) NOT NULL,
    discovered_at  timestamptz NOT NULL,
    PRIMARY KEY (user_id, entry_type, entry_id)
);

CREATE TABLE runs (
    id                   uuid        PRIMARY KEY,
    user_id              uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    character_id         varchar(32) NOT NULL,
    seed                 integer     NOT NULL CHECK (seed >= 0),
    started_at           timestamptz NOT NULL,
    ended_at             timestamptz,
    last_checkpoint_at   timestamptz,
    duration_sec         integer     CHECK (duration_sec >= 0),
    kills                bigint      CHECK (kills >= 0),
    level                integer     CHECK (level >= 1),
    eurodollars_awarded  bigint      NOT NULL DEFAULT 0 CHECK (eurodollars_awarded >= 0),
    status               varchar(16) NOT NULL CHECK (status IN ('ACTIVE', 'ENDED', 'FLAGGED', 'ABANDONED'))
);
CREATE UNIQUE INDEX ux_runs_one_active_per_user ON runs (user_id) WHERE status = 'ACTIVE';
CREATE INDEX ix_runs_user_duration ON runs (user_id, duration_sec DESC);

CREATE TABLE run_checkpoints (
    id           bigint           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id       uuid             NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    at           timestamptz      NOT NULL,
    elapsed_sec  double precision NOT NULL CHECK (elapsed_sec >= 0),
    kills        bigint           NOT NULL CHECK (kills >= 0),
    level        integer          NOT NULL CHECK (level >= 1),
    eurodollars  bigint           NOT NULL CHECK (eurodollars >= 0)
);
CREATE INDEX ix_run_checkpoints_run ON run_checkpoints (run_id, at);

CREATE TABLE audit_log (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
    event       varchar(32) NOT NULL,
    ip_hash     varchar(64),
    created_at  timestamptz NOT NULL
);
CREATE INDEX ix_audit_log_user ON audit_log (user_id);
