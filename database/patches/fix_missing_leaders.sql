-- ==========================================
-- FIX MISSING LEADERS
-- ==========================================
-- Run this script to ensure all community leaders are actually members of their communities.
-- This fixes the issue where you created a community but got an error, leaving you as leader but not a member.

INSERT INTO public.community_members (community_id, user_id, role)
SELECT c.id, c.leader_id, 'leader'
FROM public.communities c
WHERE NOT EXISTS (
    SELECT 1
    FROM public.community_members cm
    WHERE cm.community_id = c.id
    AND cm.user_id = c.leader_id
);

-- Also ensure they are marked as 'leader' if they are members but with wrong role
UPDATE public.community_members cm
SET role = 'leader'
FROM public.communities c
WHERE cm.community_id = c.id
AND cm.user_id = c.leader_id
AND cm.role != 'leader';

-- Finally, fix the member counts again just in case
UPDATE public.communities c
SET member_count = (
    SELECT COUNT(*)
    FROM public.community_members cm
    WHERE cm.community_id = c.id
);
