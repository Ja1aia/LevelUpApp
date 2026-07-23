-- ==========================================
-- FIX: Infinite Recursion in community_members RLS
-- ==========================================
-- This script fixes the circular policy references

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their community members" ON public.community_members;
DROP POLICY IF EXISTS "Users can leave or leaders can kick" ON public.community_members;
DROP POLICY IF EXISTS "Leaders can update member roles" ON public.community_members;

-- ==========================================
-- HELPER FUNCTION: Check if user is in community
-- ==========================================
-- Using SECURITY DEFINER to bypass RLS during the check
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

-- ==========================================
-- HELPER FUNCTION: Check if user is leader/co-leader
-- ==========================================
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

-- ==========================================
-- NEW RLS POLICIES (Non-recursive)
-- ==========================================

-- Users can view members of their own community
CREATE POLICY "Users can view their community members"
ON public.community_members FOR SELECT
USING (
    public.is_user_in_community(auth.uid(), community_id)
);

-- Users can leave (delete themselves) or leaders can kick members
CREATE POLICY "Users can leave or leaders can kick"
ON public.community_members FOR DELETE
USING (
    auth.uid() = user_id
    OR public.is_user_leader_in_community(auth.uid(), community_id)
);

-- Leaders can update member roles
CREATE POLICY "Leaders can update member roles"
ON public.community_members FOR UPDATE
USING (
    public.is_user_leader_in_community(auth.uid(), community_id)
);

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE 'Fixed infinite recursion in community_members RLS policies!';
    RAISE NOTICE '✅ Created security definer helper functions';
    RAISE NOTICE '✅ Replaced recursive policies with function-based policies';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now leave communities without errors.';
END $$;
