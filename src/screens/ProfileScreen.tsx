import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  username: string;
  elo: number;
  avatar: string;
  total_games: number;
  wins: number;
  losses: number;
}

interface TopicStat {
  topic: string;
  total_correct: number;
  total_answered: number;
}

interface ProfileScreenProps {
  userId: string;
  onBack?: () => void;
}

export default function ProfileScreen({ userId, onBack }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [topicStats, setTopicStats] = useState<TopicStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user profile
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, username, elo, avatar, total_games, wins, losses')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        setError('Failed to load profile');
        return;
      }

      if (data) {
        setProfile(data);
      }

      // Fetch topic stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_topic_stats')
        .select('topic, total_correct, total_answered')
        .eq('user_id', userId)
        .order('topic', { ascending: true });

      if (statsError) {
        console.error('Error fetching topic stats:', statsError);
      } else if (statsData) {
        setTopicStats(statsData);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const calculateWinRate = (): string => {
    if (!profile || profile.total_games === 0) {
      return '0';
    }
    const winRate = (profile.wins / profile.total_games) * 100;
    return winRate.toFixed(1);
  };

  const getRank = (correct: number, total: number): string => {
    // Require minimum 15 questions before showing rank
    if (total < 15) return `${total}/15`;
    if (total === 0) return 'Unranked';

    const percentage = (correct / total) * 100;

    if (percentage >= 90) return 'S';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const getRankColor = (rank: string): string => {
    // Gray color for incomplete data (shows progress like "5/15")
    if (rank.includes('/')) return '#B0B0B0';

    switch (rank) {
      case 'S': return '#FFD700'; // Gold
      case 'A': return '#00D084'; // Green
      case 'B': return '#4A90E2'; // Blue
      case 'C': return '#F5A623'; // Orange
      case 'D': return '#E86C60'; // Red
      case 'F': return '#8B0000'; // Dark Red
      default: return COLORS.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Profile not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button */}
        {onBack && (
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.headerSpacer} />
          </View>
        )}

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{profile.avatar || '😊'}</Text>
          </View>

          {/* Username */}
          <Text style={styles.username}>{profile.username}</Text>

          {/* ELO Rating */}
          <View style={styles.eloContainer}>
            <Text style={styles.eloLabel}>ELO Rating</Text>
            <Text style={styles.eloValue}>{profile.elo}</Text>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Statistics</Text>

          <View style={styles.statsGrid}>
            {/* Total Games */}
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.total_games}</Text>
              <Text style={styles.statLabel}>Total Games</Text>
            </View>

            {/* Wins */}
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.winsValue]}>
                {profile.wins}
              </Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>

            {/* Losses */}
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.lossesValue]}>
                {profile.losses}
              </Text>
              <Text style={styles.statLabel}>Losses</Text>
            </View>

            {/* Win Rate */}
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{calculateWinRate()}%</Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
          </View>
        </View>

        {/* Topic Stats Card */}
        <View style={[styles.statsCard, { marginTop: 16 }]}>
          <Text style={styles.statsTitle}>Competency Stats</Text>
          {topicStats.length === 0 ? (
            <Text style={styles.noStatsText}>No competency data yet.</Text>
          ) : (
            topicStats.map((stat, index) => {
              const rank = getRank(stat.total_correct, stat.total_answered);
              const needsMoreQuestions = stat.total_answered < 15;
              const questionsNeeded = 15 - stat.total_answered;

              return (
                <View key={index} style={styles.topicRow}>
                  <Text style={styles.topicName}>{stat.topic}</Text>
                  <View style={styles.rankContainer}>
                    {needsMoreQuestions ? (
                      <>
                        <Text style={[styles.rankText, { color: getRankColor(rank) }]}>
                          {rank}
                        </Text>
                        <Text style={styles.rankDetail}>
                          ({questionsNeeded} more to unlock)
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.rankText, { color: getRankColor(rank) }]}>
                          {rank}
                        </Text>
                        <Text style={styles.rankDetail}>
                          ({stat.total_correct}/{stat.total_answered})
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  headerSpacer: {
    width: 60,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    fontSize: 48,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  eloContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  eloLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  eloValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  statsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  winsValue: {
    color: COLORS.success,
  },
  lossesValue: {
    color: COLORS.error,
  },
  noStatsText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  topicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  rankDetail: {
    fontSize: 10,
    color: COLORS.error,
  },
});
