-- ==========================================
-- FIX TOURNAMENT RLS
-- ==========================================
-- This script fixes RLS policies to allow tournament progression.

-- 1. Allow ANY authenticated user to insert matches if they are part of the tournament
-- This is needed because checkAndGenerateNextRound runs as the winner of the previous match
DROP POLICY IF EXISTS "Leaders can create matches" ON public.tournament_matches;

CREATE POLICY "Participants can create matches"
ON public.tournament_matches FOR INSERT
TO authenticated
WITH CHECK (
    tournament_id IN (
        SELECT id FROM public.tournaments WHERE community_id IN (
            SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
        )
    )
);

-- 2. Allow ANY authenticated user to update tournament status (for completion)
DROP POLICY IF EXISTS "Leaders can update tournaments" ON public.tournaments;

CREATE POLICY "Members can update tournaments"
ON public.tournaments FOR UPDATE
USING (
    community_id IN (
        SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
    )
);

-- 3. Allow ANY authenticated user to update participant placement
DROP POLICY IF EXISTS "Members can register for tournaments" ON public.tournament_participants;

CREATE POLICY "Members can update participants"
ON public.tournament_participants FOR UPDATE
USING (
    tournament_id IN (
        SELECT id FROM public.tournaments WHERE community_id IN (
            SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
        )
    )
);
