import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { createRoom, joinRoom } from '../services/database';
import { generateRoomCode, formatRoomCode, isValidRoomCode } from '../utils/roomCode';

interface LobbyScreenProps {
  username: string;
  userId: string;
  onRoomCreated: (roomId: string, roomCode: string) => void;
  onRoomJoined: (roomId: string, roomCode: string) => void;
  onViewProfile: () => void;
}

export default function LobbyScreen({
  username,
  userId,
  onRoomCreated,
  onRoomJoined,
  onViewProfile,
}: LobbyScreenProps) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');

    try {
      // Generate unique room code
      const roomCode = generateRoomCode();
      console.log('Creating room with code:', roomCode);

      // Create room in Supabase
      const { data, error: createError } = await createRoom(userId, roomCode);

      if (createError || !data) {
        console.error('Error creating room:', createError);
        Alert.alert(
          'Error',
          'Failed to create room. Please try again.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      console.log('Room created successfully:', data);
      // Navigate to waiting screen
      onRoomCreated(data.id, roomCode);
    } catch (err) {
      console.error('Unexpected error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    const code = formatRoomCode(roomCodeInput);

    // Validate format
    if (!isValidRoomCode(code)) {
      setError('Invalid code format. Use format: ABC123');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Joining room with code:', code);

      // Join room in Supabase
      const { data, error: joinError } = await joinRoom(code, userId);

      if (joinError || !data) {
        console.error('Error joining room:', joinError);
        setError('Room not found or already started. Check the code and try again.');
        setLoading(false);
        return;
      }

      console.log('Joined room successfully:', data);
      // Navigate to quiz screen
      onRoomJoined(data.id, code);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Multiplayer Battle</Text>
          <Text style={styles.subtitle}>Choose your mode</Text>
        </View>

        {/* User Info - Tap to view profile */}
        <TouchableOpacity style={styles.userCard} onPress={onViewProfile} activeOpacity={0.7}>
          <Text style={styles.userEmoji}>👤</Text>
          <Text style={styles.userName}>{username}</Text>
          <Text style={styles.profileHint}>View Profile →</Text>
        </TouchableOpacity>

        {/* Create Room Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.createButton, loading && styles.buttonDisabled]}
            onPress={handleCreateRoom}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.createButtonIcon}>🎮</Text>
                <Text style={styles.createButtonText}>CREATE NEW ROOM</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.createHint}>Host a game and share the code</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Join Room Section */}
        <View style={styles.section}>
          <Text style={styles.inputLabel}>Join Existing Room</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            placeholder="Enter Room Code (e.g., ABC123)"
            placeholderTextColor="#999"
            value={roomCodeInput}
            onChangeText={(text) => {
              setRoomCodeInput(text.toUpperCase());
              setError('');
            }}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[
              styles.joinButton,
              (!roomCodeInput.trim() || loading) && styles.buttonDisabled,
            ]}
            onPress={handleJoinRoom}
            disabled={!roomCodeInput.trim() || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.joinButtonText}>JOIN ROOM</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Create a room and share the code with a friend, or join an existing room to start the battle!
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  userCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  userEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  profileHint: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  createButtonText: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: 'bold',
  },
  createHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#1A1A1A',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 2,
  },
  inputError: {
    borderColor: '#FF4444',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  joinButtonText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  infoCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFE5A3',
    marginTop: 8,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
