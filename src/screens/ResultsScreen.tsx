import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { Answer } from '../types';
import { TOTAL_QUESTIONS } from '../utils/questions';

interface ResultsScreenProps {
  username: string;
  answers: Answer[];
  onPlayAgain: () => void;
}

export default function ResultsScreen({
  username,
  answers,
  onPlayAgain,
}: ResultsScreenProps) {
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const wrongCount = answers.length - correctCount;
  const percentage = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
  const averageTime =
    answers.reduce((sum, a) => sum + a.timeSpent, 0) / answers.length;

  const getResultEmoji = () => {
    if (percentage >= 80) return '🏆';
    if (percentage >= 60) return '🎉';
    if (percentage >= 40) return '👍';
    return '💪';
  };

  const getResultMessage = () => {
    if (percentage >= 80) return 'Excellent!';
    if (percentage >= 60) return 'Good Job!';
    if (percentage >= 40) return 'Not Bad!';
    return 'Keep Practicing!';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Result Icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.resultIcon}>{getResultEmoji()}</Text>
      </View>

      {/* Result Message */}
      <Text style={styles.resultTitle}>{getResultMessage()}</Text>
      <Text style={styles.username}>{username}</Text>

      {/* Score Card */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Your Score</Text>
        <Text style={styles.scoreValue}>
          {correctCount} / {TOTAL_QUESTIONS}
        </Text>
        <Text style={styles.scorePercentage}>{percentage}%</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{correctCount}</Text>
          <Text style={styles.statLabel}>✅ Correct</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{wrongCount}</Text>
          <Text style={styles.statLabel}>❌ Wrong</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{averageTime.toFixed(1)}s</Text>
          <Text style={styles.statLabel}>⏱️ Avg Time</Text>
        </View>
      </View>

      {/* Answer Breakdown */}
      <View style={styles.breakdownContainer}>
        <Text style={styles.breakdownTitle}>Answer Breakdown</Text>
        {answers.map((answer, index) => (
          <View
            key={index}
            style={[
              styles.answerItem,
              answer.isCorrect ? styles.answerCorrect : styles.answerWrong,
            ]}
          >
            <Text style={styles.answerNumber}>Q{index + 1}</Text>
            <Text style={styles.answerIcon}>
              {answer.isCorrect ? '✅' : '❌'}
            </Text>
            <Text style={styles.answerTime}>
              {answer.timeSpent.toFixed(1)}s
            </Text>
          </View>
        ))}
      </View>

      {/* Buttons */}
      <TouchableOpacity
        style={styles.playAgainButton}
        onPress={onPlayAgain}
        activeOpacity={0.8}
      >
        <Text style={styles.playAgainText}>PLAY AGAIN</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Great job! Keep practicing! 💚</Text>
      </View>
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
    marginBottom: 8,
  },
  username: {
    fontSize: 20,
    color: COLORS.textSecondary,
    marginBottom: 24,
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
