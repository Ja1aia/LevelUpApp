import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';

interface MatchHistoryProps {
  userId: string;
  onBack: () => void;
  onViewMatchDetails: (matchId: string) => void;
}

interface MatchData {
  id: string;
  opponentName: string;
  result: 'win' | 'loss' | 'draw';
  yourScore: number;
  opponentScore: number;
  eloChange: number;
  createdAt: string;
}

export default function MatchHistoryScreen({
  userId,
  onBack,
  onViewMatchDetails
}: MatchHistoryProps) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatchHistory();
  }, [userId]);

  const fetchMatchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query game_results where user is player1 or player2
      const { data: results, error: fetchError } = await supabase
        .from('game_results')
        .select(`
          id,
          player1_id,
          player2_id,
          player1_score,
          player2_score,
          player1_elo_change,
          player2_elo_change,
          winner_id,
          created_at
        `)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        console.error('Error fetching match history:', fetchError);
        setError('Failed to load match history');
        return;
      }

      if (!results || results.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      // Get all opponent IDs
      const opponentIds = results.map((r) =>
        r.player1_id === userId ? r.player2_id : r.player1_id
      );

      // Fetch opponent usernames
      const { data: users } = await supabase
        .from('users')
        .select('id, username')
        .in('id', opponentIds);

      const userMap = new Map(users?.map((u) => [u.id, u.username]) || []);

      // Transform data
      const matchesData: MatchData[] = results.map((r) => {
        const isPlayer1 = r.player1_id === userId;
        const opponentId = isPlayer1 ? r.player2_id : r.player1_id;
        const yourScore = isPlayer1 ? r.player1_score : r.player2_score;
        const opponentScore = isPlayer1 ? r.player2_score : r.player1_score;
        const eloChange = isPlayer1 ? r.player1_elo_change : r.player2_elo_change;

        let result: 'win' | 'loss' | 'draw';
        if (r.winner_id === null) {
          result = 'draw';
        } else if (r.winner_id === userId) {
          result = 'win';
        } else {
          result = 'loss';
        }

        return {
          id: r.id,
          opponentName: userMap.get(opponentId) || 'Unknown',
          result,
          yourScore,
          opponentScore,
          eloChange,
          createdAt: r.created_at,
        };
      });

      setMatches(matchesData);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'win':
        return '🏆';
      case 'loss':
        return '💪';
      case 'draw':
        return '🤝';
      default:
        return '❓';
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win':
        return COLORS.success;
      case 'loss':
        return COLORS.error;
      case 'draw':
        return '#999';
      default:
        return '#999';
    }
  };

  const renderMatch = ({ item }: { item: MatchData }) => (
    <TouchableOpacity
      style={[styles.matchCard, { borderLeftColor: getResultColor(item.result) }]}
      onPress={() => onViewMatchDetails(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.matchHeader}>
        <View style={styles.resultSection}>
          <Text style={styles.resultIcon}>{getResultIcon(item.result)}</Text>
          <Text style={[styles.resultText, { color: getResultColor(item.result) }]}>
            {item.result.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
      </View>

      <View style={styles.matchBody}>
        <View style={styles.vsSection}>
          <Text style={styles.youLabel}>You</Text>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>{item.yourScore}</Text>
            <Text style={styles.scoreDivider}>-</Text>
            <Text style={styles.scoreText}>{item.opponentScore}</Text>
          </View>
          <Text style={styles.opponentLabel}>{item.opponentName}</Text>
        </View>

        <View style={styles.eloSection}>
          <Text
            style={[
              styles.eloChange,
              {
                color:
                  item.eloChange > 0
                    ? COLORS.success
                    : item.eloChange < 0
                    ? COLORS.error
                    : '#999',
              },
            ]}
          >
            {item.eloChange > 0 ? '+' : ''}
            {item.eloChange} ELO
          </Text>
        </View>
      </View>

      {/* Tap indicator */}
      <View style={styles.tapIndicator}>
        <Text style={styles.tapText}>Tap for details →</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Match History</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Match History</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchMatchHistory}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {matches.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🎮</Text>
          <Text style={styles.emptyText}>No matches yet</Text>
          <Text style={styles.emptySubtext}>Play your first game to see history here!</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginBottom: 16,
    textAlign: 'center',
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
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: 16,
  },
  matchCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  resultText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  matchBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vsSection: {
    flex: 1,
  },
  youLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  scoreDivider: {
    fontSize: 20,
    color: COLORS.textSecondary,
    marginHorizontal: 8,
  },
  opponentLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  eloSection: {
    alignItems: 'flex-end',
  },
  eloChange: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tapIndicator: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  tapText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
