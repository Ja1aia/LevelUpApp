import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import QuizScreen from './src/screens/QuizScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import { Answer } from './src/types';
import { QUESTIONS } from './src/utils/questions';

type Screen = 'home' | 'quiz' | 'results';

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
    setCurrentScreen('results');
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
