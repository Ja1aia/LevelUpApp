-- ==========================================
-- COMPREHENSIVE RLS FIX
-- ==========================================
-- This script fixes ALL circular reference issues in RLS policies
-- Run this script ONCE in Supabase SQL Editor

-- ==========================================
-- STEP 1: Create Helper Functions
-- ==========================================

-- Check if user is in a specific community
CREATE OR REPLACE FUNCTION public.is_user_in_community(p_user_id UUID, p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.community_members
        WHERE user_id = p_user_id AND community_id = p_community_id
    );
$$;

-- Check if user is leader/co-leader in a specific community
CREATE OR REPLACE FUNCTION public.is_user_leader_in_community(p_user_id UUID, p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.community_members
        WHERE user_id = p_user_id
        AND community_id = p_community_id
        AND role IN ('leader', 'co_leader')
    );
$$;

-- Get user's community ID (since users can only be in one community)
CREATE OR REPLACE FUNCTION public.get_user_community_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT community_id FROM public.community_members
    WHERE user_id = p_user_id
    LIMIT 1;
$$;

-- ==========================================
-- STEP 2: Fix COMMUNITY_MEMBERS Policies
-- ==========================================

DROP POLICY IF EXISTS "Users can view their community members" ON public.community_members;
DROP POLICY IF EXISTS "Users can leave or leaders can kick" ON public.community_members;
DROP POLICY IF EXISTS "Leaders can update member roles" ON public.community_members;

CREATE POLICY "Users can view their community members"
ON public.community_members FOR SELECT
USING (
    public.is_user_in_community(auth.uid(), community_id)
);

CREATE POLICY "Users can leave or leaders can kick"
ON public.community_members FOR DELETE
USING (
    auth.uid() = user_id
    OR public.is_user_leader_in_community(auth.uid(), community_id)
);

CREATE POLICY "Leaders can update member roles"
ON public.community_members FOR UPDATE
USING (
    public.is_user_leader_in_community(auth.uid(), community_id)
);

-- ==========================================
-- STEP 3: Fix TOURNAMENTS Policies
-- ==========================================

DROP POLICY IF EXISTS "Community members can view tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Leaders can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Leaders can update tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Members can update tournaments" ON public.tournaments;

CREATE POLICY "Community members can view tournaments"
ON public.tournaments FOR SELECT
USING (
    community_id = public.get_user_community_id(auth.uid())
);

CREATE POLICY "Leaders can create tournaments"
ON public.tournaments FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = created_by
    AND community_id = public.get_user_community_id(auth.uid())
    AND public.is_user_leader_in_community(auth.uid(), community_id)
);

CREATE POLICY "Leaders can update tournaments"
ON public.tournaments FOR UPDATE
USING (
    public.is_user_leader_in_community(auth.uid(), community_id)
);

-- ==========================================
-- STEP 4: Fix TOURNAMENT_PARTICIPANTS Policies
-- ==========================================

DROP POLICY IF EXISTS "Community members can view participants" ON public.tournament_participants;
DROP POLICY IF EXISTS "Members can register for tournaments" ON public.tournament_participants;
DROP POLICY IF EXISTS "Members can update participants" ON public.tournament_participants;

CREATE POLICY "Community members can view participants"
ON public.tournament_participants FOR SELECT
USING (
    tournament_id IN (
        SELECT id FROM public.tournaments
        WHERE community_id = public.get_user_community_id(auth.uid())
    )
);

CREATE POLICY "Members can register for tournaments"
ON public.tournament_participants FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND tournament_id IN (
        SELECT id FROM public.tournaments
        WHERE community_id = public.get_user_community_id(auth.uid())
    )
);

CREATE POLICY "Members can update participants"
ON public.tournament_participants FOR UPDATE
USING (
    tournament_id IN (
        SELECT id FROM public.tournaments
        WHERE community_id = public.get_user_community_id(auth.uid())
    )
);

-- ==========================================
-- STEP 5: Fix TOURNAMENT_MATCHES Policies
-- ==========================================

DROP POLICY IF EXISTS "Community members can view matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Leaders can create matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Participants can create matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Players can update their matches" ON public.tournament_matches;

CREATE POLICY "Community members can view matches"
ON public.tournament_matches FOR SELECT
USING (
    tournament_id IN (
        SELECT id FROM public.tournaments
        WHERE community_id = public.get_user_community_id(auth.uid())
    )
);

CREATE POLICY "Participants can create matches"
ON public.tournament_matches FOR INSERT
TO authenticated
WITH CHECK (
    tournament_id IN (
        SELECT id FROM public.tournaments
        WHERE community_id = public.get_user_community_id(auth.uid())
    )
);

CREATE POLICY "Players can update their matches"
ON public.tournament_matches FOR UPDATE
USING (
    auth.uid() IN (player1_id, player2_id)
    OR tournament_id IN (
        SELECT t.id FROM public.tournaments t
        WHERE t.community_id = public.get_user_community_id(auth.uid())
        AND public.is_user_leader_in_community(auth.uid(), t.community_id)
    )
);

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================

