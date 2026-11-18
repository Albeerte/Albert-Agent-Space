ALTER TABLE agents ADD COLUMN sprite_id INTEGER CHECK (sprite_id IS NULL OR sprite_id BETWEEN 0 AND 5);
