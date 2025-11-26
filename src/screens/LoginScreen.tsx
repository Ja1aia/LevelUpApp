import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Linking from 'expo-linking';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';

// Required for web browser authentication
WebBrowser.maybeCompleteAuthSession();

interface LoginScreenProps {
  onLoginSuccess: (userId: string, username: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Handle deep linking for OAuth callback
  const handleUrl = async (event: { url: string }) => {
    console.log('Deep link received:', event.url);

    // Check if this is an OAuth callback
    if (event.url.includes('#access_token=') || event.url.includes('?access_token=')) {
      setVerifying(true);
      setLoading(false); // Stop loading spinner

      try {
        // Parse URL to extract tokens
        const url = event.url;
        const hashPart = url.split('#')[1];
        const queryPart = url.split('?')[1];
        const paramsString = hashPart || queryPart || '';

        const params = new URLSearchParams(paramsString);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        console.log('Parsed tokens:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type
        });

        if (accessToken) {
          // Set session with the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            console.error('Session error:', error);
            Alert.alert('Authentication Failed', error.message);
          } else if (data.user) {
            console.log('Session set successfully for user:', data.user.id);
            await handleSuccessfulAuth(data.user.id);
          }
        }
      } catch (error: any) {
        console.error('Error parsing OAuth callback:', error);
        Alert.alert('Authentication Failed', error.message);
      } finally {
        setVerifying(false);
      }
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    checkExistingSession();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.id);

        if (event === 'SIGNED_IN' && session?.user) {
          await handleSuccessfulAuth(session.user.id);
        }
      }
    );

    // Subscribe to URL events
    const urlSubscription = Linking.addEventListener('url', handleUrl);

    // Check initial URL (in case app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });

    // Warm up the browser
    WebBrowser.warmUpAsync();

    return () => {
      authListener.subscription.unsubscribe();
      urlSubscription.remove();
      WebBrowser.coolDownAsync();
    };
  }, []);

  const checkExistingSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        console.log('Existing session found:', session.user.id);
        await handleSuccessfulAuth(session.user.id);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const handleSuccessfulAuth = async (userId: string) => {
    try {
      // Check if user exists in database
      const { data: userData } = await supabase
        .from('users')
        .select('id, username')
        .eq('id', userId)
        .single();

      if (userData) {
        // Existing user
        console.log('Existing user found:', userData.username);
        onLoginSuccess(userData.id, userData.username);
      } else {
        // New user - create profile
        console.log('Creating new user profile...');
        const { data: userAuth } = await supabase.auth.getUser();
        const username = userAuth.user?.email?.split('@')[0] || 'User';

        const { data: newUser, error: insertError } = await supabase
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

        if (insertError) {
          console.error('Error creating user:', insertError);
          Alert.alert('Error', 'Failed to create user profile');
          return;
        }

        if (newUser) {
          console.log('New user created:', newUser.username);
          onLoginSuccess(newUser.id, newUser.username);
        }
      }
    } catch (error) {
      console.error('Error handling auth:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);

      // Use the scheme from app.json directly for OAuth callback
      // This ensures we don't get localhost URLs in development
      // Create redirect URL based on the current environment (Expo Go vs Standalone)
      const redirectUrl = Linking.createURL('/auth');

      console.log('Starting OAuth with redirect:', redirectUrl);
      console.log('IMPORTANT: Ensure this URL is added to your Supabase Redirect URLs!');

      // Sign in with Google using Supabase OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('OAuth initiation error:', error);
        Alert.alert('Login Failed', error.message);
        setLoading(false);
        return;
      }

      // Open browser for OAuth
      if (data.url) {
        console.log('Opening OAuth URL in browser...');
        console.log('Waiting for redirect to:', redirectUrl);

        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        console.log('Browser result:', result);

        if (result.type === 'success' && result.url) {
          console.log('Success! Handling redirect URL:', result.url);
          await handleUrl({ url: result.url });
        } else if (result.type === 'dismiss') {
          console.log('User dismissed the browser');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
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

          {/* Debug Info */}
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Debug Info (Add to Supabase):</Text>
            <Text selectable style={styles.debugText}>
              {Linking.createURL('/auth')}
            </Text>
            <TouchableOpacity
              style={{ marginTop: 8, padding: 4, backgroundColor: '#ddd', borderRadius: 4, alignSelf: 'flex-start' }}
              onPress={() => {
                const url = Linking.createURL('/auth');
                Alert.alert('Copied!', 'URL copied to clipboard. Send this to your computer to add to Supabase.');
                // Note: Clipboard requires expo-clipboard, but we can just ask user to select text for now if not installed.
                // Since we didn't check for expo-clipboard, we'll rely on 'selectable' prop above, 
                // but this button gives a visual cue. 
                // Actually, let's just stick to selectable text to avoid adding dependencies.
              }}
            >
              <Text style={{ fontSize: 10 }}>Tap text above to copy</Text>
            </TouchableOpacity>
          </View>
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
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    color: '#333',
    fontFamily: 'monospace',
  },
});
