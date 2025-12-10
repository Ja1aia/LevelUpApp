import { supabase } from '../lib/supabase';
import { Question } from '../types';

/**
 * Database Service
 * Helper functions untuk semua database operations
 */

// ==================== USERS ====================

/**
 * Get or create user by username
 * Kalau user sudah ada, return existing user
 * Kalau belum ada, create new user
 */
export async function getOrCreateUser(username: string) {
  try {
    // Check if user exists
    const { data: existing, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (existing) {
      console.log('User found:', existing);
      return { data: existing, error: null };
    }

    // User doesn't exist, create new
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        username,
        elo: 1200, // Starting ELO
        avatar: '😊',
        total_games: 0,
        wins: 0,
        losses: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError);
      return { data: null, error: insertError };
    }

    console.log('User created:', newUser);
    return { data: newUser, error: null };
  } catch (error) {
    console.error('getOrCreateUser error:', error);
    return { data: null, error };
  }
}

/**
 * Update user stats after game
 */
export async function updateUserStats(
  userId: string,
  won: boolean,
  eloChange: number
) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('elo, total_games, wins, losses')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({
        elo: data.elo + eloChange,
        total_games: data.total_games + 1,
        wins: won ? data.wins + 1 : data.wins,
        losses: won ? data.losses : data.losses + 1,
      })
      .eq('id', userId)
      .select()
      .single();

    return { data: updated, error: updateError };
  } catch (error) {
    console.error('updateUserStats error:', error);
    return { data: null, error };
  }
}

// ==================== QUESTIONS ====================

/**
 * Get 5 questions based on user ELO
 * Returns questions closest to user's ELO
 */
export async function getQuestionsByElo(userElo: number): Promise<Question[]> {
  try {
    // Use RPC to get questions sorted by ELO proximity on the server
    const { data, error } = await supabase.rpc('get_questions_by_elo', {
      user_elo: userElo,
      limit_count: 5
    });

    if (error) throw error;

    if (!data || data.length === 0) return [];

    // Map to Question type
    return data.map((q: any) => ({
      id: q.id,
      question: q.question_text,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      correctAnswer: q.correct_answer,
      topic: q.topic
    }));
  } catch (error) {
    console.error('getQuestionsByElo error:', error);
    return [];
  }
}

// ==================== ROOMS ====================

/**
 * Create new room
 * Returns room with unique room code
 */
export async function createRoom(hostId: string, roomCode: string) {
  try {
    // 1. Get host ELO
    const { data: host } = await supabase
      .from('users')
      .select('elo')
      .eq('id', hostId)
      .single();

    const hostElo = host?.elo || 1200;

    // 2. Get questions for this match
    const questions = await getQuestionsByElo(hostElo);

    // 3. Create room with questions
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        host_id: hostId,
        status: 'waiting',
        questions: questions // Store the selected questions
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating room:', error);
      return { data: null, error };
    }

    console.log('Room created:', data);
    return { data, error: null };
  } catch (error) {
    console.error('createRoom error:', error);
    return { data: null, error };
  }
}

/**
 * Join existing room by room code
 */
export async function joinRoom(roomCode: string, guestId: string) {
  try {
    // Find room by code
    const { data: room, error: fetchError } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode)
      .eq('status', 'waiting')
      .single();

    if (fetchError || !room) {
      console.error('Room not found or already started');
      return { data: null, error: fetchError || new Error('Room not found') };
    }

    // Update room with guest and change status
    const { data: updated, error: updateError } = await supabase
      .from('rooms')
      .update({
        guest_id: guestId,
        status: 'playing',
        started_at: new Date().toISOString(),
      })
      .eq('id', room.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error joining room:', updateError);
      return { data: null, error: updateError };
    }

    console.log('Joined room:', updated);
    return { data: updated, error: null };
  } catch (error) {
    console.error('joinRoom error:', error);
    return { data: null, error };
  }
}

/**
 * Get room by ID
 */
export async function getRoom(roomId: string) {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    return { data, error };
  } catch (error) {
    console.error('getRoom error:', error);
    return { data: null, error };
  }
}

/**
 * Update room status
 */
export async function updateRoomStatus(
  roomId: string,
  status: 'waiting' | 'playing' | 'finished'
) {
  try {
    const updates: any = { status };

    if (status === 'finished') {
      updates.finished_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', roomId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('updateRoomStatus error:', error);
    return { data: null, error };
  }
}

// ==================== STATS ====================

/**
 * Update user topic stats
 */
export async function updateTopicStats(
  userId: string,
  topic: string,
  isCorrect: boolean
) {
  try {
    // Check if stat exists
    const { data: existing } = await supabase
      .from('user_topic_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('topic', topic)
      .single();

    if (existing) {
      // Update existing
      await supabase
        .from('user_topic_stats')
        .update({
          total_answered: existing.total_answered + 1,
          total_correct: existing.total_correct + (isCorrect ? 1 : 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase
        .from('user_topic_stats')
        .insert({
          user_id: userId,
          topic,
          total_answered: 1,
          total_correct: isCorrect ? 1 : 0,
        });
    }
  } catch (error) {
    console.error('updateTopicStats error:', error);
  }
}

// ==================== GAME SESSIONS ====================

/**
 * Save player answer for a question
 * Uses upsert pattern to prevent race conditions
 */
export async function saveAnswer(
  roomId: string,
  questionIndex: number,
  playerId: string,
  answer: number,
  timeSpent: number,
  isCorrect: boolean
) {
  try {
    // Get room to determine if player is player1 or player2
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, guest_id, questions')
      .eq('id', roomId)
      .single();

    if (!room) throw new Error('Room not found');

    const isPlayer1 = room.host_id === playerId;

    // Player-specific column updates
    const playerData = isPlayer1
      ? {
        player1_answer: answer,
        player1_time: timeSpent,
        player1_correct: isCorrect,
      }
      : {
        player2_answer: answer,
        player2_time: timeSpent,
        player2_correct: isCorrect,
      };

    // Try to insert first
    const { data: inserted, error: insertError } = await supabase
      .from('game_sessions')
      .insert({
        room_id: roomId,
        question_index: questionIndex,
        ...playerData,
      })
      .select()
      .single();

    // Update Topic Stats
    // We need to find the topic of the question.
    // The questions are stored in the room.
    if (room.questions) {
      const questions = typeof room.questions === 'string'
        ? JSON.parse(room.questions)
        : room.questions;

      const question = questions[questionIndex];
      if (question && question.topic) {
        // Fire and forget - don't await to avoid blocking game flow
        updateTopicStats(playerId, question.topic, isCorrect);
      }
    }

    // If insert succeeds, return
    if (!insertError) {
      console.log('✅ Answer inserted successfully');
      return { data: inserted, error: null };
    }

    // If insert fails due to unique constraint, update instead
    if (insertError.code === '23505') { // Unique violation
      console.log('⚠️ Answer exists, updating...');
      const { data: updated, error: updateError } = await supabase
        .from('game_sessions')
        .update(playerData)
        .eq('room_id', roomId)
        .eq('question_index', questionIndex)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating answer:', updateError);
        return { data: null, error: updateError };
      }

      return { data: updated, error: null };
    }

    console.error('Error saving answer:', insertError);
    return { data: null, error: insertError };
  } catch (error) {
    console.error('saveAnswer error:', error);
    return { data: null, error };
  }
}

// ==================== FRIENDS ====================

/**
 * Send friend request
 */
export async function sendFriendRequest(userId: string, targetUsername: string) {
  try {
    // 1. Find target user
    const { data: targetUser, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('username', targetUsername)
      .single();

    if (findError || !targetUser) {
      return { data: null, error: new Error('User not found') };
    }

    if (targetUser.id === userId) {
      return { data: null, error: new Error('You cannot add yourself') };
    }

    // 2. Check if request already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id_1.eq.${userId},user_id_2.eq.${targetUser.id}),and(user_id_1.eq.${targetUser.id},user_id_2.eq.${userId})`)
      .single();

    if (existing) {
      if (existing.status === 'accepted') {
        return { data: null, error: new Error('Already friends') };
      }
      if (existing.status === 'pending') {
        return { data: null, error: new Error('Friend request already pending') };
      }
    }

    // 3. Create request
    const { data, error } = await supabase
      .from('friendships')
      .insert({
        user_id_1: userId,
        user_id_2: targetUser.id,
        status: 'pending'
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('sendFriendRequest error:', error);
    return { data: null, error };
  }
}

/**
 * Accept friend request
 */
export async function acceptFriendRequest(requestId: string) {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', requestId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('acceptFriendRequest error:', error);
    return { data: null, error };
  }
}

/**
 * Reject/Cancel friend request or Unfriend
 */
export async function removeFriend(requestId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', requestId);

    return { error };
  } catch (error) {
    console.error('removeFriend error:', error);
    return { error };
  }
}

/**
 * Get friends list
 */
export async function getFriends(userId: string) {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id_1,
        user_id_2,
        status,
        user1:users!friendships_user_id_1_fkey(id, username, elo, avatar),
        user2:users!friendships_user_id_2_fkey(id, username, elo, avatar)
      `)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .eq('status', 'accepted');

    if (error) throw error;

    // Transform data to get the OTHER user
    const friends = data.map((f: any) => {
      const isUser1 = f.user_id_1 === userId;
      const friendData = isUser1 ? f.user2 : f.user1;
      return {
        friendshipId: f.id,
        ...friendData
      };
    });

    return { data: friends, error: null };
  } catch (error) {
    console.error('getFriends error:', error);
    return { data: [], error };
  }
}

/**
 * Get pending friend requests
 */
export async function getFriendRequests(userId: string) {
  try {
    // Incoming requests: user_id_2 is me, status is pending
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id_1,
        created_at,
        sender:users!friendships_user_id_1_fkey(id, username, elo, avatar)
      `)
      .eq('user_id_2', userId)
      .eq('status', 'pending');

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('getFriendRequests error:', error);
    return { data: [], error };
  }
}

// ==================== GAME INVITES ====================

/**
 * Create game invite
 */
export async function createGameInvite(senderId: string, receiverId: string, roomId: string) {
  try {
    const { data, error } = await supabase
      .from('game_invites')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        room_id: roomId,
        status: 'pending'
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('createGameInvite error:', error);
    return { data: null, error };
  }
}

/**
 * Get pending game invites for user
 */
export async function getGameInvites(userId: string) {
  try {
    const { data, error } = await supabase
      .from('game_invites')
      .select(`
        id,
        sender_id,
        room_id,
        created_at,
        sender:users!game_invites_sender_id_fkey(id, username, elo, avatar),
        room:rooms!game_invites_room_id_fkey(room_code)
      `)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('getGameInvites error:', error);
    return { data: [], error };
  }
}

/**
 * Respond to game invite
 */
export async function respondToGameInvite(inviteId: string, status: 'accepted' | 'rejected' | 'expired') {
  try {
    const { data, error } = await supabase
      .from('game_invites')
      .update({ status })
      .eq('id', inviteId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('respondToGameInvite error:', error);
    return { data: null, error };
  }
}
/**
 * Get Leaderboard (Top 50 by ELO)
 */
export async function getLeaderboard(limit: number = 50) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, elo, avatar')
      .order('elo', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('getLeaderboard error:', error);
    return { data: [], error };
  }
}

// ==================== COMMUNITIES ====================

/**
 * Create new community (user becomes leader)
 */
export async function createCommunity(
  userId: string,
  name: string,
  description: string,
  badge: string,
  maxMembers: number,
  visibility: 'open' | 'invite_only' | 'closed'
) {
  try {
    // 1. Check if user is already in a community
    const { data: existingMember } = await supabase
      .from('community_members')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      return { data: null, error: new Error('You are already in a community. Leave your current community first.') };
    }

    // 2. Create community
    const { data: community, error: createError } = await supabase
      .from('communities')
      .insert({
        name,
        description,
        badge,
        leader_id: userId,
        max_members: maxMembers,
        visibility,
        member_count: 0 // Start at 0, trigger will increment to 1 when leader is added
      })
      .select()
      .single();

    if (createError) return { data: null, error: createError };

    // 3. Add creator as leader member
    const { error: memberError } = await supabase
      .from('community_members')
      .insert({
        community_id: community.id,
        user_id: userId,
        role: 'leader'
      });

    if (memberError) {
      // Rollback: delete community if member creation fails
      await supabase.from('communities').delete().eq('id', community.id);
      return { data: null, error: memberError };
    }

    return { data: community, error: null };
  } catch (error) {
    console.error('createCommunity error:', error);
    return { data: null, error };
  }
}

/**
 * Search communities (browse open and invite_only communities)
 */
export async function searchCommunities(searchTerm: string = '') {
  try {
    let query = supabase
      .from('communities')
      .select(`
        id,
        name,
        description,
        badge,
        member_count,
        max_members,
        visibility,
        leader:users!communities_leader_id_fkey(username, elo, avatar)
      `)
      .in('visibility', ['open', 'invite_only'])
      .order('member_count', { ascending: false });

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }

    const { data, error } = await query;
    return { data, error };
  } catch (error) {
    console.error('searchCommunities error:', error);
    return { data: [], error };
  }
}

/**
 * Get user's current community
 */
export async function getUserCommunity(userId: string) {
  try {
    const { data, error } = await supabase
      .from('community_members')
      .select(`
        id,
        role,
        joined_at,
        community:communities(
          id,
          name,
          description,
          badge,
          leader_id,
          member_count,
          max_members,
          visibility,
          created_at
        )
      `)
      .eq('user_id', userId)
      .single();

    return { data, error };
  } catch (error) {
    console.error('getUserCommunity error:', error);
    return { data: null, error };
  }
}

/**
 * Get community details with members
 */
export async function getCommunityDetails(communityId: string) {
  try {
    // Get community info
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select(`
        id,
        name,
        description,
        badge,
        leader_id,
        member_count,
        max_members,
        visibility,
        created_at
      `)
      .eq('id', communityId)
      .single();

    if (communityError) return { data: null, error: communityError };

    // Get members
    const { data: members, error: membersError } = await supabase
      .from('community_members')
      .select(`
        id,
        role,
        joined_at,
        user:users(id, username, elo, avatar)
      `)
      .eq('community_id', communityId)
      .order('joined_at', { ascending: true });

    if (membersError) return { data: null, error: membersError };

    return {
      data: {
        ...community,
        members: members.map((m: any) => ({
          membershipId: m.id,
          role: m.role,
          joined_at: m.joined_at,
          ...m.user
        }))
      },
      error: null
    };
  } catch (error) {
    console.error('getCommunityDetails error:', error);
    return { data: null, error };
  }
}

/**
 * Join community (open communities only)
 */
export async function joinCommunity(userId: string, communityId: string) {
  try {
    // 1. Check if user is already in a community
    const { data: existingMember } = await supabase
      .from('community_members')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      return { data: null, error: new Error('You are already in a community') };
    }

    // 2. Check community visibility and capacity
    const { data: community } = await supabase
      .from('communities')
      .select('visibility, member_count, max_members')
      .eq('id', communityId)
      .single();

    if (!community) {
      return { data: null, error: new Error('Community not found') };
    }

    if (community.visibility !== 'open') {
      return { data: null, error: new Error('This community requires an invitation') };
    }

    if (community.member_count >= community.max_members) {
      return { data: null, error: new Error('Community is full') };
    }

    // 3. Add user to community
    const { data, error } = await supabase
      .from('community_members')
      .insert({
        community_id: communityId,
        user_id: userId,
        role: 'member'
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('joinCommunity error:', error);
    return { data: null, error };
  }
}

/**
 * Leave community
 */
export async function leaveCommunity(userId: string) {
  try {
    // Check if user is leader
    const { data: membership } = await supabase
      .from('community_members')
      .select('role, community_id')
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return { error: new Error('You are not in a community') };
    }

    if (membership.role === 'leader') {
      return { error: new Error('Leaders cannot leave. Transfer leadership or disband the community first.') };
    }

    // Delete membership
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('user_id', userId);

    return { error };
  } catch (error) {
    console.error('leaveCommunity error:', error);
    return { error };
  }
}

/**
 * Disband community (leader only)
 */
export async function disbandCommunity(communityId: string, userId: string) {
  try {
    // Verify user is leader
    const { data: community } = await supabase
      .from('communities')
      .select('leader_id')
      .eq('id', communityId)
      .single();

    if (!community || community.leader_id !== userId) {
      return { error: new Error('Only the leader can disband the community') };
    }

    // Delete community (cascade will delete members, invites, tournaments)
    const { error } = await supabase
      .from('communities')
      .delete()
      .eq('id', communityId);

    return { error };
  } catch (error) {
    console.error('disbandCommunity error:', error);
    return { error };
  }
}

/**
 * Update community settings (leader only)
 */
export async function updateCommunitySettings(
  communityId: string,
  userId: string,
  settings: {
    name?: string;
    description?: string;
    badge?: string;
    max_members?: number;
    visibility?: 'open' | 'invite_only' | 'closed';
  }
) {
  try {
    // Verify user is leader
    const { data: community } = await supabase
      .from('communities')
      .select('leader_id')
      .eq('id', communityId)
      .single();

    if (!community || community.leader_id !== userId) {
      return { data: null, error: new Error('Only the leader can update community settings') };
    }

    // Update community
    const { data, error } = await supabase
      .from('communities')
      .update({
        ...settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', communityId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('updateCommunitySettings error:', error);
    return { data: null, error };
  }
}

// ==================== COMMUNITY MEMBERS ====================

/**
 * Send community invite (leader/co-leader only)
 */
export async function sendCommunityInvite(
  inviterId: string,
  inviteeUsername: string,
  communityId: string
) {
  try {
    // 1. Verify inviter has permission
    const { data: inviter } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', inviterId)
      .single();

    if (!inviter || (inviter.role !== 'leader' && inviter.role !== 'co_leader')) {
      return { data: null, error: new Error('Only leaders and co-leaders can send invites') };
    }

    // 2. Find invitee
    const { data: invitee, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('username', inviteeUsername)
      .single();

    if (findError || !invitee) {
      return { data: null, error: new Error('User not found') };
    }

    // 3. Check if invitee is already in a community
    const { data: existingMember } = await supabase
      .from('community_members')
      .select('id')
      .eq('user_id', invitee.id)
      .single();

    if (existingMember) {
      return { data: null, error: new Error('User is already in a community') };
    }

    // 4. Check if community is full
    const { data: community } = await supabase
      .from('communities')
      .select('member_count, max_members')
      .eq('id', communityId)
      .single();

    if (community && community.member_count >= community.max_members) {
      return { data: null, error: new Error('Community is full') };
    }

    // 5. Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from('community_invites')
      .select('id')
      .eq('invitee_id', invitee.id)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return { data: null, error: new Error('User already has a pending invite') };
    }

    // 6. Create invite
    const { data, error } = await supabase
      .from('community_invites')
      .insert({
        community_id: communityId,
        inviter_id: inviterId,
        invitee_id: invitee.id,
        status: 'pending'
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('sendCommunityInvite error:', error);
    return { data: null, error };
  }
}

/**
 * Get community invites for user
 */
export async function getCommunityInvites(userId: string) {
  try {
    const { data, error } = await supabase
      .from('community_invites')
      .select(`
        id,
        created_at,
        expires_at,
        inviter:users!community_invites_inviter_id_fkey(username, elo, avatar),
        community:communities(id, name, badge, member_count, max_members)
      `)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    console.error('getCommunityInvites error:', error);
    return { data: [], error };
  }
}

/**
 * Accept community invite
 */
export async function acceptCommunityInvite(inviteId: string, userId: string) {
  try {
    // 1. Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from('community_invites')
      .select('community_id, invitee_id, expires_at')
      .eq('id', inviteId)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) {
      return { data: null, error: new Error('Invite not found or expired') };
    }

    if (invite.invitee_id !== userId) {
      return { data: null, error: new Error('Unauthorized') };
    }

    // 2. Check if user is already in a community
    const { data: existingMember } = await supabase
      .from('community_members')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      await supabase
        .from('community_invites')
        .update({ status: 'expired' })
        .eq('id', inviteId);
      return { data: null, error: new Error('You are already in a community') };
    }

    // 3. Check if community is full
    const { data: community } = await supabase
      .from('communities')
      .select('member_count, max_members')
      .eq('id', invite.community_id)
      .single();

    if (community && community.member_count >= community.max_members) {
      await supabase
        .from('community_invites')
        .update({ status: 'expired' })
        .eq('id', inviteId);
      return { data: null, error: new Error('Community is full') };
    }

    // 4. Add user to community
    const { data: member, error: memberError } = await supabase
      .from('community_members')
      .insert({
        community_id: invite.community_id,
        user_id: userId,
        role: 'member'
      })
      .select()
      .single();

    if (memberError) return { data: null, error: memberError };

    // 5. Update invite status
    await supabase
      .from('community_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);

    return { data: member, error: null };
  } catch (error) {
    console.error('acceptCommunityInvite error:', error);
    return { data: null, error };
  }
}

/**
 * Reject community invite
 */
export async function rejectCommunityInvite(inviteId: string) {
  try {
    const { error } = await supabase
      .from('community_invites')
      .update({ status: 'rejected' })
      .eq('id', inviteId);

    return { error };
  } catch (error) {
    console.error('rejectCommunityInvite error:', error);
    return { error };
  }
}

/**
 * Request to join community (invite-only communities)
 */
export async function requestToJoinCommunity(
  userId: string,
  communityId: string,
  message: string = ''
) {
  try {
    // 1. Check if user is already in a community
    const { data: existingMember } = await supabase
      .from('community_members')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      return { data: null, error: new Error('You are already in a community') };
    }

    // 2. Check community visibility
    const { data: community } = await supabase
      .from('communities')
      .select('visibility, member_count, max_members')
      .eq('id', communityId)
      .single();

    if (!community) {
      return { data: null, error: new Error('Community not found') };
    }

    if (community.visibility === 'closed') {
      return { data: null, error: new Error('This community is closed. You can only join via invitation.') };
    }

    if (community.member_count >= community.max_members) {
      return { data: null, error: new Error('Community is full') };
    }

    // 3. Check for existing pending request
    const { data: existingRequest } = await supabase
      .from('community_join_requests')
      .select('id')
      .eq('requester_id', userId)
      .eq('community_id', communityId)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return { data: null, error: new Error('You already have a pending request for this community') };
    }

    // 4. Create request
    const { data, error } = await supabase
      .from('community_join_requests')
      .insert({
        community_id: communityId,
        requester_id: userId,
        status: 'pending',
        message
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('requestToJoinCommunity error:', error);
    return { data: null, error };
  }
}

/**
 * Get join requests for community (leader view)
 */
export async function getJoinRequests(communityId: string) {
  try {
    const { data, error } = await supabase
      .from('community_join_requests')
      .select(`
        id,
        message,
        created_at,
        requester:users!community_join_requests_requester_id_fkey(id, username, elo, avatar)
      `)
      .eq('community_id', communityId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    console.error('getJoinRequests error:', error);
    return { data: [], error };
  }
}

/**
 * Get user's pending join requests
 */
export async function getUserJoinRequests(userId: string) {
  try {
    const { data, error } = await supabase
      .from('community_join_requests')
      .select(`
        id,
        status,
        created_at,
        community:communities(id, name, badge, member_count, max_members)
      `)
      .eq('requester_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    console.error('getUserJoinRequests error:', error);
    return { data: [], error };
  }
}

/**
 * Approve join request (leader/co-leader only)
 */
export async function approveJoinRequest(requestId: string, approverId: string) {
  try {
    // 1. Get request details
    const { data: request, error: requestError } = await supabase
      .from('community_join_requests')
      .select('community_id, requester_id, status')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return { data: null, error: new Error('Request not found') };
    }

    if (request.status !== 'pending') {
      return { data: null, error: new Error('Request already processed') };
    }

    // 2. Verify approver has permission
    const { data: approver } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', request.community_id)
      .eq('user_id', approverId)
      .single();

    if (!approver || (approver.role !== 'leader' && approver.role !== 'co_leader')) {
      return { data: null, error: new Error('Only leaders and co-leaders can approve requests') };
    }

    // 3. Check if requester is already in a community
    const { data: existingMember } = await supabase
      .from('community_members')
      .select('id')
      .eq('user_id', request.requester_id)
      .single();

    if (existingMember) {
      await supabase
        .from('community_join_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);
      return { data: null, error: new Error('User is already in a community') };
    }

    // 4. Check if community is full
    const { data: community } = await supabase
      .from('communities')
      .select('member_count, max_members')
      .eq('id', request.community_id)
      .single();

    if (community && community.member_count >= community.max_members) {
      return { data: null, error: new Error('Community is full') };
    }

    // 5. Add user to community
    const { data: member, error: memberError } = await supabase
      .from('community_members')
      .insert({
        community_id: request.community_id,
        user_id: request.requester_id,
        role: 'member'
      })
      .select()
      .single();

    if (memberError) return { data: null, error: memberError };

    // 6. Update request status
    await supabase
      .from('community_join_requests')
      .update({
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    return { data: member, error: null };
  } catch (error) {
    console.error('approveJoinRequest error:', error);
    return { data: null, error };
  }
}

/**
 * Reject join request (leader/co-leader only)
 */
export async function rejectJoinRequest(requestId: string, rejecterId: string) {
  try {
    // 1. Get request details
    const { data: request } = await supabase
      .from('community_join_requests')
      .select('community_id')
      .eq('id', requestId)
      .single();

    if (!request) {
      return { error: new Error('Request not found') };
    }

    // 2. Verify rejecter has permission
    const { data: rejecter } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', request.community_id)
      .eq('user_id', rejecterId)
      .single();

    if (!rejecter || (rejecter.role !== 'leader' && rejecter.role !== 'co_leader')) {
      return { error: new Error('Only leaders and co-leaders can reject requests') };
    }

    // 3. Update request status
    const { error } = await supabase
      .from('community_join_requests')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    return { error };
  } catch (error) {
    console.error('rejectJoinRequest error:', error);
    return { error };
  }
}

/**
 * Kick member (leader/co-leader only)
 */
export async function kickMember(membershipId: string, kickerId: string) {
  try {
    // 1. Get member details
    const { data: membership } = await supabase
      .from('community_members')
      .select('community_id, user_id, role')
      .eq('id', membershipId)
      .single();

    if (!membership) {
      return { error: new Error('Member not found') };
    }

    // 2. Verify kicker has permission
    const { data: kicker } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', membership.community_id)
      .eq('user_id', kickerId)
      .single();

    if (!kicker || (kicker.role !== 'leader' && kicker.role !== 'co_leader')) {
      return { error: new Error('Only leaders and co-leaders can kick members') };
    }

    // 3. Cannot kick leader
    if (membership.role === 'leader') {
      return { error: new Error('Cannot kick the leader') };
    }

    // 4. Co-leaders cannot kick other co-leaders
    if (kicker.role === 'co_leader' && membership.role === 'co_leader') {
      return { error: new Error('Co-leaders cannot kick other co-leaders') };
    }

    // 5. Delete membership
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('id', membershipId);

    return { error };
  } catch (error) {
    console.error('kickMember error:', error);
    return { error };
  }
}

/**
 * Promote to co-leader (leader only)
 */
export async function promoteToCoLeader(membershipId: string, leaderId: string) {
  try {
    // 1. Get member details
    const { data: membership } = await supabase
      .from('community_members')
      .select('community_id, role')
      .eq('id', membershipId)
      .single();

    if (!membership) {
      return { error: new Error('Member not found') };
    }

    // 2. Verify requester is leader
    const { data: community } = await supabase
      .from('communities')
      .select('leader_id')
      .eq('id', membership.community_id)
      .single();

    if (!community || community.leader_id !== leaderId) {
      return { error: new Error('Only the leader can promote members') };
    }

    // 3. Update role
    const { error } = await supabase
      .from('community_members')
      .update({ role: 'co_leader' })
      .eq('id', membershipId);

    return { error };
  } catch (error) {
    console.error('promoteToCoLeader error:', error);
    return { error };
  }
}

/**
 * Demote co-leader (leader only)
 */
export async function demoteCoLeader(membershipId: string, leaderId: string) {
  try {
    // 1. Get member details
    const { data: membership } = await supabase
      .from('community_members')
      .select('community_id, role')
      .eq('id', membershipId)
      .single();

    if (!membership || membership.role !== 'co_leader') {
      return { error: new Error('Member is not a co-leader') };
    }

    // 2. Verify requester is leader
    const { data: community } = await supabase
      .from('communities')
      .select('leader_id')
      .eq('id', membership.community_id)
      .single();

    if (!community || community.leader_id !== leaderId) {
      return { error: new Error('Only the leader can demote co-leaders') };
    }

    // 3. Update role
    const { error } = await supabase
      .from('community_members')
      .update({ role: 'member' })
      .eq('id', membershipId);

    return { error };
  } catch (error) {
    console.error('demoteCoLeader error:', error);
    return { error };
  }
}

// ==================== TOURNAMENTS ====================

/**
 * Create tournament (leader/co-leader only)
 */
export async function createTournament(
  communityId: string,
  creatorId: string,
  name: string,
  description: string,
  format: 'single_elimination' | 'double_elimination' | 'round_robin',
  maxParticipants: number,
  registrationEndsAt: Date
) {
  try {
    // 1. Verify creator has permission
    const { data: member } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', creatorId)
      .single();

    if (!member || (member.role !== 'leader' && member.role !== 'co_leader')) {
      return { data: null, error: new Error('Only leaders and co-leaders can create tournaments') };
    }

    // 2. Create tournament
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        community_id: communityId,
        name,
        description,
        format,
        max_participants: maxParticipants,
        registration_ends_at: registrationEndsAt.toISOString(),
        status: 'registration',
        created_by: creatorId
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('createTournament error:', error);
    return { data: null, error };
  }
}

/**
 * Get tournaments for community
 */
export async function getCommunityTournaments(communityId: string) {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        description,
        format,
        status,
        min_participants,
        max_participants,
        current_participants,
        registration_ends_at,
        started_at,
        completed_at,
        winner:users!tournaments_winner_id_fkey(username, elo, avatar),
        creator:users!tournaments_created_by_fkey(username)
      `)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    console.error('getCommunityTournaments error:', error);
    return { data: [], error };
  }
}

/**
 * Register for tournament
 */
export async function registerForTournament(tournamentId: string, userId: string) {
  try {
    // 1. Get tournament details
    const { data: tournament, error: tournError } = await supabase
      .from('tournaments')
      .select('status, current_participants, max_participants, community_id')
      .eq('id', tournamentId)
      .single();

    if (tournError || !tournament) {
      return { data: null, error: new Error('Tournament not found') };
    }

    if (tournament.status !== 'registration') {
      return { data: null, error: new Error('Tournament registration is closed') };
    }

    if (tournament.current_participants >= tournament.max_participants) {
      return { data: null, error: new Error('Tournament is full') };
    }

    // 2. Verify user is community member
    const { data: member } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', tournament.community_id)
      .eq('user_id', userId)
      .single();

    if (!member) {
      return { data: null, error: new Error('Only community members can register') };
    }

    // 3. Get user ELO for seeding
    const { data: user } = await supabase
      .from('users')
      .select('elo')
      .eq('id', userId)
      .single();

    // 4. Register participant
    const { data, error } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournamentId,
        user_id: userId,
        seed: user?.elo || 1000
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('registerForTournament error:', error);
    return { data: null, error };
  }
}

/**
 * Unregister from tournament
 */
export async function unregisterFromTournament(tournamentId: string, userId: string) {
  try {
    // Only allow if tournament hasn't started
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status')
      .eq('id', tournamentId)
      .single();

    if (tournament && tournament.status !== 'registration') {
      return { error: new Error('Cannot unregister after tournament starts') };
    }

    const { error } = await supabase
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId);

    return { error };
  } catch (error) {
    console.error('unregisterFromTournament error:', error);
    return { error };
  }
}

/**
 * Get tournament bracket/standings
 */
export async function getTournamentBracket(tournamentId: string) {
  try {
    const { data, error } = await supabase
      .from('tournament_matches')
      .select(`
        id,
        round_number,
        match_number,
        status,
        scheduled_at,
        completed_at,
        winner_id,
        player1:users!tournament_matches_player1_id_fkey(id, username, elo, avatar),
        player2:users!tournament_matches_player2_id_fkey(id, username, elo, avatar),
        game_result:game_results(player1_score, player2_score)
      `)
      .eq('tournament_id', tournamentId)
      .order('round_number', { ascending: true })
      .order('match_number', { ascending: true });

    return { data, error };
  } catch (error) {
    console.error('getTournamentBracket error:', error);
    return { data: [], error };
  }
}

/**
 * Get tournament participants
 */
export async function getTournamentParticipants(tournamentId: string) {
  try {
    const { data, error } = await supabase
      .from('tournament_participants')
      .select(`
        id,
        seed,
        current_round,
        is_eliminated,
        placement,
        registered_at,
        user:users(id, username, elo, avatar)
      `)
      .eq('tournament_id', tournamentId)
      .order('seed', { ascending: true });

    return { data, error };
  } catch (error) {
    console.error('getTournamentParticipants error:', error);
    return { data: [], error };
  }
}

// ==================== TOURNAMENT EXECUTION ====================

/**
 * Start tournament - generates bracket and changes status to in_progress
 */
export async function startTournament(userId: string, tournamentId: string) {
  try {
    // 1. Get tournament and verify permissions
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*, community:communities(leader_id)')
      .eq('id', tournamentId)
      .single();

    if (tournamentError) return { data: null, error: tournamentError };

    // Check if user is leader or co-leader
    const { data: membership } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', tournament.community_id)
      .eq('user_id', userId)
      .single();

    if (!membership || (membership.role !== 'leader' && membership.role !== 'co_leader')) {
      return { data: null, error: new Error('Only leaders and co-leaders can start tournaments') };
    }

    // 2. Check if tournament can start
    if (tournament.status !== 'registration') {
      return { data: null, error: new Error('Tournament has already started or completed') };
    }

    if (tournament.current_participants < tournament.min_participants) {
      return { data: null, error: new Error(`Need at least ${tournament.min_participants} participants to start`) };
    }

    // 3. Get participants sorted by ELO (for seeding)
    const { data: participants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select('id, user_id, user:users(elo)')
      .eq('tournament_id', tournamentId)
      .order('user(elo)', { ascending: false });

    if (participantsError || !participants) {
      return { data: null, error: participantsError || new Error('Failed to fetch participants') };
    }

    // 4. Assign seeds
    for (let i = 0; i < participants.length; i++) {
      await supabase
        .from('tournament_participants')
        .update({ seed: i + 1 })
        .eq('id', participants[i].id);
    }

    // 5. Generate first round matches
    const matches = generateBracketMatches(participants, 1);

    if (matches.length > 0) {
      const { error: matchesError } = await supabase
        .from('tournament_matches')
        .insert(matches.map(m => ({
          tournament_id: tournamentId,
          round_number: 1,
          match_number: m.matchNumber,
          player1_id: m.player1Id,
          player2_id: m.player2Id,
          status: 'pending'
        })));

      if (matchesError) return { data: null, error: matchesError };
    }

    // 6. Update tournament status
    const { data: updatedTournament, error: updateError } = await supabase
      .from('tournaments')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', tournamentId)
      .select()
      .single();

    if (updateError) return { data: null, error: updateError };

    return { data: updatedTournament, error: null };
  } catch (error) {
    console.error('startTournament error:', error);
    return { data: null, error };
  }
}

/**
 * Helper: Generate bracket matches for a round (single elimination)
 */
function generateBracketMatches(
  participants: any[],
  roundNumber: number
): { matchNumber: number; player1Id: string; player2Id: string }[] {
  const matches: { matchNumber: number; player1Id: string; player2Id: string }[] = [];

  // First round: pair participants using bracket seeding (1 vs last, 2 vs second-last, etc.)
  if (roundNumber === 1) {
    const numMatches = Math.floor(participants.length / 2);

    for (let i = 0; i < numMatches; i++) {
      matches.push({
        matchNumber: i + 1,
        player1Id: participants[i].user_id,
        player2Id: participants[participants.length - 1 - i].user_id
      });
    }

    // If odd number of participants, last one gets a bye (handled by not creating a match)
  }

  return matches;
}

/**
 * Create a room for a tournament match
 */
export async function createTournamentMatchRoom(
  userId: string,
  tournamentId: string,
  matchId: string
) {
  try {
    // Get match details
    const { data: match, error: matchError } = await supabase
      .from('tournament_matches')
      .select('*, tournament:tournaments(community_id)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return { data: null, error: matchError || new Error('Match not found') };
    }

    // Verify user is one of the players
    if (match.player1_id !== userId && match.player2_id !== userId) {
      return { data: null, error: new Error('You are not a participant in this match') };
    }

    // Check if match already has a room
    if (match.room_id) {
      return { data: null, error: new Error('Match already has an active room') };
    }

    // Create room
    const roomCode = generateRoomCode();
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        host_id: match.player1_id,
        guest_id: match.player2_id,
        status: 'waiting',
        tournament_match_id: matchId
      })
      .select()
      .single();

    if (roomError) return { data: null, error: roomError };

    // Update match with room_id
    await supabase
      .from('tournament_matches')
      .update({
        room_id: room.id,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', matchId);

    return { data: room, error: null };
  } catch (error) {
    console.error('createTournamentMatchRoom error:', error);
    return { data: null, error };
  }
}

/**
 * Link game result to tournament match and progress tournament
 */
export async function linkGameResultToMatch(
  roomId: string,
  gameResultId: string
) {
  try {
    // 1. Get room with tournament match info
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*, tournament_match_id')
      .eq('id', roomId)
      .single();

    if (roomError || !room || !room.tournament_match_id) {
      return { data: null, error: null }; // Not a tournament match, skip
    }

    // 2. Get game result
    const { data: result, error: resultError } = await supabase
      .from('game_results')
      .select('*')
      .eq('id', gameResultId)
      .single();

    if (resultError) return { data: null, error: resultError };

    // 3. Determine winner
    const winnerId = result.winner_id;

    // 4. Update tournament match
    const { error: matchUpdateError } = await supabase
      .from('tournament_matches')
      .update({
        winner_id: winnerId,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', room.tournament_match_id);

    if (matchUpdateError) return { data: null, error: matchUpdateError };

    // 5. Get match details to update participant status
    const { data: match } = await supabase
      .from('tournament_matches')
      .select('*, tournament:tournaments(id)')
      .eq('id', room.tournament_match_id)
      .single();

    if (match) {
      // Mark loser as eliminated
      const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;

      await supabase
        .from('tournament_participants')
        .update({ is_eliminated: true })
        .eq('tournament_id', match.tournament_id)
        .eq('user_id', loserId);

      // Check if we need to generate next round
      await checkAndGenerateNextRound(match.tournament_id, match.round_number);
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('linkGameResultToMatch error:', error);
    return { data: null, error };
  }
}

/**
 * Helper: Check if round is complete and generate next round matches
 */
async function checkAndGenerateNextRound(tournamentId: string, completedRound: number) {
  try {
    // Get all matches for the completed round
    const { data: roundMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round_number', completedRound);

    if (!roundMatches) return;

    // Check if all matches are completed
    const allCompleted = roundMatches.every(m => m.status === 'completed' && m.winner_id);

    if (!allCompleted) return; // Round not finished yet

    // Get winners for next round
    const winners = roundMatches.map(m => m.winner_id).filter(Boolean);

    // If only one winner, tournament is complete!
    if (winners.length === 1) {
      await supabase
        .from('tournaments')
        .update({
          status: 'completed',
          winner_id: winners[0],
          completed_at: new Date().toISOString()
        })
        .eq('id', tournamentId);

      // Update winner's placement
      await supabase
        .from('tournament_participants')
        .update({ placement: 1 })
        .eq('tournament_id', tournamentId)
        .eq('user_id', winners[0]);

      return;
    }

    // Generate next round matches
    const nextRound = completedRound + 1;
    const nextMatches = [];

    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        nextMatches.push({
          tournament_id: tournamentId,
          round_number: nextRound,
          match_number: Math.floor(i / 2) + 1,
          player1_id: winners[i],
          player2_id: winners[i + 1],
          status: 'pending'
        });
      }
    }

    if (nextMatches.length > 0) {
      await supabase
        .from('tournament_matches')
        .insert(nextMatches);
    }
  } catch (error) {
    console.error('checkAndGenerateNextRound error:', error);
  }
}

/**
 * Generate room code helper (reused from roomCode utility)
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get community statistics
 */
export async function getCommunityStats(communityId: string) {
  try {
    // Get top members by ELO
    const { data: topMembers } = await supabase
      .from('community_members')
      .select('user_id, user:users(id, username, elo, avatar, total_games, wins)')
      .eq('community_id', communityId)
      .order('user(elo)', { ascending: false })
      .limit(10);

    // Get total tournaments
    const { count: totalTournaments } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId);

    // Get completed tournaments
    const { count: completedTournaments } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .eq('status', 'completed');

    // Get tournament champions (recent winners)
    const { data: recentChampions } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        winner_id,
        completed_at,
        winner:users!tournaments_winner_id_fkey(username, avatar, elo)
      `)
      .eq('community_id', communityId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5);

    return {
      data: {
        topMembers: topMembers || [],
        totalTournaments: totalTournaments || 0,
        completedTournaments: completedTournaments || 0,
        recentChampions: recentChampions || []
      },
      error: null
    };
  } catch (error) {
    console.error('getCommunityStats error:', error);
    return { data: null, error };
  }
}
