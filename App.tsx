import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, View, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import WaitingForPlayerScreen from './src/screens/WaitingForPlayerScreen';
import QuizScreen from './src/screens/QuizScreen';
import WaitingForOpponentScreen from './src/screens/WaitingForOpponentScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MatchHistoryScreen from './src/screens/MatchHistoryScreen';
import MatchDetailsScreen from './src/screens/MatchDetailsScreen';
import PracticeModeScreen from './src/screens/PracticeModeScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import { Answer, Question } from './src/types';
import { supabase } from './src/lib/supabase';
import { COLORS } from './src/theme/colors';

type Screen = 'home' | 'lobby' | 'waitingForPlayer' | 'quiz' | 'waitingForOpponent' | 'results' | 'profile' | 'matchHistory' | 'matchDetails' | 'practice' | 'friends';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [userElo, setUserElo] = useState<number>(1000);
  const [roomId, setRoomId] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check for existing session on app start
  useEffect(() => {
    checkExistingSession();
  }, []);

  // Fetch user ELO from database
  const fetchUserElo = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('elo')
        .eq('id', id)
        .single();

      if (!error && data) {
        setUserElo(data.elo || 1000);
      }
    } catch (error) {
      console.error('Error fetching user ELO:', error);
    }
  };

  const checkExistingSession = async () => {
    try {
      console.log('App: Checking for existing session...');

      // First try to get stored user data from AsyncStorage (offline-first)
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedUsername = await AsyncStorage.getItem('username');

      if (storedUserId && storedUsername) {
        console.log('App: Found stored credentials, checking session...');

        try {
          // Check Supabase session with timeout
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Session check timeout')), 5000)
          );

          const sessionPromise = supabase.auth.getSession();

          const { data: { session } } = await Promise.race([
            sessionPromise,
            timeoutPromise
          ]) as any;

          if (session?.user) {
            // Valid session + stored data = auto-login
            console.log('App: Auto-login with valid session:', storedUsername);
            setUserId(storedUserId);
            setUsername(storedUsername);
            await fetchUserElo(storedUserId);
            setCurrentScreen('lobby');
          } else {
            // No session but have stored data - clear it
            console.log('App: Session expired, clearing stored data');
            await AsyncStorage.multiRemove(['userId', 'username']);
          }
        } catch (error) {
          // Network error or timeout - don't auto-login to allow account switching
          console.log('App: Network error, clearing cached credentials');
          await AsyncStorage.multiRemove(['userId', 'username']);
        }
      } else {
        console.log('App: No stored credentials found');
      }
    } catch (error) {
      console.error('App: Error checking session:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleStartQuiz = async (id: string, name: string) => {
    console.log('handleStartQuiz - userId:', id, 'username:', name);
    setUsername(name);
    setUserId(id);
    await fetchUserElo(id);
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

  const handleQuizComplete = (quizAnswers: Answer[], quizQuestions: Question[]) => {
    setAnswers(quizAnswers);
    setQuestions(quizQuestions);
    setCurrentScreen('waitingForOpponent'); // Wait for opponent to finish
  };

  const handleOpponentFinished = () => {
    setCurrentScreen('results'); // Show results
  };

  const handlePlayAgain = () => {
    setAnswers([]);
    setQuestions([]);
    setRoomId('');
    setRoomCode('');
    setCurrentScreen('lobby'); // Back to lobby for new game
  };

  const handleLogout = async () => {
    try {
      console.log('App: Logging out...');

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear ALL AsyncStorage data
      await AsyncStorage.multiRemove(['userId', 'username']);

      // Reset all state
      setUsername('');
      setUserId('');
      setUserElo(1000);
      setRoomId('');
      setRoomCode('');
      setAnswers([]);
      setQuestions([]);
      setCurrentScreen('home');

      console.log('App: Logged out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      // Force clear even if error
      await AsyncStorage.clear();
      setUsername('');
      setUserId('');
      setCurrentScreen('home');
    }
  };

  // Show loading screen while checking auth
  if (isCheckingAuth) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />

        {currentScreen === 'home' && (
          <LoginScreen onLoginSuccess={handleStartQuiz} />
        )}

        {currentScreen === 'lobby' && (
          <LobbyScreen
            username={username}
            userId={userId}
            userElo={userElo}
            onRoomCreated={handleRoomCreated}
            onRoomJoined={handleRoomJoined}
            onViewProfile={() => setCurrentScreen('profile')}
            onViewMatchHistory={() => setCurrentScreen('matchHistory')}
            onPracticeMode={() => setCurrentScreen('practice')}
            onViewFriends={() => setCurrentScreen('friends')}
            onLogout={handleLogout}
          />
        )}

        {currentScreen === 'profile' && (
          <ProfileScreen
            userId={userId}
            onBack={() => setCurrentScreen('lobby')}
          />
        )}

        {currentScreen === 'matchHistory' && (
          <MatchHistoryScreen
            userId={userId}
            onBack={() => setCurrentScreen('lobby')}
            onViewMatchDetails={(matchId) => {
              setSelectedMatchId(matchId);
              setCurrentScreen('matchDetails');
            }}
          />
        )}

        {currentScreen === 'matchDetails' && (
          <MatchDetailsScreen
            matchId={selectedMatchId}
            userId={userId}
            onBack={() => setCurrentScreen('matchHistory')}
          />
        )}

        {currentScreen === 'practice' && (
          <PracticeModeScreen
            userId={userId}
            username={username}
            onBack={() => setCurrentScreen('lobby')}
            onComplete={(score, total) => {
              Alert.alert(
                'Practice Complete!',
                `You scored ${score} out of ${total} questions correctly!`,
                [{ text: 'OK', onPress: () => setCurrentScreen('lobby') }]
              );
            }}
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
            onQuizComplete={handleQuizComplete}
          />
        )}

        {currentScreen === 'waitingForOpponent' && (
          <WaitingForOpponentScreen
            username={username}
            userId={userId}
            roomId={roomId}
            yourScore={answers.filter((a) => a.isCorrect).length}
            totalQuestions={questions.length}
            onOpponentFinished={handleOpponentFinished}
          />
        )}

        {currentScreen === 'results' && (
          <ResultsScreen
            username={username}
            userId={userId}
            roomId={roomId}
            answers={answers}
            questions={questions}
            onPlayAgain={handlePlayAgain}
          />
        )}
        {currentScreen === 'friends' && (
          <FriendsScreen
            userId={userId}
            onBack={() => setCurrentScreen('lobby')}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
  },
});
