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

                  <View style={styles.answerOption}>
                    <Text style={styles.answerLabel}>Your Answer:</Text>
                    <Text
                      style={[
                        styles.answerValue,
                        answer.isCorrect
                          ? styles.correctText
                          : styles.incorrectText,
                      ]}
                    >
                      {question.options[answer.selectedOption]}
                    </Text>
                  </View>

                  {!answer.isCorrect && (
                    <View style={styles.answerOption}>
                      <Text style={styles.answerLabel}>Correct Answer:</Text>
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
