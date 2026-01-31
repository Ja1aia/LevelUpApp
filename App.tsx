import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, View, Platform } from 'react-native';
import { AlertProvider, CrossPlatformAlert as Alert } from './src/utils/alert';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import LoginScreen from './src/screens/LoginScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import MatchmakingScreen from './src/screens/MatchmakingScreen';
import WaitingForPlayerScreen from './src/screens/WaitingForPlayerScreen';
import QuizScreen from './src/screens/QuizScreen';
import WaitingForOpponentScreen from './src/screens/WaitingForOpponentScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MatchHistoryScreen from './src/screens/MatchHistoryScreen';
import MatchDetailsScreen from './src/screens/MatchDetailsScreen';
import PracticeModeScreen from './src/screens/PracticeModeScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import CommunityListScreen from './src/screens/CommunityListScreen';
import CreateCommunityScreen from './src/screens/CreateCommunityScreen';
import CommunityHubScreen from './src/screens/CommunityHubScreen';
import CommunityManagementScreen from './src/screens/CommunityManagementScreen';
import CreateTournamentScreen from './src/screens/CreateTournamentScreen';
import TournamentViewScreen from './src/screens/TournamentViewScreen';
import { Answer, Question } from './src/types';
import { supabase } from './src/lib/supabase';
import { COLORS } from './src/theme/colors';

type Screen = 'home' | 'lobby' | 'matchmaking' | 'waitingForPlayer' | 'quiz' | 'waitingForOpponent' | 'results' | 'profile' | 'matchHistory' | 'matchDetails' | 'practice' | 'friends' | 'leaderboard' | 'communityList' | 'createCommunity' | 'communityHub' | 'communityManagement' | 'createTournament' | 'tournamentView';

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
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedCommunityName, setSelectedCommunityName] = useState('');
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
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
      // Silent error handling
    }
  };

  const checkExistingSession = async () => {
    try {
      // First try to get stored user data from AsyncStorage (offline-first)
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedUsername = await AsyncStorage.getItem('username');

      if (storedUserId && storedUsername) {
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
            setUserId(storedUserId);
            setUsername(storedUsername);
            await fetchUserElo(storedUserId);
            setCurrentScreen('lobby');
          } else {
            // No session but have stored data - clear it
            await AsyncStorage.multiRemove(['userId', 'username']);
          }
        } catch (error) {
          // Network error or timeout - don't auto-login to allow account switching
          await AsyncStorage.multiRemove(['userId', 'username']);
        }
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleStartQuiz = async (id: string, name: string) => {
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
      // 1. Sign out from Supabase with global scope
      await supabase.auth.signOut({ scope: 'global' });

      // 2. Clear ALL AsyncStorage data (including Supabase storage keys)
      const allKeys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(allKeys);

      // 3. Clear WebBrowser cookies/cache (important for Google OAuth)
      try {
        await WebBrowser.maybeCompleteAuthSession();
      } catch (e) {
        // Silent error handling
      }

      // 4. Reset all state
      setUsername('');
      setUserId('');
      setUserElo(1000);
      setRoomId('');
      setRoomCode('');
      setAnswers([]);
      setQuestions([]);
      setCurrentScreen('home');

      // 5. For Web: Force page reload to clear all cached state
      if (Platform.OS === 'web') {
        // Small delay to ensure state updates complete
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        Alert.alert('Logged Out', 'You have been successfully logged out.');
      }
    } catch (error) {
      // Force clear even if error
      await AsyncStorage.clear();
      setUsername('');
      setUserId('');
      setCurrentScreen('home');

      // Force reload on web even on error
      if (Platform.OS === 'web') {
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    }
  };

  // Show loading screen while checking auth
  if (isCheckingAuth) {
    return (
      <AlertProvider>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
      </AlertProvider>
    );
  }

  return (
    <AlertProvider>
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
            onMatchmakingStart={() => setCurrentScreen('matchmaking')}
            onViewProfile={() => setCurrentScreen('profile')}
            onViewMatchHistory={() => setCurrentScreen('matchHistory')}
            onPracticeMode={() => setCurrentScreen('practice')}
            onViewFriends={() => setCurrentScreen('friends')}
            onViewCommunity={() => setCurrentScreen('communityList')}
            onViewLeaderboard={() => setCurrentScreen('leaderboard')}
            onLogout={handleLogout}
          />
        )}

        {currentScreen === 'matchmaking' && (
          <MatchmakingScreen
            userId={userId}
            username={username}
            userElo={userElo}
            onMatchFound={handleRoomJoined}
            onCancel={() => setCurrentScreen('lobby')}
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
            username={username}
            onBack={() => setCurrentScreen('lobby')}
            onRoomCreated={handleRoomCreated}
            onRoomJoined={handleRoomJoined}
          />
        )}
        {currentScreen === 'leaderboard' && (
          <LeaderboardScreen
            userId={userId}
            onBack={() => setCurrentScreen('lobby')}
          />
        )}

        {currentScreen === 'communityList' && (
          <CommunityListScreen
            userId={userId}
            onBack={() => setCurrentScreen('lobby')}
            onCreateCommunity={() => setCurrentScreen('createCommunity')}
            onViewCommunityHub={() => setCurrentScreen('communityHub')}
          />
        )}

        {currentScreen === 'createCommunity' && (
          <CreateCommunityScreen
            userId={userId}
            onBack={() => setCurrentScreen('communityList')}
            onCommunityCreated={() => setCurrentScreen('communityHub')}
          />
        )}

        {currentScreen === 'communityHub' && (
          <CommunityHubScreen
            userId={userId}
            username={username}
            onBack={() => setCurrentScreen('lobby')}
            onManageCommunity={() => setCurrentScreen('communityManagement')}
            onCreateTournament={(communityId, communityName) => {
              setSelectedCommunityId(communityId);
              setSelectedCommunityName(communityName);
              setCurrentScreen('createTournament');
            }}
            onViewTournament={(tournamentId) => {
              setSelectedTournamentId(tournamentId);
              setCurrentScreen('tournamentView');
            }}
            onRoomCreated={handleRoomCreated}
          />
        )}

        {currentScreen === 'communityManagement' && (
          <CommunityManagementScreen
            userId={userId}
            onBack={() => setCurrentScreen('communityHub')}
          />
        )}

        {currentScreen === 'createTournament' && (
          <CreateTournamentScreen
            userId={userId}
            communityId={selectedCommunityId}
            communityName={selectedCommunityName}
            onBack={() => setCurrentScreen('communityHub')}
            onTournamentCreated={() => setCurrentScreen('communityHub')}
          />
        )}

        {currentScreen === 'tournamentView' && (
          <TournamentViewScreen
            userId={userId}
            tournamentId={selectedTournamentId}
            onBack={() => setCurrentScreen('communityHub')}
            onMatchRoomCreated={handleRoomCreated}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
    </AlertProvider>
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
