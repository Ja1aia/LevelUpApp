import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';

interface WaitingForOpponentScreenProps {
  username: string;
  userId: string;
  roomId: string;
  yourScore: number;
  totalQuestions: number;
  onOpponentFinished: () => void;
}

export default function WaitingForOpponentScreen({
  username,
  userId,
  roomId,
  yourScore,
  totalQuestions,
  onOpponentFinished,
}: WaitingForOpponentScreenProps) {
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Fade in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Real-time opponent progress tracking
  useEffect(() => {
    console.log('🔔 Setting up opponent progress tracking for room:', roomId);

    let isPlayer1: boolean;
    let hasFinished = false;

    // Helper function to fetch and count opponent progress
    const fetchOpponentProgress = async () => {
      const { data: sessions } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId);

      if (sessions) {
        const opponentAnsweredCount = sessions.filter((session) => {
          const opponentAnswer = isPlayer1
            ? session.player2_answer
            : session.player1_answer;
          return opponentAnswer !== null && opponentAnswer !== undefined;
        }).length;

        console.log('📊 Opponent progress:', opponentAnsweredCount, '/', totalQuestions);
        setOpponentProgress(opponentAnsweredCount);

        // Check if opponent finished
        if (opponentAnsweredCount >= totalQuestions && !hasFinished) {
          console.log('🎉 Opponent finished all questions!');
          hasFinished = true;
          setTimeout(() => onOpponentFinished(), 1000);
        }

        return opponentAnsweredCount;
      }

      return 0;
    };

    const trackOpponentProgress = async () => {
      // Get room data to determine opponent
      const { data: room } = await supabase
        .from('rooms')
        .select('host_id, guest_id')
        .eq('id', roomId)
        .single();

      if (!room) {
        console.error('❌ Room not found');
        return null;
      }

      isPlayer1 = room.host_id === userId;
      console.log('👤 You are:', isPlayer1 ? 'Player 1 (Host)' : 'Player 2 (Guest)');
      console.log('⏳ Waiting for:', isPlayer1 ? 'Player 2 (Guest)' : 'Player 1 (Host)');

      // Fetch initial opponent progress
      await fetchOpponentProgress();

      // Subscribe to real-time updates
      const subscription = supabase
        .channel(`waiting:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_sessions',
            filter: `room_id=eq.${roomId}`,
          },
          async (payload) => {
            console.log('🔥 Game session updated (real-time):', payload.eventType);

            // Refetch and recount instead of incrementing
            await fetchOpponentProgress();
          }
        )
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
        });

      return subscription;
    };

    let subscription: any = null;

    trackOpponentProgress().then((sub) => {
      subscription = sub;
    });

    // Fallback: Poll every 3 seconds
    const pollInterval = setInterval(async () => {
      console.log('🔍 Polling opponent progress...');
      await fetchOpponentProgress();
    }, 3000);

    return () => {
      console.log('🧹 Cleaning up opponent tracking');
      if (subscription) {
        subscription.unsubscribe();
      }
      clearInterval(pollInterval);
    };
  }, [roomId, userId, totalQuestions, onOpponentFinished]);

  const progressPercentage = Math.round(
    (opponentProgress / totalQuestions) * 100
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        {/* Your Score Summary */}
        <View style={styles.yourScoreCard}>
          <Text style={styles.cardTitle}>Your Score</Text>
          <View style={styles.scoreDisplay}>
            <Text style={styles.scoreNumber}>{yourScore}</Text>
            <Text style={styles.scoreTotal}>/{totalQuestions}</Text>
          </View>
          <Text style={styles.username}>😊 {username}</Text>
          <Text style={styles.completeText}>✓ Quiz Complete!</Text>
        </View>

        {/* Waiting Message */}
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.waitingTitle}>Waiting for Opponent...</Text>
          <Text style={styles.waitingSubtitle}>
            Hang tight! Your opponent is still playing.
          </Text>
        </View>

        {/* Opponent Progress */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>🤖 Opponent Progress</Text>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercentage}%` },
              ]}
            />
          </View>

          {/* Progress Text */}
          <Text style={styles.progressText}>
            {opponentProgress} / {totalQuestions} questions
          </Text>

          {opponentProgress >= totalQuestions && (
            <Text style={styles.finishedText}>✓ Opponent Finished!</Text>
          )}
        </View>

        {/* Tip */}
        <View style={styles.tipContainer}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            Results will appear automatically when opponent finishes
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yourScoreCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  scoreTotal: {
    fontSize: 24,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  completeText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  waitingContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  waitingSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  progressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  finishedText: {
    fontSize: 16,
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: 'bold',
    marginTop: 8,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  tipIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
});
