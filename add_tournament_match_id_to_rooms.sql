-- ==========================================
-- ADD TOURNAMENT_MATCH_ID TO ROOMS
-- ==========================================
-- This script adds the missing column to link rooms to tournament matches.

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS tournament_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_rooms_tournament_match ON public.rooms(tournament_match_id);
