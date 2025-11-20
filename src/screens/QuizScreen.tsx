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
import { saveAnswer } from '../services/database';
import { supabase } from '../lib/supabase';

interface QuizScreenProps {
  username: string;
  userId: string;
  roomId: string;
  questions: Question[];
  onQuizComplete: (answers: Answer[]) => void;
}

export default function QuizScreen({
  username,
  userId,
  roomId,
  questions,
  onQuizComplete,
}: QuizScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Real opponent state (from Supabase)
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [opponentUsername, setOpponentUsername] = useState('Opponent');
  const [opponentElo, setOpponentElo] = useState(1200);
  const [userElo, setUserElo] = useState(1200);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / TOTAL_QUESTIONS) * 100;

  // Fetch player data on mount
  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        // Fetch current user's ELO
        const { data: currentUser } = await supabase
          .from('users')
          .select('elo')
          .eq('id', userId)
          .single();

        if (currentUser) {
          setUserElo(currentUser.elo);
        }

        // Get room to find opponent's ID
        const { data: room } = await supabase
          .from('rooms')
          .select('host_id, guest_id')
          .eq('id', roomId)
          .single();

        if (!room) {
          console.error('Room not found');
          return;
        }

        // Determine opponent's ID
        const isPlayer1 = room.host_id === userId;
        const opponentId = isPlayer1 ? room.guest_id : room.host_id;

        if (!opponentId) {
          console.log('Opponent not yet joined');
          return;
        }

        // Fetch opponent's profile
        const { data: opponent } = await supabase
          .from('users')
          .select('username, elo')
          .eq('id', opponentId)
          .single();

        if (opponent) {
          console.log('Opponent data loaded:', opponent);
          setOpponentUsername(opponent.username);
          setOpponentElo(opponent.elo);
        }
      } catch (err) {
        console.error('Error fetching player data:', err);
      }
    };

    fetchPlayerData();
  }, [roomId, userId]);

  // Real-time opponent subscription - setup once, not per question
  useEffect(() => {
    console.log('Setting up real-time subscription for room:', roomId);
    let subscription: any = null;
    let isPlayer1: boolean | null = null;
    let isMounted = true;

    // First, get room data to determine our role
    const setupSubscription = async () => {
      try {
        const { data: room, error } = await supabase
          .from('rooms')
          .select('host_id, guest_id')
          .eq('id', roomId)
          .single();

        if (error || !room) {
          console.error('Room not found for subscription:', error);
          return;
        }

        if (!isMounted) return;

        isPlayer1 = room.host_id === userId;
        console.log('User role:', isPlayer1 ? 'Player 1 (Host)' : 'Player 2 (Guest)');

        // Subscribe to game_sessions changes
        subscription = supabase
          .channel(`game:${roomId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to INSERT and UPDATE
              schema: 'public',
              table: 'game_sessions',
              filter: `room_id=eq.${roomId}`,
            },
            (payload) => {
              if (!isMounted) return;

              console.log('Game session event:', payload.eventType, payload.new);

              const session = payload.new as any;

              // Get opponent's answer based on our role
              const opponentCorrect = isPlayer1
                ? session.player2_correct
                : session.player1_correct;

              if (opponentCorrect !== null && opponentCorrect !== undefined) {
                console.log('Opponent answered question', session.question_index, '! Correct:', opponentCorrect);

                // Update opponent score
                if (opponentCorrect) {
                  setOpponentScore((prev) => prev + 1);
                }
                setOpponentAnswered(true);
              }
            }
          )
          .subscribe((status) => {
            console.log('Subscription status:', status);
          });
      } catch (err) {
        console.error('Error setting up subscription:', err);
      }
    };

    setupSubscription();

    return () => {
      isMounted = false;
      if (subscription) {
        console.log('Unsubscribing from game updates');
        supabase.removeChannel(subscription);
      }
    };
  }, [roomId, userId]);

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

  const handleTimeout = async () => {
    // Auto-submit with no answer (wrong)
    const timeSpent = (Date.now() - questionStartTime) / 1000;
    const answer: Answer = {
      questionId: currentQuestion.id,
      selectedOption: -1, // -1 means timeout
      isCorrect: false,
      timeSpent,
    };

    // Save timeout answer to Supabase
    try {
      console.log('Saving timeout answer to Supabase...', {
        roomId,
        questionIndex: currentIndex,
        userId,
        answer: -1,
        timeSpent,
        isCorrect: false,
      });

      const { error } = await saveAnswer(
        roomId,
        currentIndex,
        userId,
        -1, // -1 indicates timeout
        timeSpent,
        false
      );

      if (error) {
        console.error('Error saving timeout answer:', error);
      } else {
        console.log('✅ Timeout answer saved!');
      }
    } catch (err) {
      console.error('Unexpected error saving timeout:', err);
    }

    proceedToNext(answer);
  };

  const handleAnswer = async (optionIndex: number) => {
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

    // Save answer to Supabase
    try {
      console.log('Saving answer to Supabase...', {
        roomId,
        questionIndex: currentIndex,
        userId,
        answer: optionIndex,
        timeSpent,
        isCorrect,
      });

      const { error } = await saveAnswer(
        roomId,
        currentIndex,
        userId,
        optionIndex,
        timeSpent,
        isCorrect
      );

      if (error) {
        console.error('Error saving answer:', error);
      } else {
        console.log('✅ Answer saved successfully!');
      }
    } catch (err) {
      console.error('Unexpected error saving answer:', err);
    }

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
          elo={userElo}
          currentScore={answers.filter((a) => a.isCorrect).length}
          totalQuestions={currentIndex}
          isYou={true}
          avatar="😊"
        />
        <PlayerCard
          username={opponentUsername}
          elo={opponentElo}
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
