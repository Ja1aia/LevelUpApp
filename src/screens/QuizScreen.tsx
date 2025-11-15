import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { Question, Answer } from '../types';
import { TIMER_DURATION, TOTAL_QUESTIONS } from '../utils/questions';
import PlayerCard from '../components/PlayerCard';

interface QuizScreenProps {
  username: string;
  questions: Question[];
  onQuizComplete: (answers: Answer[]) => void;
}

export default function QuizScreen({
  username,
  questions,
  onQuizComplete,
}: QuizScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Mock opponent state
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentAnswered, setOpponentAnswered] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / TOTAL_QUESTIONS) * 100;

  // Mock opponent behavior (Smart: 70% correct)
  useEffect(() => {
    setOpponentAnswered(false);

    // Random delay between 2-6 seconds
    const randomDelay = Math.random() * 4000 + 2000;

    const timer = setTimeout(() => {
      // 70% chance to answer correctly
      const isCorrect = Math.random() < 0.7;
      if (isCorrect) {
        setOpponentScore((prev) => prev + 1);
      }
      setOpponentAnswered(true);
    }, randomDelay);

    return () => clearTimeout(timer);
  }, [currentIndex]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === 0) {
      handleTimeout();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleTimeout = () => {
    // Auto-submit with no answer (wrong)
    const timeSpent = (Date.now() - questionStartTime) / 1000;
    const answer: Answer = {
      questionId: currentQuestion.id,
      selectedOption: -1, // -1 means timeout
      isCorrect: false,
      timeSpent,
    };
    proceedToNext(answer);
  };

  const handleAnswer = (optionIndex: number) => {
    if (selectedAnswer !== null) return; // Already answered

    const timeSpent = (Date.now() - questionStartTime) / 1000;
    const isCorrect = optionIndex === currentQuestion.correctAnswer;

    const answer: Answer = {
      questionId: currentQuestion.id,
      selectedOption: optionIndex,
      isCorrect,
      timeSpent,
    };

    setSelectedAnswer(optionIndex);

    // Show feedback for 1 second
    setTimeout(() => {
      proceedToNext(answer);
    }, 1000);
  };

  const proceedToNext = (answer: Answer) => {
    const newAnswers = [...answers, answer];

    if (currentIndex < questions.length - 1) {
      // Next question
      setAnswers(newAnswers);
      setCurrentIndex(currentIndex + 1);
      setTimeLeft(TIMER_DURATION);
      setSelectedAnswer(null);
      setQuestionStartTime(Date.now());
    } else {
      // Quiz complete
      onQuizComplete(newAnswers);
    }
  };

  const getButtonStyle = (index: number) => {
    if (selectedAnswer === null) {
      return styles.optionButton;
    }

    if (index === selectedAnswer) {
      return selectedAnswer === currentQuestion.correctAnswer
        ? styles.optionButtonCorrect
        : styles.optionButtonWrong;
    }

    if (index === currentQuestion.correctAnswer) {
      return styles.optionButtonCorrect;
    }

    return styles.optionButtonDisabled;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.questionNumber}>
          Question {currentIndex + 1}/{TOTAL_QUESTIONS}
        </Text>
        <View style={styles.timerContainer}>
          <Text style={styles.timer}>⏱️ {timeLeft}s</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      {/* Battle Mode: 2 Player Cards (Horizontal) */}
      <View style={styles.playersContainer}>
        <PlayerCard
          username={username}
          elo={1450}
          currentScore={answers.filter((a) => a.isCorrect).length}
          totalQuestions={currentIndex}
          isYou={true}
          avatar="😊"
        />
        <PlayerCard
          username="Opponent"
          elo={1280}
          currentScore={opponentScore}
          totalQuestions={currentIndex}
          isYou={false}
          avatar="🤖"
        />
      </View>

      {/* Question */}
      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{currentQuestion.question}</Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {currentQuestion.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={getButtonStyle(index)}
            onPress={() => handleAnswer(index)}
            disabled={selectedAnswer !== null}
            activeOpacity={0.7}
          >
            <Text style={styles.optionText}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  timerContainer: {
    backgroundColor: COLORS.white,
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
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  playersContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  questionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
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
  optionButtonCorrect: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  optionButtonWrong: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  optionButtonDisabled: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    opacity: 0.5,    
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  optionText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
});
