-- Language of the emails sent to the user (it, en, es). Existing accounts keep Italian.
ALTER TABLE users
    ADD COLUMN locale varchar(5) NOT NULL DEFAULT 'it'
        CONSTRAINT ck_users_locale CHECK (locale IN ('it', 'en', 'es'));
