import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { Question, Answer } from '../types';
import { TIMER_DURATION } from '../utils/questions';
import { supabase } from '../lib/supabase';

interface PracticeModeScreenProps {
  userId: string;
  username: string;
  onBack: () => void;
  onComplete: (score: number, total: number) => void;
}

export default function PracticeModeScreen({
  userId,
  username,
  onBack,
  onComplete,
}: PracticeModeScreenProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [score, setScore] = useState(0);

  const currentQuestion = questions[currentIndex];
  const timerProgress = (timeLeft / TIMER_DURATION) * 100;

  // Fetch questions based on user ELO
  useEffect(() => {
    fetchPracticeQuestions();
  }, []);

  const fetchPracticeQuestions = async () => {
    try {
      setLoadingQuestions(true);

      // Get user's ELO
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('elo')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Error fetching user ELO:', userError);
        Alert.alert('Error', 'Failed to load your profile');
        return;
      }

      const userElo = userData?.elo || 1000;

      // Fetch questions from RPC function (same as competitive mode)
      const { data: questionsData, error: questionsError } = await supabase.rpc(
        'get_questions_by_elo',
        {
          user_elo: userElo,
          limit_count: 10, // Practice with 10 questions
        }
      );

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        Alert.alert('Error', 'Failed to load practice questions. Please try again.');
        return;
      }

      if (!questionsData || questionsData.length === 0) {
        Alert.alert(
          'No Questions Available',
          'There are not enough questions in the database for your skill level. Please try again later.',
          [{ text: 'OK', onPress: onBack }]
        );
        return;
      }

      // Transform database format to app format
      const transformedQuestions: Question[] = questionsData.map((q: any) => ({
        id: q.id,
        question: q.question_text,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        correctAnswer: q.correct_answer,
        topic: q.topic,
      }));

      console.log('Practice questions loaded:', transformedQuestions.length);
      setQuestions(transformedQuestions);
      setLoadingQuestions(false);
      setQuestionStartTime(Date.now());
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  // Timer countdown
  useEffect(() => {
    if (loadingQuestions || !currentQuestion) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return TIMER_DURATION;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, loadingQuestions]);

  const handleTimeout = () => {
    if (!currentQuestion) return;

    // Record timeout as incorrect
    const answer: Answer = {
      questionId: currentQuestion.id,
      selectedAnswer: -1,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: false,
      timeSpent: TIMER_DURATION,
    };

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    // Move to next question or finish
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setTimeLeft(TIMER_DURATION);
      setQuestionStartTime(Date.now());
    } else {
      finishPractice(newAnswers);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return; // Already answered

    setSelectedAnswer(answerIndex);

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    const isCorrect = answerIndex === currentQuestion.correctAnswer;

    const answer: Answer = {
      questionId: currentQuestion.id,
      selectedAnswer: answerIndex,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      timeSpent,
    };

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (isCorrect) {
      setScore(score + 1);
    }

    // Auto-advance after 1.5 seconds
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedAnswer(null);
        setTimeLeft(TIMER_DURATION);
        setQuestionStartTime(Date.now());
      } else {
        finishPractice(newAnswers);
      }
    }, 1500);
  };

  const finishPractice = (finalAnswers: Answer[]) => {
    const finalScore = finalAnswers.filter((a) => a.isCorrect).length;
    onComplete(finalScore, questions.length);
  };

  if (loadingQuestions) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Practice Mode</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading practice questions...</Text>
        </View>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Practice Mode</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>No questions available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Practice Mode</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress and Score */}
      <View style={styles.progressContainer}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Question {currentIndex + 1}/{questions.length}
          </Text>
          <Text style={styles.scoreText}>Score: {score}</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / questions.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        <View style={styles.timerBar}>
          <View
            style={[
              styles.timerFill,
              {
                width: `${timerProgress}%`,
                backgroundColor: timeLeft <= 5 ? '#FF4444' : COLORS.primary,
              },
            ]}
          />
        </View>
        <Text style={styles.timerText}>{timeLeft}s</Text>
      </View>

      {/* Question */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.questionCard}>
          <Text style={styles.topicBadge}>{currentQuestion.topic}</Text>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </View>

        {/* Answer Options */}
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === currentQuestion.correctAnswer;
            const showResult = selectedAnswer !== null;

            let optionStyle = styles.optionButton;
            if (showResult) {
              if (isSelected && isCorrect) {
                optionStyle = styles.optionCorrect;
              } else if (isSelected && !isCorrect) {
                optionStyle = styles.optionWrong;
              } else if (isCorrect) {
                optionStyle = styles.optionCorrect;
              }
            }

            return (
              <TouchableOpacity
                key={index}
                style={optionStyle}
                onPress={() => handleAnswerSelect(index)}
                disabled={selectedAnswer !== null}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionLabel}>{String.fromCharCode(65 + index)}</Text>
                  <Text style={styles.optionText}>{option}</Text>
                </View>
              </TouchableOpacity>
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
  errorText: {
    fontSize: 16,
    color: COLORS.error,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  timerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  timerBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  timerFill: {
    height: '100%',
    borderRadius: 4,
  },
  timerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  questionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  topicBadge: {
    backgroundColor: COLORS.primaryLight,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  optionCorrect: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  optionWrong: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLabel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
});
