import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { Question } from '../types';

interface MatchDetailsScreenProps {
  matchId: string;
  userId: string;
  onBack: () => void;
}

interface MatchDetails {
  yourUsername: string;
  opponentUsername: string;
  yourScore: number;
  opponentScore: number;
  yourElo: number;
  opponentElo: number;
  yourEloChange: number;
  opponentEloChange: number;
  isWinner: boolean;
  isDraw: boolean;
  yourAnswers: AnswerDetail[];
  opponentAnswers: AnswerDetail[];
  questions: Question[];
}

interface AnswerDetail {
  selectedOption: number;
  isCorrect: boolean;
  timeSpent: number;
}

export default function MatchDetailsScreen({
  matchId,
  userId,
  onBack,
}: MatchDetailsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchMatchDetails();
  }, [matchId, userId]);

  const fetchMatchDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch game result
      const { data: gameResult, error: resultError } = await supabase
        .from('game_results')
        .select('*')
        .eq('id', matchId)
        .single();

      if (resultError || !gameResult) {
        console.error('Error fetching game result:', resultError);
        setError('Failed to load match details');
        setLoading(false);
        return;
      }

      // Determine if user is player1 or player2
      const isPlayer1 = gameResult.player1_id === userId;
      const opponentId = isPlayer1 ? gameResult.player2_id : gameResult.player1_id;

      // Fetch usernames
      const { data: users } = await supabase
        .from('users')
        .select('id, username')
        .in('id', [userId, opponentId]);

      const userMap = new Map(users?.map((u) => [u.id, u.username]) || []);
      const yourUsername = userMap.get(userId) || 'You';
      const opponentUsername = userMap.get(opponentId) || 'Opponent';

      // Fetch game sessions to get question-by-question answers
      const { data: sessions, error: sessionsError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', gameResult.room_id)
        .order('question_index', { ascending: true });

      if (sessionsError || !sessions) {
        console.error('Error fetching sessions:', sessionsError);
        setError('Failed to load match details');
        setLoading(false);
        return;
      }

      // Build answers arrays
      const yourAnswers: AnswerDetail[] = sessions.map((session) => {
        const answer = isPlayer1 ? session.player1_answer : session.player2_answer;
        const correct = isPlayer1 ? session.player1_correct : session.player2_correct;
        const time = isPlayer1 ? session.player1_time : session.player2_time;

        return {
          selectedOption: answer ?? -1,
          isCorrect: correct ?? false,
          timeSpent: time ?? 0,
        };
      });

      const opponentAnswers: AnswerDetail[] = sessions.map((session) => {
        const answer = isPlayer1 ? session.player2_answer : session.player1_answer;
        const correct = isPlayer1 ? session.player2_correct : session.player1_correct;
        const time = isPlayer1 ? session.player2_time : session.player1_time;

        return {
          selectedOption: answer ?? -1,
          isCorrect: correct ?? false,
          timeSpent: time ?? 0,
        };
      });

      // Fetch room to get the questions used
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('questions')
        .eq('id', gameResult.room_id)
        .single();

      if (roomError || !roomData) {
        console.error('Error fetching room questions:', roomError);
      }

      // Parse questions from room
      let questions: Question[] = [];
      if (roomData?.questions) {
        questions = typeof roomData.questions === 'string'
          ? JSON.parse(roomData.questions)
          : roomData.questions;
      }

      // If for some reason questions are missing in room (legacy), try to use what's in sessions or fallback
      if (questions.length === 0 && sessions.length > 0) {
        questions = sessions.map((session, index) => ({
          id: index + 1,
          question: session.question_text || 'Question not found',
          options: session.question_options || [],
          correctAnswer: session.correct_answer || 0,
          topic: session.question_topic || 'General',
        }));
      }

      const yourScore = isPlayer1 ? gameResult.player1_score : gameResult.player2_score;
      const opponentScore = isPlayer1 ? gameResult.player2_score : gameResult.player1_score;

      // Calculate ELO after the match (current ELO - change = previous ELO, so display current)
      const yourEloChange = isPlayer1
        ? gameResult.player1_elo_change
        : gameResult.player2_elo_change;
      const opponentEloChange = isPlayer1
        ? gameResult.player2_elo_change
        : gameResult.player1_elo_change;

      // Fetch current ELO (or we can calculate: at match time it was current - change made since)
      // For simplicity, let's fetch current user ELO
      const { data: currentUser } = await supabase
        .from('users')
        .select('elo')
        .eq('id', userId)
        .single();

      const { data: opponentUser } = await supabase
        .from('users')
        .select('elo')
        .eq('id', opponentId)
        .single();

      const yourElo = currentUser?.elo || 1200;
      const opponentElo = opponentUser?.elo || 1200;

      const isWinner = gameResult.winner_id === userId;
      const isDraw = gameResult.winner_id === null;

      setMatchDetails({
        yourUsername,
        opponentUsername,
        yourScore,
        opponentScore,
        yourElo,
        opponentElo,
        yourEloChange,
        opponentEloChange,
        isWinner,
        isDraw,
        yourAnswers,
        opponentAnswers,
        questions,
      });

      setLoading(false);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
      setLoading(false);
    }
  };

  const toggleQuestion = (index: number) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getResultEmoji = () => {
    if (!matchDetails) return '🎮';
    if (matchDetails.isWinner) return '🏆';
    if (matchDetails.isDraw) return '🤝';
    return '💪';
  };

  const getResultMessage = () => {
    if (!matchDetails) return '';
    if (matchDetails.isWinner) return 'YOU WON!';
    if (matchDetails.isDraw) return 'DRAW!';
    return 'YOU LOST!';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Match Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading match details...</Text>
        </View>
      </View>
    );
  }

  if (error || !matchDetails) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Match Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error || 'Failed to load match'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchMatchDetails}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const TOTAL_QUESTIONS = matchDetails.questions.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Result Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.resultIcon}>{getResultEmoji()}</Text>
        </View>

        {/* Result Message */}
        <Text style={styles.resultTitle}>{getResultMessage()}</Text>

        {/* Battle Results: 2 Player Cards */}
        <View style={styles.battleContainer}>
          {/* Your Card */}
          <View
            style={[
              styles.playerCard,
              matchDetails.isWinner && styles.playerCardWinner,
            ]}
          >
            <View style={styles.playerHeader}>
              <Text style={styles.playerAvatar}>😊</Text>
              <Text style={styles.playerName} numberOfLines={1}>
                {matchDetails.yourUsername}
              </Text>
            </View>

            <View style={styles.playerScore}>
              <Text style={styles.scoreNumber}>{matchDetails.yourScore}</Text>
              <Text style={styles.scoreTotal}>/{TOTAL_QUESTIONS}</Text>
            </View>

            <View style={styles.playerStats}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>ELO</Text>
                <Text style={styles.statValue}>{matchDetails.yourElo}</Text>
              </View>
              <View style={styles.eloChangeContainer}>
                <Text
                  style={[
                    styles.eloChange,
                    matchDetails.yourEloChange > 0
                      ? styles.eloPositive
                      : matchDetails.yourEloChange < 0
                        ? styles.eloNegative
                        : styles.eloNeutral,
                  ]}
                >
                  {matchDetails.yourEloChange > 0 ? '+' : ''}
                  {matchDetails.yourEloChange}{' '}
                  {matchDetails.yourEloChange > 0 ? '⬆️' : matchDetails.yourEloChange < 0 ? '⬇️' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* VS Divider */}
          <View style={styles.vsDivider}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          {/* Opponent Card */}
          <View
            style={[
              styles.playerCard,
              !matchDetails.isWinner &&
              !matchDetails.isDraw &&
              styles.playerCardWinner,
            ]}
          >
            <View style={styles.playerHeader}>
              <Text style={styles.playerAvatar}>🤖</Text>
              <Text style={styles.playerName} numberOfLines={1}>
                {matchDetails.opponentUsername}
              </Text>
            </View>

            <View style={styles.playerScore}>
              <Text style={styles.scoreNumber}>{matchDetails.opponentScore}</Text>
              <Text style={styles.scoreTotal}>/{TOTAL_QUESTIONS}</Text>
            </View>

            <View style={styles.playerStats}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>ELO</Text>
                <Text style={styles.statValue}>{matchDetails.opponentElo}</Text>
              </View>
              <View style={styles.eloChangeContainer}>
                <Text
                  style={[
                    styles.eloChange,
                    matchDetails.opponentEloChange > 0
                      ? styles.eloPositive
                      : matchDetails.opponentEloChange < 0
                        ? styles.eloNegative
                        : styles.eloNeutral,
                  ]}
                >
                  {matchDetails.opponentEloChange > 0 ? '+' : ''}
                  {matchDetails.opponentEloChange}{' '}
                  {matchDetails.opponentEloChange > 0 ? '⬆️' : matchDetails.opponentEloChange < 0 ? '⬇️' : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Answer Breakdown */}
        <View style={styles.breakdownContainer}>
          <Text style={styles.breakdownTitle}>Answer Breakdown</Text>
          {matchDetails.yourAnswers.map((answer, index) => {
            const question = matchDetails.questions[index];
            const isExpanded = expandedQuestions.has(index);
            const opponentAnswer = matchDetails.opponentAnswers[index];

            if (!question) return null;

            return (
              <View key={index}>
                <TouchableOpacity
                  style={[
                    styles.answerItem,
                    answer.isCorrect ? styles.answerCorrect : styles.answerWrong,
                  ]}
                  onPress={() => toggleQuestion(index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.answerNumber}>Q{index + 1}</Text>
                  <Text style={styles.answerIcon}>
                    {answer.isCorrect ? '✅' : '❌'}
                  </Text>
                  <Text style={styles.answerTime}>
                    {answer.timeSpent.toFixed(1)}s
                  </Text>
                  <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.answerDetails}>
                    <Text style={styles.questionText}>{question.question}</Text>

                    {/* Your Answer */}
                    <View style={styles.answerOption}>
                      <Text style={styles.answerLabel}>😊 Your Answer:</Text>
                      <Text
                        style={[
                          styles.answerValue,
                          answer.isCorrect
                            ? styles.correctText
                            : styles.incorrectText,
                        ]}
                      >
                        {question.options[answer.selectedOption]}{' '}
                        {answer.isCorrect ? '✓' : '✗'}
                      </Text>
                    </View>

                    {/* Opponent Answer */}
                    <View style={styles.answerOption}>
                      <Text style={styles.answerLabel}>🤖 Opponent Answer:</Text>
                      <Text
                        style={[
                          styles.answerValue,
                          opponentAnswer?.isCorrect
                            ? styles.correctText
                            : styles.incorrectText,
                        ]}
                      >
                        {question.options[opponentAnswer?.selectedOption]}{' '}
                        {opponentAnswer?.isCorrect ? '✓' : '✗'}
                      </Text>
                    </View>

                    {/* Show correct answer if both wrong */}
                    {!answer.isCorrect && !opponentAnswer?.isCorrect && (
                      <View style={styles.answerOption}>
                        <Text style={styles.answerLabel}>✅ Correct Answer:</Text>
                        <Text style={[styles.answerValue, styles.correctText]}>
                          {question.options[question.correctAnswer]}
                        </Text>
                      </View>
                    )}

                    <View style={styles.topicBadge}>
                      <Text style={styles.topicText}>{question.topic}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: 10,
    marginBottom: 16,
  },
  resultIcon: {
    fontSize: 80,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: 24,
  },
  battleContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
    gap: 8,
  },
  playerCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 3,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  playerCardWinner: {
    borderColor: COLORS.primary,
    borderWidth: 4,
  },
  playerHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  playerAvatar: {
    fontSize: 40,
    marginBottom: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  playerScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 12,
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
  playerStats: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eloChangeContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  eloChange: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  eloPositive: {
    color: '#2E7D32',
  },
  eloNegative: {
    color: '#C62828',
  },
  eloNeutral: {
    color: COLORS.textSecondary,
  },
  vsDivider: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  breakdownContainer: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  answerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  answerCorrect: {
    backgroundColor: '#E8F5E9',
  },
  answerWrong: {
    backgroundColor: '#FFEBEE',
  },
  answerNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    width: 40,
  },
  answerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  answerTime: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 'auto',
  },
  expandIcon: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  answerDetails: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginTop: -8,
    marginBottom: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
    lineHeight: 24,
  },
  answerOption: {
    marginBottom: 12,
  },
  answerLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  answerValue: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  correctText: {
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  incorrectText: {
    color: '#C62828',
    backgroundColor: '#FFEBEE',
  },
  topicBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  topicText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});
