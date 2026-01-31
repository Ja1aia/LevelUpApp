import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { CrossPlatformAlert as Alert } from '../utils/alert';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { updateRoomStatus } from '../services/database';

interface WaitingForPlayerScreenProps {
  roomId: string;
  roomCode: string;
  username: string;
  onPlayerJoined: () => void;
  onCancel: () => void;
}

export default function WaitingForPlayerScreen({
  roomId,
  roomCode,
  username,
  onPlayerJoined,
  onCancel,
}: WaitingForPlayerScreenProps) {
  const [dots, setDots] = useState('');

  // Animated dots for "Waiting..."
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Real-time listener for player 2 joining
  useEffect(() => {
    console.log('🔔 Setting up real-time listener for room:', roomId);

    let hasJoined = false;

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          console.log('🔥 Room updated (real-time):', payload);

          if (payload.new.status === 'playing' && payload.new.guest_id) {
            console.log('✅ Player 2 joined! Starting game...');
            if (!hasJoined) {
              hasJoined = true;
              onPlayerJoined();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    // Fallback: Poll room status every 2 seconds
    // (in case real-time doesn't work immediately)
    const pollInterval = setInterval(async () => {
      console.log('🔍 Polling room status...');

      const { data: room, error } = await supabase
        .from('rooms')
        .select('status, guest_id')
        .eq('id', roomId)
        .single();

      if (error) {
        console.error('❌ Error polling room:', error);
        return;
      }

      console.log('📊 Room status:', room);

      if (room && room.status === 'playing' && room.guest_id) {
        console.log('✅ Player 2 joined (detected via polling)! Starting game...');
        if (!hasJoined) {
          hasJoined = true;
          clearInterval(pollInterval);
          onPlayerJoined();
        }
      }
    }, 2000);

    return () => {
      console.log('🧹 Cleaning up subscriptions and polling');
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [roomId, onPlayerJoined]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my LevelUp Math Battle! Room Code: ${roomCode}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Room',
      'Are you sure you want to cancel? The room will be deleted.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            // Delete room from database
            await updateRoomStatus(roomId, 'finished');
            onCancel();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Room Created!</Text>
        <Text style={styles.subtitle}>Share the code with a friend</Text>

        {/* Room Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Room Code</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{roomCode}</Text>
          </View>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Text style={styles.shareButtonIcon}>📤</Text>
            <Text style={styles.shareButtonText}>Share Code</Text>
          </TouchableOpacity>
        </View>

        {/* Waiting Status */}
        <View style={styles.statusCard}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.statusText}>
            Waiting for player 2{dots}
          </Text>
          <Text style={styles.statusHint}>
            Game will start automatically when they join
          </Text>
        </View>

        {/* Host Info */}
        <View style={styles.hostCard}>
          <Text style={styles.hostLabel}>You (Host)</Text>
          <View style={styles.playerInfo}>
            <Text style={styles.playerEmoji}>👤</Text>
            <Text style={styles.playerName}>{username}</Text>
            <Text style={styles.readyBadge}>✓ Ready</Text>
          </View>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel Room</Text>
        </TouchableOpacity>

        {/* Tip */}
        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            Your friend can join by entering this code in the "Join Room" screen
          </Text>
        </View>
      </View>
    </View>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  codeCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  codeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  codeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  codeText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 4,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  shareButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  shareButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusCard: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 24,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  statusHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  hostCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  hostLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  readyBadge: {
    backgroundColor: '#4CAF50',
    color: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  cancelButtonText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  tipCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFE5A3',
  },
  tipIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
