import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import QuizScreen from './src/screens/QuizScreen';
import WaitingForOpponentScreen from './src/screens/WaitingForOpponentScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import { Answer } from './src/types';
import { QUESTIONS, TOTAL_QUESTIONS } from './src/utils/questions';

type Screen = 'home' | 'quiz' | 'waiting' | 'results';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [username, setUsername] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);

  const handleStartQuiz = (name: string) => {
    setUsername(name);
    setCurrentScreen('quiz');
  };

  const handleQuizComplete = (quizAnswers: Answer[]) => {
    setAnswers(quizAnswers);
    setCurrentScreen('waiting'); // Go to waiting screen first
  };

  const handleOpponentFinished = () => {
    setCurrentScreen('results'); // Then go to results
  };

  const handlePlayAgain = () => {
    setAnswers([]);
    setCurrentScreen('quiz');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {currentScreen === 'home' && (
        <HomeScreen onStartQuiz={handleStartQuiz} />
      )}

      {currentScreen === 'quiz' && (
        <QuizScreen
          username={username}
          questions={QUESTIONS}
          onQuizComplete={handleQuizComplete}
        />
      )}

      {currentScreen === 'waiting' && (
        <WaitingForOpponentScreen
          username={username}
          yourScore={answers.filter((a) => a.isCorrect).length}
          totalQuestions={TOTAL_QUESTIONS}
          onOpponentFinished={handleOpponentFinished}
        />
      )}

      {currentScreen === 'results' && (
        <ResultsScreen
          username={username}
          answers={answers}
          questions={QUESTIONS}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
