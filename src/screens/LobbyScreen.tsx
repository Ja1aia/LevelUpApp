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
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { createRoom, joinRoom } from '../services/database';
import { generateRoomCode, formatRoomCode, isValidRoomCode } from '../utils/roomCode';

interface LobbyScreenProps {
  username: string;
  userId: string;
  userElo: number;
  onRoomCreated: (roomId: string, roomCode: string) => void;
  onRoomJoined: (roomId: string, roomCode: string) => void;
  onViewProfile: () => void;
  onViewMatchHistory: () => void;
  onPracticeMode: () => void;
  onViewFriends: () => void;
  onViewCommunity: () => void;
  onViewLeaderboard: () => void;
  onLogout: () => void;
}

export default function LobbyScreen({
  username,
  userId,
  userElo,
  onRoomCreated,
  onRoomJoined,
  onViewProfile,
  onViewCommunity,
  onViewMatchHistory,
  onPracticeMode,
  onViewFriends,
  onViewLeaderboard,
  onLogout,
}: LobbyScreenProps) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');

    try {
      // Generate unique room code
      const roomCode = generateRoomCode();
      console.log('Creating room with code:', roomCode);
      console.log('Host userId:', userId);
      console.log('Host username:', username);

      // Create room in Supabase
      const { data, error: createError } = await createRoom(userId, roomCode);

      if (createError || !data) {
        console.error('Error creating room:', createError);
        console.error('Error details:', JSON.stringify(createError, null, 2));
        const errorMessage = createError instanceof Error
          ? createError.message
          : (createError as any)?.message || 'Unknown error';
        Alert.alert(
          'Error',
          `Failed to create room: ${errorMessage}`,
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      console.log('Room created successfully:', data);
      // Navigate to waiting screen
      onRoomCreated(data.id, roomCode);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      Alert.alert('Error', err?.message || 'Something went wrong. Please try again.');
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar with Burger Menu */}
          <View style={styles.topBar}>
            <View style={styles.topBarSpacer} />

            {/* Burger Menu Button */}
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setMenuVisible(!menuVisible)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>

            {/* Dropdown Menu with TouchableWithoutFeedback */}
            {menuVisible && (
              <>
                <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                  <View style={styles.menuOverlay} />
                </TouchableWithoutFeedback>
                <View style={styles.dropdown}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuVisible(false);
                      onViewLeaderboard();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownText}>🏆 Leaderboard</Text>
                  </TouchableOpacity>

                  <View style={styles.dropdownDivider} />

                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuVisible(false);
                      onViewFriends();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownText}>👥 Friends</Text>
                  </TouchableOpacity>

                  <View style={styles.dropdownDivider} />

                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuVisible(false);
                      onViewCommunity();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownText}>🏛️ Community</Text>
                  </TouchableOpacity>

                  <View style={styles.dropdownDivider} />

                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuVisible(false);
                      onPracticeMode();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownText}>🎯 Practice Mode</Text>
                  </TouchableOpacity>

                  <View style={styles.dropdownDivider} />

                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuVisible(false);
                      onViewMatchHistory();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownText}>📜 Match History</Text>
                  </TouchableOpacity>

                  <View style={styles.dropdownDivider} />

                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuVisible(false);
                      Alert.alert(
                        'Logout',
                        'Are you sure you want to logout?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Logout',
                            style: 'destructive',
                            onPress: onLogout
                          }
                        ]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownText, { color: '#FF4444' }]}>🚪 Logout</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Multiplayer Battle</Text>
            <Text style={styles.subtitle}>Choose your mode</Text>
          </View>

          {/* User Info Card - Tap to view profile */}
          <TouchableOpacity style={styles.userCard} onPress={onViewProfile} activeOpacity={0.7}>
            <View style={styles.userAvatarCircle}>
              <Text style={styles.userAvatarIcon}>👤</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{username}</Text>
              <Text style={styles.tapHint}>Tap to view profile</Text>
            </View>
            <View style={styles.eloChip}>
              <Text style={styles.eloText}>{userElo} ELO</Text>
            </View>
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
                <ActivityIndicator color="#1A1A1A" />
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
              placeholderTextColor="#B0B0B0"
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

        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 40,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FAFAFA',
    zIndex: 100,
  },
  topBarSpacer: {
    width: 44,
  },
  menuButton: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  menuIcon: {
    fontSize: 24,
    color: '#1A1A1A',
    fontWeight: 'bold',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    minWidth: 200,
    overflow: 'hidden',
    zIndex: 1000,
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '400',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  userAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarIcon: {
    fontSize: 24,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  tapHint: {
    fontSize: 13,
    color: '#999999',
  },
  eloChip: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  eloText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  section: {
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  createButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  createHint: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '400',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
    color: '#999999',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A2A2A',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputError: {
    borderColor: '#FF4444',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  joinButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
