-- Successor issued when this token was rotated: a quick retry with the old token (page reload
-- before the refresh response arrived) replaces that successor instead of revoking the family.
ALTER TABLE refresh_tokens ADD COLUMN replaced_by uuid;
