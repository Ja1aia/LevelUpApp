-- ==========================================
-- FIX PERMISSIONS AND TRIGGERS
-- ==========================================
-- Run this script in Supabase SQL Editor to fix "new row violates row-level security policy" errors.

-- 1. Fix Triggers: Make them SECURITY DEFINER so they can update counts regardless of user role.
-- This allows normal members to join/leave communities and tournaments even if they can't "update" the community/tournament row directly.

CREATE OR REPLACE FUNCTION increment_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.communities
    SET member_count = member_count + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.community_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.communities
    SET member_count = member_count - 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = OLD.community_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_tournament_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.tournaments
    SET current_participants = current_participants + 1
    WHERE id = NEW.tournament_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_tournament_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.tournaments
    SET current_participants = current_participants - 1
    WHERE id = OLD.tournament_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix community_members INSERT policy
-- Allow users to join (self) OR Leaders to add members (for approving requests)

DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;
DROP POLICY IF EXISTS "Users can join or Leaders can add" ON public.community_members;

CREATE POLICY "Users can join or Leaders can add"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id -- User joining themselves
    OR
    is_community_admin(community_id) -- Leader adding a member (requires fix_rls.sql to be run first for this function)
);

-- Note: is_community_admin was defined in fix_rls.sql. 
-- If it doesn't exist, we recreate it here just in case:
CREATE OR REPLACE FUNCTION is_community_admin(check_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = check_community_id
    AND user_id = auth.uid()
    AND role IN ('leader', 'co_leader')
  );
$$;
