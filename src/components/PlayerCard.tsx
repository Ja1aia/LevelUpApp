import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

interface PlayerCardProps {
  username: string;
  elo: number;
  currentScore: number;
  totalQuestions: number;
  isYou?: boolean;
  avatar?: string;
}

export default function PlayerCard({
  username,
  elo,
  currentScore,
  totalQuestions,
  isYou = false,
  avatar = '😊',
}: PlayerCardProps) {
  return (
    <View style={[styles.container, isYou && styles.containerHighlight]}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{avatar}</Text>
      </View>

      {/* Player Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.username} numberOfLines={1}>
          {username}
        </Text>
        <Text style={styles.elo}>{elo} ELO</Text>
      </View>

      {/* Score */}
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreValue}>{currentScore}</Text>
        <Text style={styles.scoreLabel}>/{totalQuestions}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerHighlight: {
    borderColor: COLORS.primary,
    borderWidth: 3,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 24,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  elo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  scoreLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 2,
  },
});
