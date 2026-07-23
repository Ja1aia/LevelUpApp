-- ==========================================
-- FIX MEMBER COUNTS
-- ==========================================
-- Run this script in Supabase SQL Editor to fix incorrect member counts.

-- Recalculate member_count for all communities based on the actual number of rows in community_members
UPDATE public.communities c
SET member_count = (
    SELECT COUNT(*)
    FROM public.community_members cm
    WHERE cm.community_id = c.id
);

-- Verify the fix
SELECT name, member_count FROM public.communities;
