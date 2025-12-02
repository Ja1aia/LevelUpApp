-- Create friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id_1 UUID REFERENCES public.users(id) NOT NULL,
    user_id_2 UUID REFERENCES public.users(id) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id_1, user_id_2)
);

-- Add RLS policies
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own friendships
CREATE POLICY "Users can view their own friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Policy: Users can insert friendships (send request)
-- user_id_1 is always the sender
CREATE POLICY "Users can insert friendships"
ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = user_id_1);

-- Policy: Users can update their own friendships (accept/block)
CREATE POLICY "Users can update their own friendships"
ON public.friendships FOR UPDATE
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Policy: Users can delete their own friendships (unfriend/cancel)
CREATE POLICY "Users can delete their own friendships"
ON public.friendships FOR DELETE
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_friendships_user_1 ON public.friendships(user_id_1);
CREATE INDEX IF NOT EXISTS idx_friendships_user_2 ON public.friendships(user_id_2);
