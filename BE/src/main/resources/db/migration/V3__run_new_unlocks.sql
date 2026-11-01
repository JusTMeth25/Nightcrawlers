-- Characters unlocked by a run, so a repeated /end returns the same outcome (comma-separated ids).
ALTER TABLE runs ADD COLUMN new_unlocks varchar(255);
