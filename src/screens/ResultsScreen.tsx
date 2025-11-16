import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { Answer, Question } from '../types';
import { TOTAL_QUESTIONS } from '../utils/questions';

interface ResultsScreenProps {
  username: string;
  answers: Answer[];
  questions: Question[];
  onPlayAgain: () => void;
}

export default function ResultsScreen({
  username,
  answers,
  questions,
  onPlayAgain,
}: ResultsScreenProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set()
  );

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const wrongCount = answers.length - correctCount;
  const percentage = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
  const averageTime =
    answers.reduce((sum, a) => sum + a.timeSpent, 0) / answers.length;

  // Mock opponent data (nanti dari Supabase)
  const opponentScore = 3; // Fake: opponent dapat 3 correct
  const opponentPercentage = Math.round((opponentScore / TOTAL_QUESTIONS) * 100);

  // Mock opponent answers (fake data - nanti dari Supabase)
  const opponentAnswers = [
    { questionId: 1, selectedOption: 1, isCorrect: true },   // Q1: Correct
    { questionId: 2, selectedOption: 0, isCorrect: false },  // Q2: Wrong
    { questionId: 3, selectedOption: 1, isCorrect: true },   // Q3: Correct
    { questionId: 4, selectedOption: 2, isCorrect: true },   // Q4: Correct
    { questionId: 5, selectedOption: 0, isCorrect: false },  // Q5: Wrong
  ]; // Total: 3 correct

  // Determine winner
  const isWinner = correctCount > opponentScore;
  const isDraw = correctCount === opponentScore;

  // Mock ELO changes (fake data)
  const yourEloChange = isWinner ? +15 : isDraw ? 0 : -12;
  const opponentEloChange = isWinner ? -12 : isDraw ? 0 : +15;
  const yourCurrentElo = 1450; // Fake current ELO
  const opponentCurrentElo = 1280; // Fake opponent ELO

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
    if (isWinner) return '🏆';
    if (isDraw) return '🤝';
    return '💪';
  };

  const getResultMessage = () => {
    if (isWinner) return 'YOU WIN!';
    if (isDraw) return 'DRAW!';
    return 'YOU LOSE!';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Result Icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.resultIcon}>{getResultEmoji()}</Text>
      </View>

      {/* Result Message */}
      <Text style={styles.resultTitle}>{getResultMessage()}</Text>

      {/* Battle Results: 2 Player Cards */}
      <View style={styles.battleContainer}>
        {/* Your Card */}
        <View style={[styles.playerCard, isWinner && styles.playerCardWinner]}>
          <View style={styles.playerHeader}>
            <Text style={styles.playerAvatar}>😊</Text>
            <Text style={styles.playerName} numberOfLines={1}>
              {username}
            </Text>
          </View>

          <View style={styles.playerScore}>
            <Text style={styles.scoreNumber}>{correctCount}</Text>
            <Text style={styles.scoreTotal}>/{TOTAL_QUESTIONS}</Text>
          </View>

          <View style={styles.playerStats}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>ELO</Text>
              <Text style={styles.statValue}>{yourCurrentElo}</Text>
            </View>
            <View style={styles.eloChangeContainer}>
              <Text
                style={[
                  styles.eloChange,
                  yourEloChange > 0
                    ? styles.eloPositive
                    : yourEloChange < 0
                    ? styles.eloNegative
                    : styles.eloNeutral,
                ]}
              >
                {yourEloChange > 0 ? '+' : ''}
                {yourEloChange} ⬆️
              </Text>
            </View>
          </View>
        </View>

        {/* VS Divider */}
        <View style={styles.vsDivider}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Opponent Card */}
        <View style={[styles.playerCard, !isWinner && !isDraw && styles.playerCardWinner]}>
          <View style={styles.playerHeader}>
            <Text style={styles.playerAvatar}>🤖</Text>
            <Text style={styles.playerName}>Opponent</Text>
          </View>

          <View style={styles.playerScore}>
            <Text style={styles.scoreNumber}>{opponentScore}</Text>
            <Text style={styles.scoreTotal}>/{TOTAL_QUESTIONS}</Text>
          </View>

          <View style={styles.playerStats}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>ELO</Text>
              <Text style={styles.statValue}>{opponentCurrentElo}</Text>
            </View>
            <View style={styles.eloChangeContainer}>
              <Text
                style={[
                  styles.eloChange,
                  opponentEloChange > 0
                    ? styles.eloPositive
                    : opponentEloChange < 0
                    ? styles.eloNegative
                    : styles.eloNeutral,
                ]}
              >
                {opponentEloChange > 0 ? '+' : ''}
                {opponentEloChange} {opponentEloChange > 0 ? '⬆️' : '⬇️'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Answer Breakdown */}
      <View style={styles.breakdownContainer}>
        <Text style={styles.breakdownTitle}>Answer Breakdown</Text>
        {answers.map((answer, index) => {
          const question = questions.find((q) => q.id === answer.questionId);
          const isExpanded = expandedQuestions.has(index);

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
                        opponentAnswers[index]?.isCorrect
                          ? styles.correctText
                          : styles.incorrectText,
                      ]}
                    >
                      {question.options[opponentAnswers[index]?.selectedOption]}{' '}
                      {opponentAnswers[index]?.isCorrect ? '✓' : '✗'}
                    </Text>
                  </View>

                  {/* Show correct answer if both wrong */}
                  {!answer.isCorrect && !opponentAnswers[index]?.isCorrect && (
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

      {/* Buttons */}
      <TouchableOpacity
        style={styles.playAgainButton}
        onPress={onPlayAgain}
        activeOpacity={0.8}
      >
        <Text style={styles.playAgainText}>PLAY AGAIN</Text>
      </TouchableOpacity>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: 20,
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
  username: {
    fontSize: 20,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  // Battle Results Styles
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
  scoreCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  scoreLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  scorePercentage: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 20,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
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
  playAgainButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  playAgainText: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 8,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
