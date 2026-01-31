import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { CrossPlatformAlert as Alert } from '../utils/alert';
import { COLORS } from '../theme/colors';
import { Question, Answer } from '../types';
import { TIMER_DURATION } from '../utils/questions';
import { supabase } from '../lib/supabase';
import { getQuestionsByElo } from '../services/database';
import PlayerCard from '../components/PlayerCard';

const { width } = Dimensions.get('window');

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
  const [userElo, setUserElo] = useState(1000);

  const currentQuestion = questions[currentIndex];
  const timerProgress = (timeLeft / TIMER_DURATION) * 100;
  const score = answers.filter((a) => a.isCorrect).length;


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

      const fetchedElo = userData?.elo || 1000;
      setUserElo(fetchedElo);

      // Fetch questions using shared function (handles recent question filtering)
      const fetchedQuestions = await getQuestionsByElo(fetchedElo, 10, [userId]);

      if (!fetchedQuestions || fetchedQuestions.length === 0) {
        Alert.alert(
          'No Questions Available',
          'There are not enough questions in the database for your skill level. Please try again later.',
          [{ text: 'OK', onPress: onBack }]
        );
        return;
      }

      console.log('Practice questions loaded:', fetchedQuestions.length);
      setQuestions(fetchedQuestions);
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

    if (timeLeft === 0) {
      handleTimeout();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, loadingQuestions]);

  const handleTimeout = () => {
    if (!currentQuestion) return;

    // Record timeout as incorrect
    const answer: Answer = {
      questionId: currentQuestion.id,
      selectedOption: -1,
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
      selectedOption: answerIndex,
      isCorrect,
      timeSpent,
    };

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

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
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>No questions available</Text>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back to Lobby</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header - sama dengan QuizScreen */}
      <View style={styles.header}>
        <View>
          <Text style={styles.questionNumber}>
            Question {currentIndex + 1}/{questions.length}
          </Text>
          {currentQuestion?.topic && (
            <Text style={styles.topicText}>{currentQuestion.topic}</Text>
          )}
        </View>
        <View style={styles.timerContainer}>
          <Text style={styles.timer}>⏱️ {timeLeft}s</Text>
        </View>
      </View>

      {/* Timer Progress Bar - sama dengan QuizScreen */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${timerProgress}%` }]} />
      </View>

      {/* Single Player Card for Practice Mode */}
      <View style={styles.playersContainer}>
        <PlayerCard
          username={username}
          elo={userElo}
          currentScore={score}
          totalQuestions={currentIndex}
          isYou={true}
          avatar="😊"
        />
      </View>

      {/* Question Card - dari PracticeMode style */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </View>

        {/* Answer Options - dari PracticeMode style */}
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

      {/* Cancel Button */}
      <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelButtonText}>Cancel Practice</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  // Header styles - dari QuizScreen
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    backgroundColor: COLORS.white,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  topicText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  timerContainer: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: COLORS.border,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  playersContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  // Question and Options - dari PracticeMode style
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
  cancelButton: {
    margin: 16,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
