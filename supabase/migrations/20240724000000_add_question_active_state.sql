-- Update existing rooms with default values
UPDATE public.rooms SET question_index = 0 WHERE question_index IS NULL;

-- Add a comment to document the game_state values
COMMENT ON COLUMN public.rooms.game_state IS 'Valid states: waiting, playing, question_active, review, finished'; 