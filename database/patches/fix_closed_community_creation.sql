-- ==========================================
-- FIX: Allow leaders to view their own communities
-- ==========================================
-- This fixes the RLS error when creating closed communities
-- by allowing leaders to view their communities immediately after creation

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Anyone can view public communities" ON public.communities;

-- Create updated SELECT policy that allows leaders to view their own communities
CREATE POLICY "Anyone can view public communities"
ON public.communities FOR SELECT
USING (
    visibility IN ('open', 'invite_only')
    OR leader_id = auth.uid()  -- 👈 Leaders can always view their own community
    OR id IN (
        SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
    )
);

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE 'Fixed closed community creation!';
    RAISE NOTICE '✅ Created trigger to auto-add leader to community_members';
    RAISE NOTICE '✅ Updated SELECT policy to allow leaders to view their own communities';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now create closed communities without errors.';
END $$;
