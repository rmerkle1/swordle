import React from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { Game } from '../types';
import { COLORS } from '../constants/theme';
import { UI_IMAGES } from '../assets';

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
  const isDefault = game.isDefault;
  const badge = isDefault && game.status === 'lobby'
    ? { bg: COLORS.accent, label: 'Daily' }
    : STATUS_BADGE[game.status];

  const hasReserved = game.reservedSlots > 0;
  const openSlots = game.maxPlayers - (game.reservedSlots || 0);

  // Countdown text for default lobbies
  let countdownText: string | null = null;
  if (isDefault && game.status === 'lobby' && game.lobbyDeadline) {
    const remaining = new Date(game.lobbyDeadline).getTime() - Date.now();
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000);
      countdownText = mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    }
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
          {game.hasPasscode && (
            <Text style={styles.lockIcon}>{'\u{1F512}'}</Text>
          )}
        </View>
        {game.status === 'active' && (
          <Text style={styles.day}>Day {game.currentDay}</Text>
        )}
        {countdownText && (
          <Text style={styles.countdown}>{countdownText}</Text>
        )}
      </View>
      <Text style={styles.title}>Game {game.id}</Text>
      <View style={styles.inlineRow}>
        <Image source={UI_IMAGES.playerCount} style={styles.inlineIcon} />
        {hasReserved ? (
          <Text style={styles.players}> {game.players.length}/{openSlots} open, {game.reservedSlots} reserved</Text>
        ) : (
          <Text style={styles.players}> {game.players.length}/{game.maxPlayers} players</Text>
        )}
      </View>
      {game.winner && (
        <View style={styles.inlineRow}>
          <Image source={UI_IMAGES.winner} style={styles.inlineIcon} />
          <Text style={styles.winner}> Winner declared</Text>
        </View>
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  lockIcon: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
  },
  day: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  countdown: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineIcon: {
    width: 16,
    height: 16,
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
