-- An implausible checkpoint is rejected (422) but remembered, so the end of the run is flagged.
ALTER TABLE runs ADD COLUMN flag_reason varchar(64);
