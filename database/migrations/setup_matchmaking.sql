-- ==========================================
-- MATCHMAKING QUEUE SYSTEM
-- ==========================================
-- Simple matchmaking queue for auto-pairing players

-- Create matchmaking_queue table
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    elo INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('searching', 'matched', 'cancelled')),
    matched_with UUID REFERENCES public.users(id) ON DELETE SET NULL,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT one_active_queue_per_user UNIQUE(user_id)
);

-- Create index for faster matchmaking queries
CREATE INDEX idx_matchmaking_queue_status ON public.matchmaking_queue(status, elo, created_at);
CREATE INDEX idx_matchmaking_queue_user ON public.matchmaking_queue(user_id);

-- Enable RLS
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue entry
CREATE POLICY "Users can view their own queue entry"
ON public.matchmaking_queue FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert themselves into the queue
CREATE POLICY "Users can join matchmaking queue"
ON public.matchmaking_queue FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own queue entry (for cancellation)
CREATE POLICY "Users can update their own queue entry"
ON public.matchmaking_queue FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own queue entry
CREATE POLICY "Users can delete their own queue entry"
ON public.matchmaking_queue FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================
-- MATCHMAKING FUNCTION
-- ==========================================
-- This function finds a suitable opponent and creates a room

CREATE OR REPLACE FUNCTION public.find_match(p_user_id UUID, p_user_elo INTEGER)
RETURNS TABLE (
    matched BOOLEAN,
    opponent_id UUID,
    opponent_username TEXT,
    opponent_elo INTEGER,
    room_id UUID,
    room_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_opponent_id UUID;
    v_opponent_username TEXT;
    v_opponent_elo INTEGER;
    v_queue_id UUID;
    v_room_id UUID;
    v_room_code TEXT;
    v_elo_range INTEGER := 200; -- Match within ±200 ELO
BEGIN
    -- Find a suitable opponent from the queue
    -- Prioritize closest ELO match
    SELECT
        mq.user_id,
        u.username,
        mq.elo,
        mq.id
    INTO
        v_opponent_id,
        v_opponent_username,
        v_opponent_elo,
        v_queue_id
    FROM public.matchmaking_queue mq
    JOIN public.users u ON u.id = mq.user_id
    WHERE
        mq.status = 'searching'
        AND mq.user_id != p_user_id
        AND ABS(mq.elo - p_user_elo) <= v_elo_range
    ORDER BY ABS(mq.elo - p_user_elo) ASC, mq.created_at ASC
    LIMIT 1;

    -- If opponent found, create a room and match them
    IF v_opponent_id IS NOT NULL THEN
        -- Generate room code
        v_room_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

        -- Create room
        INSERT INTO public.rooms (host_id, room_code, status)
        VALUES (p_user_id, v_room_code, 'waiting')
        RETURNING id INTO v_room_id;

        -- Add host to room
        INSERT INTO public.room_participants (room_id, user_id, is_host, is_ready)
        VALUES (v_room_id, p_user_id, true, true);

        -- Add opponent to room
        INSERT INTO public.room_participants (room_id, user_id, is_host, is_ready)
        VALUES (v_room_id, v_opponent_id, false, false);

        -- Update opponent's queue entry
        UPDATE public.matchmaking_queue
        SET
            status = 'matched',
            matched_with = p_user_id,
            room_id = v_room_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_queue_id;

        -- Delete current user's queue entry (they're matched)
        DELETE FROM public.matchmaking_queue WHERE user_id = p_user_id;

        RETURN QUERY SELECT
            true AS matched,
            v_opponent_id AS opponent_id,
            v_opponent_username AS opponent_username,
            v_opponent_elo AS opponent_elo,
            v_room_id AS room_id,
            v_room_code AS room_code;
    ELSE
        -- No match found, return false
        RETURN QUERY SELECT
            false AS matched,
            NULL::UUID AS opponent_id,
            NULL::TEXT AS opponent_username,
            NULL::INTEGER AS opponent_elo,
            NULL::UUID AS room_id,
            NULL::TEXT AS room_code;
    END IF;
END;
$$;

-- ==========================================
-- AUTO-CLEANUP FUNCTION
-- ==========================================
-- Remove stale queue entries (older than 5 minutes)

CREATE OR REPLACE FUNCTION public.cleanup_stale_queue_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.matchmaking_queue
    WHERE
        status = 'searching'
        AND created_at < (timezone('utc'::text, now()) - INTERVAL '5 minutes');
END;
$$;

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE 'Matchmaking system setup complete!';
    RAISE NOTICE '✅ Created matchmaking_queue table';
    RAISE NOTICE '✅ Created RLS policies';
    RAISE NOTICE '✅ Created find_match() function';
    RAISE NOTICE '✅ Created cleanup function for stale entries';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Add matchmaking functions to database.ts';
END $$;
