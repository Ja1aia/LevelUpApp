-- Create game_invites table
CREATE TABLE IF NOT EXISTS public.game_invites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES public.users(id) NOT NULL,
    receiver_id UUID REFERENCES public.users(id) NOT NULL,
    room_id UUID REFERENCES public.rooms(id) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invites they sent or received
CREATE POLICY "Users can view their own invites"
ON public.game_invites FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policy: Users can insert invites (send invite)
CREATE POLICY "Users can insert invites"
ON public.game_invites FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Policy: Users can update invites (accept/reject)
CREATE POLICY "Users can update their own invites"
ON public.game_invites FOR UPDATE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_game_invites_sender ON public.game_invites(sender_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_receiver ON public.game_invites(receiver_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_status ON public.game_invites(status);
