import { supabase } from '../lib/supabase';

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

// ==================== ROOMS ====================

/**
 * Create new room
 * Returns room with unique room code
 */
export async function createRoom(hostId: string, roomCode: string) {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        host_id: hostId,
        status: 'waiting',
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
      .select('host_id, guest_id')
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

    // If insert succeeds, return
    if (!insertError) {
      console.log('✅ Answer inserted successfully');
      return { data: inserted, error: null };
    }

    // If insert fails due to unique constraint, update instead
    if (insertError.code === '23505') {
      console.log('Record exists, updating instead...');

      const { data: updated, error: updateError } = await supabase
        .from('game_sessions')
        .update(playerData)
        .eq('room_id', roomId)
        .eq('question_index', questionIndex)
        .select()
        .single();

      if (updateError) {
        console.error('Update failed:', updateError);
        return { data: null, error: updateError };
      }

      console.log('✅ Answer updated successfully');
      return { data: updated, error: null };
    }

    // Other insert error
    console.error('Insert failed:', insertError);
    return { data: null, error: insertError };
  } catch (error) {
    console.error('saveAnswer error:', error);
    return { data: null, error };
  }
}

/**
 * Get all answers for a room
 */
export async function getGameSessions(roomId: string) {
  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('room_id', roomId)
      .order('question_index', { ascending: true });

    return { data, error };
  } catch (error) {
    console.error('getGameSessions error:', error);
    return { data: null, error };
  }
}

// ==================== GAME RESULTS ====================

/**
 * Save final game result
 */
export async function saveGameResult(
  roomId: string,
  player1Id: string,
  player2Id: string,
  player1Score: number,
  player2Score: number,
  player1EloChange: number,
  player2EloChange: number
) {
  try {
    const winnerId =
      player1Score > player2Score
        ? player1Id
        : player2Score > player1Score
        ? player2Id
        : null; // Draw

    const { data, error } = await supabase
      .from('game_results')
      .insert({
        room_id: roomId,
        winner_id: winnerId,
        player1_id: player1Id,
        player2_id: player2Id,
        player1_score: player1Score,
        player2_score: player2Score,
        player1_elo_change: player1EloChange,
        player2_elo_change: player2EloChange,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving game result:', error);
      return { data: null, error };
    }

    // Update room status to finished
    await updateRoomStatus(roomId, 'finished');

    return { data, error: null };
  } catch (error) {
    console.error('saveGameResult error:', error);
    return { data: null, error };
  }
}

/**
 * Get game result by room ID
 */
export async function getGameResult(roomId: string) {
  try {
    const { data, error } = await supabase
      .from('game_results')
      .select('*')
      .eq('room_id', roomId)
      .single();

    return { data, error };
  } catch (error) {
    console.error('getGameResult error:', error);
    return { data: null, error };
  }
}
