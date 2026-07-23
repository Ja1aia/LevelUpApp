-- ==========================================
-- COMMUNITY SYSTEM SETUP
-- ==========================================
-- Run this script in Supabase SQL Editor
-- Creates tables for communities, tournaments, and competition features

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- DROP EXISTING TABLES (for clean reinstall)
-- ==========================================
DROP TABLE IF EXISTS public.tournament_matches CASCADE;
DROP TABLE IF EXISTS public.tournament_participants CASCADE;
DROP TABLE IF EXISTS public.tournaments CASCADE;
DROP TABLE IF EXISTS public.community_join_requests CASCADE;
DROP TABLE IF EXISTS public.community_invites CASCADE;
DROP TABLE IF EXISTS public.community_members CASCADE;
DROP TABLE IF EXISTS public.communities CASCADE;

-- ==========================================
-- TABLE 1: COMMUNITIES
-- ==========================================
CREATE TABLE public.communities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    badge TEXT DEFAULT '🏛️',
    leader_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    member_count INTEGER DEFAULT 1,
    max_members INTEGER DEFAULT 50,
    visibility TEXT NOT NULL CHECK (visibility IN ('open', 'invite_only', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT max_members_check CHECK (max_members >= member_count),
    CONSTRAINT max_members_limit CHECK (max_members >= 10 AND max_members <= 100),
    CONSTRAINT member_count_positive CHECK (member_count >= 0)
);

-- Indexes for communities
CREATE INDEX idx_communities_leader ON public.communities(leader_id);
CREATE INDEX idx_communities_name ON public.communities(name);
CREATE INDEX idx_communities_visibility ON public.communities(visibility);
CREATE INDEX idx_communities_created_at ON public.communities(created_at DESC);

-- ==========================================
-- TABLE 2: COMMUNITY MEMBERS
-- ==========================================
CREATE TABLE public.community_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('leader', 'co_leader', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    UNIQUE(user_id) -- One community per user (EXCLUSIVE MEMBERSHIP)
);

-- Indexes for community_members
CREATE INDEX idx_community_members_community ON public.community_members(community_id);
CREATE INDEX idx_community_members_user ON public.community_members(user_id);
CREATE INDEX idx_community_members_role ON public.community_members(community_id, role);
CREATE INDEX idx_community_members_joined ON public.community_members(joined_at DESC);

-- ==========================================
-- TABLE 3: COMMUNITY INVITES
-- ==========================================
CREATE TABLE public.community_invites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
    inviter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    invitee_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '7 days') NOT NULL,

    CONSTRAINT no_self_invite CHECK (inviter_id != invitee_id)
);

-- Indexes for community_invites
CREATE INDEX idx_community_invites_invitee ON public.community_invites(invitee_id, status);
CREATE INDEX idx_community_invites_community ON public.community_invites(community_id, status);
CREATE INDEX idx_community_invites_created ON public.community_invites(created_at DESC);

-- ==========================================
-- TABLE 4: COMMUNITY JOIN REQUESTS
-- ==========================================
CREATE TABLE public.community_join_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
    requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for community_join_requests
CREATE INDEX idx_join_requests_community ON public.community_join_requests(community_id, status);
CREATE INDEX idx_join_requests_requester ON public.community_join_requests(requester_id, status);
CREATE INDEX idx_join_requests_created ON public.community_join_requests(created_at DESC);

-- ==========================================
-- TABLE 5: TOURNAMENTS
-- ==========================================
CREATE TABLE public.tournaments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    format TEXT NOT NULL CHECK (format IN ('single_elimination', 'double_elimination', 'round_robin')),
    status TEXT NOT NULL CHECK (status IN ('registration', 'in_progress', 'completed', 'cancelled')),
    min_participants INTEGER DEFAULT 4,
    max_participants INTEGER DEFAULT 32,
    current_participants INTEGER DEFAULT 0,
    registration_ends_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    winner_id UUID REFERENCES public.users(id),
    created_by UUID REFERENCES public.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT participants_check CHECK (current_participants <= max_participants),
    CONSTRAINT participants_positive CHECK (current_participants >= 0),
    CONSTRAINT min_max_check CHECK (min_participants <= max_participants)
);

-- Indexes for tournaments
CREATE INDEX idx_tournaments_community ON public.tournaments(community_id, status);
CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_tournaments_created ON public.tournaments(created_at DESC);

-- ==========================================
-- TABLE 6: TOURNAMENT PARTICIPANTS
-- ==========================================
CREATE TABLE public.tournament_participants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    seed INTEGER,
    current_round INTEGER DEFAULT 1,
    is_eliminated BOOLEAN DEFAULT false,
    placement INTEGER,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    UNIQUE(tournament_id, user_id)
);

-- Indexes for tournament_participants
CREATE INDEX idx_tournament_participants_tournament ON public.tournament_participants(tournament_id);
CREATE INDEX idx_tournament_participants_user ON public.tournament_participants(user_id);
CREATE INDEX idx_tournament_participants_seed ON public.tournament_participants(tournament_id, seed);

-- ==========================================
-- TABLE 7: TOURNAMENT MATCHES
-- ==========================================
CREATE TABLE public.tournament_matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    player1_id UUID REFERENCES public.users(id),
    player2_id UUID REFERENCES public.users(id),
    room_id UUID REFERENCES public.rooms(id),
    game_result_id UUID REFERENCES public.game_results(id),
    winner_id UUID REFERENCES public.users(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'in_progress', 'completed', 'bye')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    UNIQUE(tournament_id, round_number, match_number)
);

-- Indexes for tournament_matches
CREATE INDEX idx_tournament_matches_tournament ON public.tournament_matches(tournament_id, round_number);
CREATE INDEX idx_tournament_matches_players ON public.tournament_matches(player1_id, player2_id);
CREATE INDEX idx_tournament_matches_status ON public.tournament_matches(tournament_id, status);
CREATE INDEX idx_tournament_matches_room ON public.tournament_matches(room_id);

-- ==========================================
-- TRIGGERS: AUTO-INCREMENT/DECREMENT MEMBER COUNT
-- ==========================================

-- Increment member_count when member joins
CREATE OR REPLACE FUNCTION increment_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.communities
    SET member_count = member_count + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.community_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_member_count
AFTER INSERT ON public.community_members
FOR EACH ROW EXECUTE FUNCTION increment_community_member_count();

-- Decrement member_count when member leaves
CREATE OR REPLACE FUNCTION decrement_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.communities
    SET member_count = member_count - 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = OLD.community_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrement_member_count
AFTER DELETE ON public.community_members
FOR EACH ROW EXECUTE FUNCTION decrement_community_member_count();

-- ==========================================
-- TRIGGERS: AUTO-INCREMENT/DECREMENT TOURNAMENT PARTICIPANTS
-- ==========================================

-- Increment tournament participant count
CREATE OR REPLACE FUNCTION increment_tournament_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.tournaments
    SET current_participants = current_participants + 1
    WHERE id = NEW.tournament_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_tournament_participants
AFTER INSERT ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION increment_tournament_participant_count();

-- Decrement tournament participant count
CREATE OR REPLACE FUNCTION decrement_tournament_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.tournaments
    SET current_participants = current_participants - 1
    WHERE id = OLD.tournament_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrement_tournament_participants
AFTER DELETE ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION decrement_tournament_participant_count();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES: COMMUNITIES
-- ==========================================

-- Anyone can view open and invite_only communities
CREATE POLICY "Anyone can view public communities"
ON public.communities FOR SELECT
USING (
    visibility IN ('open', 'invite_only')
    OR id IN (
        SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
    )
);

-- Authenticated users can create communities
CREATE POLICY "Authenticated users can create communities"
ON public.communities FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = leader_id);

-- Leaders can update their community
CREATE POLICY "Leaders can update their community"
ON public.communities FOR UPDATE
USING (leader_id = auth.uid());

-- Leaders can delete their community
CREATE POLICY "Leaders can delete their community"
ON public.communities FOR DELETE
USING (leader_id = auth.uid());

-- ==========================================
-- RLS POLICIES: COMMUNITY MEMBERS
-- ==========================================

-- Users can view their community's members
CREATE POLICY "Users can view their community members"
ON public.community_members FOR SELECT
USING (
    community_id IN (
        SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
    )
);

-- Users can insert themselves (joining)
CREATE POLICY "Users can join communities"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete themselves (leaving) or leaders can kick
CREATE POLICY "Users can leave or leaders can kick"
ON public.community_members FOR DELETE
USING (
    auth.uid() = user_id
    OR community_id IN (
        SELECT community_id FROM public.community_members
        WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
    )
);

-- Leaders can update member roles
CREATE POLICY "Leaders can update member roles"
ON public.community_members FOR UPDATE
USING (
    community_id IN (
        SELECT community_id FROM public.community_members
        WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
    )
);

-- ==========================================
-- RLS POLICIES: COMMUNITY INVITES
-- ==========================================

-- Users can view invites sent to them or sent by them
CREATE POLICY "Users can view their invites"
ON public.community_invites FOR SELECT
USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

-- Leaders can send invites
CREATE POLICY "Leaders can send invites"
ON public.community_invites FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = inviter_id
    AND community_id IN (
        SELECT community_id FROM public.community_members
        WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
    )
);

-- Invitees can update their invite status
CREATE POLICY "Invitees can update invite status"
ON public.community_invites FOR UPDATE
USING (invitee_id = auth.uid());

-- ==========================================
-- RLS POLICIES: COMMUNITY JOIN REQUESTS
-- ==========================================

-- Requesters can view their own requests
CREATE POLICY "Users can view their join requests"
ON public.community_join_requests FOR SELECT
USING (
    requester_id = auth.uid()
    OR community_id IN (
        SELECT community_id FROM public.community_members
        WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
    )
);

-- Authenticated users can create join requests
CREATE POLICY "Users can create join requests"
ON public.community_join_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

-- Leaders can update join request status
CREATE POLICY "Leaders can update join requests"
ON public.community_join_requests FOR UPDATE
USING (
    community_id IN (
        SELECT community_id FROM public.community_members
        WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
    )
);

-- Requesters can delete their own pending requests
CREATE POLICY "Users can delete their pending requests"
ON public.community_join_requests FOR DELETE
USING (requester_id = auth.uid() AND status = 'pending');

-- ==========================================
-- RLS POLICIES: TOURNAMENTS
-- ==========================================

-- Community members can view their community's tournaments
CREATE POLICY "Community members can view tournaments"
ON public.tournaments FOR SELECT
USING (
    community_id IN (
        SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
    )
);

-- Leaders can create tournaments
CREATE POLICY "Leaders can create tournaments"
ON public.tournaments FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = created_by
    AND community_id IN (
        SELECT community_id FROM public.community_members
        WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
    )
);

-- Leaders can update tournaments
CREATE POLICY "Leaders can update tournaments"
ON public.tournaments FOR UPDATE
USING (
    community_id IN (
        SELECT community_id FROM public.community_members
        WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
    )
);

-- ==========================================
-- RLS POLICIES: TOURNAMENT PARTICIPANTS
-- ==========================================

-- Community members can view tournament participants
CREATE POLICY "Community members can view participants"
ON public.tournament_participants FOR SELECT
USING (
    tournament_id IN (
        SELECT id FROM public.tournaments WHERE community_id IN (
            SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
        )
    )
);

-- Community members can register themselves
CREATE POLICY "Members can register for tournaments"
ON public.tournament_participants FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND tournament_id IN (
        SELECT id FROM public.tournaments WHERE community_id IN (
            SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
        )
    )
);

-- Users can unregister themselves
CREATE POLICY "Users can unregister from tournaments"
ON public.tournament_participants FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================
-- RLS POLICIES: TOURNAMENT MATCHES
-- ==========================================

-- Community members can view tournament matches
CREATE POLICY "Community members can view matches"
ON public.tournament_matches FOR SELECT
USING (
    tournament_id IN (
        SELECT id FROM public.tournaments WHERE community_id IN (
            SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
        )
    )
);

-- Leaders can insert matches (bracket generation)
CREATE POLICY "Leaders can create matches"
ON public.tournament_matches FOR INSERT
TO authenticated
WITH CHECK (
    tournament_id IN (
        SELECT id FROM public.tournaments WHERE community_id IN (
            SELECT community_id FROM public.community_members
            WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
        )
    )
);

-- Match players can update match (link room, result)
CREATE POLICY "Players can update their matches"
ON public.tournament_matches FOR UPDATE
USING (
    auth.uid() IN (player1_id, player2_id)
    OR tournament_id IN (
        SELECT id FROM public.tournaments WHERE community_id IN (
            SELECT community_id FROM public.community_members
            WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
        )
    )
);

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE 'Community system setup complete!';
    RAISE NOTICE '✅ Created 7 tables: communities, community_members, community_invites, community_join_requests, tournaments, tournament_participants, tournament_matches';
    RAISE NOTICE '✅ Created triggers for auto-counting members and participants';
    RAISE NOTICE '✅ Configured Row Level Security policies';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Add API functions to src/services/database.ts';
    RAISE NOTICE '2. Create UI screens for community features';
    RAISE NOTICE '3. Test all three visibility modes: open, invite_only, closed';
END $$;
