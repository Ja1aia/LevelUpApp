import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import WaitingForPlayerScreen from './src/screens/WaitingForPlayerScreen';
import QuizScreen from './src/screens/QuizScreen';
import WaitingForOpponentScreen from './src/screens/WaitingForOpponentScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import { Answer } from './src/types';
import { QUESTIONS, TOTAL_QUESTIONS } from './src/utils/questions';
import { getOrCreateUser } from './src/services/database';

type Screen = 'home' | 'lobby' | 'waitingForPlayer' | 'quiz' | 'waitingForOpponent' | 'results';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);

  const handleStartQuiz = async (name: string, id: string) => {
    setUsername(name);
    setUserId(id); // Store user ID from Supabase
    setCurrentScreen('lobby');
  };

  const handleRoomCreated = (newRoomId: string, newRoomCode: string) => {
    setRoomId(newRoomId);
    setRoomCode(newRoomCode);
    setCurrentScreen('waitingForPlayer'); // Host waits for player 2
  };

  const handleRoomJoined = (newRoomId: string, newRoomCode: string) => {
    setRoomId(newRoomId);
    setRoomCode(newRoomCode);
    setCurrentScreen('quiz'); // Guest goes straight to quiz
  };

  const handlePlayerJoined = () => {
    setCurrentScreen('quiz'); // Host starts quiz when player 2 joins
  };

  const handleCancelRoom = () => {
    setRoomId('');
    setRoomCode('');
    setCurrentScreen('lobby'); // Go back to lobby
  };

  const handleQuizComplete = (quizAnswers: Answer[]) => {
    setAnswers(quizAnswers);
    setCurrentScreen('waitingForOpponent'); // Wait for opponent to finish
  };

  const handleOpponentFinished = () => {
    setCurrentScreen('results'); // Show results
  };

  const handlePlayAgain = () => {
    setAnswers([]);
    setRoomId('');
    setRoomCode('');
    setCurrentScreen('lobby'); // Back to lobby for new game
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />

        {currentScreen === 'home' && (
          <HomeScreen onStartQuiz={handleStartQuiz} />
        )}

      {currentScreen === 'lobby' && (
        <LobbyScreen
          username={username}
          userId={userId}
          onRoomCreated={handleRoomCreated}
          onRoomJoined={handleRoomJoined}
        />
      )}

      {currentScreen === 'waitingForPlayer' && (
        <WaitingForPlayerScreen
          roomId={roomId}
          roomCode={roomCode}
          username={username}
          onPlayerJoined={handlePlayerJoined}
          onCancel={handleCancelRoom}
        />
      )}

      {currentScreen === 'quiz' && (
        <QuizScreen
          username={username}
          userId={userId}
          roomId={roomId}
          questions={QUESTIONS}
          onQuizComplete={handleQuizComplete}
        />
      )}

      {currentScreen === 'waitingForOpponent' && (
        <WaitingForOpponentScreen
          username={username}
          userId={userId}
          roomId={roomId}
          yourScore={answers.filter((a) => a.isCorrect).length}
          totalQuestions={TOTAL_QUESTIONS}
          onOpponentFinished={handleOpponentFinished}
        />
      )}

        {currentScreen === 'results' && (
          <ResultsScreen
            username={username}
            userId={userId}
            roomId={roomId}
            answers={answers}
            questions={QUESTIONS}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
