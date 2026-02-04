import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';

// Required for web browser authentication
WebBrowser.maybeCompleteAuthSession();

interface LoginScreenProps {
  onLoginSuccess: (userId: string, username: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Ref to track if auth is in progress to prevent race conditions
  // Moved to top level so it's accessible by all functions
  const isAuthInProgress = React.useRef(false);

  // Handle deep linking for OAuth callback
  const handleUrl = async (event: { url: string }) => {
    // Check if this is an OAuth callback
    if (event.url.includes('#access_token=') || event.url.includes('?access_token=')) {
      setVerifying(true);
      setLoading(false);

      try {
        const url = event.url;
        const hashPart = url.split('#')[1];
        const queryPart = url.split('?')[1];
        const paramsString = hashPart || queryPart || '';

        const params = new URLSearchParams(paramsString);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            Alert.alert('Authentication Failed', error.message);
            setVerifying(false);
          } else if (data.user) {
            // handleSuccessfulAuth will handle the rest
            await handleSuccessfulAuth(data.user.id);
          } else {
            setVerifying(false);
          }
        } else {
          setVerifying(false);
        }
      } catch (error: any) {
        Alert.alert('Authentication Failed', error.message);
        setVerifying(false);
      }
    }
  };

  const checkExistingSession = async () => {
    // Don't check if auth is already in progress
    if (isAuthInProgress.current) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        await handleSuccessfulAuth(session.user.id);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    checkExistingSession();

    // Listen for AppState changes (background -> foreground)
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkExistingSession();
      }
    });

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Only handle SIGNED_IN if auth is not already in progress
        if (event === 'SIGNED_IN' && session?.user && !isAuthInProgress.current) {
          await handleSuccessfulAuth(session.user.id);
        }
      }
    );

    // Subscribe to URL events
    const urlSubscription = Linking.addEventListener('url', (event: { url: string }) => {
      handleUrl(event);
    });

    // Check initial URL (in case app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });

    // Warm up the browser
    WebBrowser.warmUpAsync();

    return () => {
      appStateSubscription.remove();
      authListener.subscription.unsubscribe();
      urlSubscription.remove();
      WebBrowser.coolDownAsync();
    };
  }, []);

  const handleSuccessfulAuth = async (userId: string) => {
    // Check if already in progress
    if (isAuthInProgress.current) {
      return;
    }

    // Set flag immediately
    isAuthInProgress.current = true;
    setVerifying(true);

    try {

      // Increased timeout to 60 seconds as requested
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timeout - please check your internet connection')), 3000)
      );

      const dbQueryPromise = (async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          throw new Error('No active session found');
        }

        // Small delay for session propagation
        await new Promise(resolve => setTimeout(resolve, 500));

        const result = await supabase
          .from('users')
          .select('id, username')
          .eq('id', userId)
          .single();

        return result;
      })();

      const { data: userData, error: fetchError } = await Promise.race([
        dbQueryPromise,
        timeoutPromise
      ]) as any;

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Database error: ${fetchError.message}`);
      }

      if (userData) {
        // Existing user - call onLoginSuccess and DON'T reset isAuthInProgress
        // The component will unmount/navigate away, so we don't need to reset it

        // Save user data to AsyncStorage for auto-login
        await AsyncStorage.setItem('userId', userData.id);
        await AsyncStorage.setItem('username', userData.username);

        onLoginSuccess(userData.id, userData.username);
        // Don't reset isAuthInProgress - prevents any other handlers from firing
        return;
      } else {
        // New user - create profile
        const { data: userAuth } = await supabase.auth.getUser();

        const userMetadata = userAuth.user?.user_metadata;
        const username =
          userMetadata?.full_name ||
          userMetadata?.name ||
          userAuth.user?.email?.split('@')[0] ||
          'User';

        const insertPromise = (async () => {
          const result = await supabase
            .from('users')
            .insert({
              id: userId,
              username,
              elo: 1200,
              avatar: '😊',
              total_games: 0,
              wins: 0,
              losses: 0,
            })
            .select()
            .single();

          return result;
        })();

        const { data: newUser, error: insertError } = await Promise.race([
          insertPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('User creation timeout')), 60000)
          )
        ]) as any;

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existingUser } = await supabase
              .from('users')
              .select('id, username')
              .eq('id', userId)
              .single();

            if (existingUser) {
              // Save user data to AsyncStorage
              await AsyncStorage.setItem('userId', existingUser.id);
              await AsyncStorage.setItem('username', existingUser.username);

              onLoginSuccess(existingUser.id, existingUser.username);
              return; // Don't reset isAuthInProgress
            }
          }

          throw new Error(`Failed to create profile: ${insertError.message}`);
        }

        if (newUser) {

          // Save user data to AsyncStorage
          await AsyncStorage.setItem('userId', newUser.id);
          await AsyncStorage.setItem('username', newUser.username);

          onLoginSuccess(newUser.id, newUser.username);
          return; // Don't reset isAuthInProgress
        }
      }
    } catch (error: any) {
      // ONLY reset isAuthInProgress on error so user can retry
      isAuthInProgress.current = false;
      setVerifying(false);

      Alert.alert(
        'Login Error',
        error.message || 'Authentication failed. Please check your internet connection and try again.',
        [
          {
            text: 'Retry', onPress: () => {
              checkExistingSession();
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
    // No finally block - we only reset on error
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);

      const redirectUrl = Linking.createURL('/auth');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS === 'web' ? false : true,
          queryParams: {
            prompt: 'select_account', // Force account selection every time
            access_type: 'offline',
          },
        },
      });

      if (error) {
        Alert.alert('Login Failed', error.message);
        setLoading(false);
        return;
      }

      if (data.url) {
        let authUrl = data.url;
        // Force prompt=consent to ensure account selection
        if (authUrl.includes('prompt=')) {
          authUrl = authUrl.replace(/prompt=[^&]+/, 'prompt=consent');
        } else {
          authUrl += '&prompt=consent';
        }

        const result = await WebBrowser.openAuthSessionAsync(
          authUrl,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          await handleUrl({ url: result.url });
        } else if (result.type === 'dismiss') {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error.message || 'Failed to sign in with Google'
      );
      setLoading(false);
    }
  };

  // Show verifying state
  if (verifying) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Authenticating...</Text>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.descriptionText}>
            Confirming your login
          </Text>

          <TouchableOpacity
            style={{ marginTop: 20, padding: 10, backgroundColor: COLORS.white, borderRadius: 8 }}
            onPress={() => {
              // Reset the flag so we can retry
              isAuthInProgress.current = false;
              checkExistingSession();
            }}
          >
            <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>Check Status</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 10, padding: 10 }}
            onPress={() => {
              isAuthInProgress.current = false;
              setVerifying(false);
            }}
          >
            <Text style={{ color: COLORS.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Title */}
        <View style={styles.header}>
          <Text style={styles.logo}>🎮</Text>
          <Text style={styles.title}>LevelUP</Text>
          <Text style={styles.subtitle}>Math Quiz Battle</Text>
        </View>

        {/* Login Section */}
        <View style={styles.loginSection}>
          <Text style={styles.welcomeText}>Welcome!</Text>
          <Text style={styles.descriptionText}>
            Sign in with Google to start playing
          </Text>

          <TouchableOpacity
            style={[styles.googleButton, loading && styles.buttonDisabled]}
            onPress={signInWithGoogle}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#1A1A1A" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.privacyText}>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>⚡</Text>
            <Text style={styles.featureText}>Real-time Multiplayer</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🏆</Text>
            <Text style={styles.featureText}>ELO Rating System</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📊</Text>
            <Text style={styles.featureText}>Track Your Progress</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  loginSection: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 32,
    marginBottom: 32,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  googleButton: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 12,
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  privacyText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
});
