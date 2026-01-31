import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CrossPlatformAlert as Alert } from '../utils/alert';
import { COLORS } from '../theme/colors';
import { getOrCreateUser } from '../services/database';

interface HomeScreenProps {
  onStartQuiz: (username: string, userId: string) => void;
}

export default function HomeScreen({ onStartQuiz }: HomeScreenProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!username.trim()) return;

    setLoading(true);

    try {
      // Test Supabase connection by creating/getting user
      const { data, error } = await getOrCreateUser(username.trim());

      if (error) {
        Alert.alert(
          'Connection Error',
          'Failed to connect to database. Please check your internet connection.',
          [{ text: 'OK' }]
        );
        console.error('Supabase error:', error);
        setLoading(false);
        return;
      }

      if (data) {
        console.log('✅ Supabase connection successful!', data);
        console.log('🎮 Navigating to lobby...');
        // Auto-navigate to lobby screen after successful connection
        onStartQuiz(username.trim(), data.id);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        {/* <View style={styles.logoContainer}>
          <Text style={styles.logoText}>LevelUp</Text>
        </View> */}

        {/* Title */}
        <Text style={styles.title}>LevelUp</Text>
        <Text style={styles.subtitle}>Math Battle Quiz!</Text>

        {/* Username Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Your Name..."
            placeholderTextColor={COLORS.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleStart}
          />
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[
            styles.button,
            (!username.trim() || loading) && styles.buttonDisabled,
          ]}
          onPress={handleStart}
          disabled={!username.trim() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.buttonText}>LOG IN</Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>• 5 Questions</Text>
          <Text style={styles.infoText}>• 10 seconds each</Text>
          <Text style={styles.infoText}>• Test your math skills!</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    color: COLORS.textSecondary,
    marginBottom: 40,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    borderWidth: 2,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginVertical: 4,
  },
});
