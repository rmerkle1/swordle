import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Game } from '../types';
import { COLORS } from '../constants/theme';

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  active: { bg: COLORS.success, label: 'Active' },
  lobby: { bg: COLORS.gold, label: 'Lobby' },
  completed: { bg: COLORS.textSecondary, label: 'Completed' },
};

interface Props {
  game: Game;
  onPress: () => void;
  onJoin?: () => void;
}

export default function GameCard({ game, onPress, onJoin }: Props) {
  const badge = STATUS_BADGE[game.status];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={styles.badgeText}>{badge.label}</Text>
        </View>
        {game.status === 'active' && (
          <Text style={styles.day}>Day {game.currentDay}</Text>
        )}
      </View>
      <Text style={styles.title}>Game {game.id.split('-')[1]}</Text>
      <Text style={styles.players}>
        {'\u{1F464}'} {game.players.length}/{game.maxPlayers} players
      </Text>
      {game.winner && (
        <Text style={styles.winner}>{'\u{1F3C6}'} Winner declared</Text>
      )}
      {game.status === 'lobby' && onJoin && (
        <TouchableOpacity style={styles.joinBtn} onPress={onJoin} activeOpacity={0.7}>
          <Text style={styles.joinTxt}>Join Game</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  day: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  players: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  winner: {
    color: COLORS.gold,
    fontSize: 13,
    marginTop: 4,
  },
  joinBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  joinTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
