-- ==========================================
-- FINAL FIX (RUN THIS ONE SCRIPT)
-- ==========================================
-- This script combines all previous fixes into one guaranteed solution.
-- It fixes:
-- 1. Infinite recursion in RLS policies
-- 2. Permission errors when joining (Triggers)
-- 3. Incorrect member counts

-- ==========================================
-- 1. HELPER FUNCTIONS (SECURITY DEFINER)
-- ==========================================

-- Helper to get my communities (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_community_ids()
RETURNS TABLE (community_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT community_id
  FROM community_members
  WHERE user_id = auth.uid();
$$;

-- Helper to check admin status (bypasses RLS)
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

-- ==========================================
-- 2. TRIGGER FUNCTIONS (SECURITY DEFINER)
-- ==========================================
-- These MUST be SECURITY DEFINER to allow normal users to update member counts

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

-- ==========================================
-- 3. RE-APPLY POLICIES
-- ==========================================

-- Drop potentially broken policies
DROP POLICY IF EXISTS "Users can view their community members" ON public.community_members;
DROP POLICY IF EXISTS "Anyone can view public communities" ON public.communities;
DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;
DROP POLICY IF EXISTS "Users can join or Leaders can add" ON public.community_members;

-- COMMUNITIES SELECT
CREATE POLICY "Anyone can view public communities"
ON public.communities FOR SELECT
USING (
    visibility IN ('open', 'invite_only')
    OR id IN (SELECT get_my_community_ids())
);

-- COMMUNITY MEMBERS SELECT
CREATE POLICY "Users can view their community members"
ON public.community_members FOR SELECT
USING (
    community_id IN (SELECT get_my_community_ids())
    OR user_id = auth.uid() -- Critical: Allows user to see their own row immediately after joining
);

-- COMMUNITY MEMBERS INSERT (The critical one for joining)
CREATE POLICY "Users can join or Leaders can add"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id -- User joining themselves
    OR
    is_community_admin(community_id) -- Leader adding a member
);

-- COMMUNITY MEMBERS DELETE (Fixes recursion when leaving/kicking)
DROP POLICY IF EXISTS "Users can leave or leaders can kick" ON public.community_members;
CREATE POLICY "Users can leave or leaders can kick"
ON public.community_members FOR DELETE
USING (
    auth.uid() = user_id -- User leaving
    OR
    is_community_admin(community_id) -- Leader kicking
);

-- COMMUNITY MEMBERS UPDATE (Fixes recursion when changing roles)
DROP POLICY IF EXISTS "Leaders can update member roles" ON public.community_members;
CREATE POLICY "Leaders can update member roles"
ON public.community_members FOR UPDATE
USING (
    is_community_admin(community_id)
);

-- ==========================================
-- 4. FIX DATA (MEMBER COUNTS)
-- ==========================================

UPDATE public.communities c
SET member_count = (
    SELECT COUNT(*)
    FROM public.community_members cm
    WHERE cm.community_id = c.id
);

DO $$
BEGIN
    RAISE NOTICE '✅ Final fix applied successfully!';
END $$;
