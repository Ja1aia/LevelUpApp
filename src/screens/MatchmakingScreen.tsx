import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { COLORS } from '../theme/colors';
import {
  joinMatchmakingQueue,
  leaveMatchmakingQueue,
  checkForMatch,
} from '../services/database';
import { supabase } from '../lib/supabase';

interface MatchmakingScreenProps {
  userId: string;
  username: string;
  userElo: number;
  onMatchFound: (roomId: string, roomCode: string) => void;
  onCancel: () => void;
}

export default function MatchmakingScreen({
  userId,
  username,
  userElo,
  onMatchFound,
  onCancel,
}: MatchmakingScreenProps) {
  const [searching, setSearching] = useState(true);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const matchCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const timeInterval = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    startMatchmaking();
    setupRealtimeSubscription();

    return () => {
      cleanup();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Pulse animation for searching indicator
  useEffect(() => {
    if (searching) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [searching]);

  const setupRealtimeSubscription = () => {
    console.log('Setting up realtime subscription for user:', userId);

    channelRef.current = supabase
      .channel(`matchmaking-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchmaking_queue',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('🔔 Matchmaking real-time update:', payload);
          if (payload.new && payload.new.status === 'matched') {
            console.log('✅ Match found via real-time! Room ID:', payload.new.room_id);
            handleMatchFound(payload.new.room_id, payload.new.room_code);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });
  };

  const startMatchmaking = async () => {
    try {
      // Join the queue
      const { error: joinError } = await joinMatchmakingQueue(userId, userElo);

      if (joinError) {
        Alert.alert('Error', joinError.message || 'Failed to join matchmaking queue');
        onCancel();
        return;
      }

      console.log('✅ Joined matchmaking queue');

      // Start checking for matches every 2 seconds
      matchCheckInterval.current = setInterval(checkForMatchUpdate, 2000);

      // Start timer
      timeInterval.current = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Matchmaking error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      onCancel();
    }
  };

  const checkForMatchUpdate = async () => {
    try {
      const { data, error } = await checkForMatch(userId, userElo);

      if (error) {
        console.error('Check match error:', error);
        return;
      }

      if (data && data.matched) {
        handleMatchFound(data.room_id, data.room_code);
      }
    } catch (error) {
      console.error('Match check error:', error);
    }
  };

  const handleMatchFound = async (roomId: string, roomCode?: string) => {
    console.log('🎮 Match found! Navigating to game...', { roomId, roomCode });

    cleanup();
    setSearching(false);

    // Clean up queue entry before navigating
    try {
      await leaveMatchmakingQueue(userId);
      console.log('✅ Cleaned up queue entry');
    } catch (error) {
      console.error('Error cleaning up queue:', error);
    }

    // Fetch room code if not provided
    if (!roomCode) {
      const { data: room } = await supabase
        .from('rooms')
        .select('room_code')
        .eq('id', roomId)
        .single();

      roomCode = room?.room_code || '';
    }

    // Automatically navigate to game (no alert confirmation)
    console.log('✅ Navigating both players to room:', roomId, roomCode);
    onMatchFound(roomId, roomCode!);
  };

  const handleCancel = async () => {
    try {
      await leaveMatchmakingQueue(userId);
      cleanup();
      onCancel();
    } catch (error) {
      console.error('Cancel error:', error);
      onCancel();
    }
  };

  const cleanup = () => {
    if (matchCheckInterval.current) {
      clearInterval(matchCheckInterval.current);
      matchCheckInterval.current = null;
    }
    if (timeInterval.current) {
      clearInterval(timeInterval.current);
      timeInterval.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Animated Search Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.icon}>🔍</Text>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>Finding Opponent...</Text>

        {/* ELO Info */}
        <View style={styles.eloInfo}>
          <Text style={styles.eloLabel}>Your ELO:</Text>
          <Text style={styles.eloValue}>{userElo}</Text>
        </View>

        <Text style={styles.subtitle}>
          Searching for players within ±200 ELO
        </Text>

        {/* Timer */}
        <View style={styles.timerContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.timer}>{formatTime(timeElapsed)}</Text>
        </View>

        {/* Status */}
        <Text style={styles.status}>
          Waiting for an opponent to join...
        </Text>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  icon: {
    fontSize: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  eloInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eloLabel: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  eloValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 30,
    textAlign: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timer: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginLeft: 12,
  },
  status: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  cancelButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButtonText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
