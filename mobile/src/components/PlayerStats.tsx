import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GamePlayer } from '../types';
import { COLORS } from '../constants/theme';

interface Props {
  player: GamePlayer;
  currentDay: number;
}

export default function PlayerStatsBar({ player, currentDay }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Text style={styles.label}>Day</Text>
        <Text style={styles.value}>{currentDay}</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.label}>{'\u{1FAB5}'} Wood</Text>
        <Text style={styles.value}>{player.wood}</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.label}>{'\u{2699}\uFE0F'} Metal</Text>
        <Text style={styles.value}>{player.metal}</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.label}>{'\u{2694}\uFE0F'} Tier</Text>
        <Text style={styles.value}>{player.weaponTier}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 6,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  value: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
