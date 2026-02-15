import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { GamePlayer } from '../types';
import { COLORS } from '../constants/theme';
import { UI_IMAGES } from '../assets';

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
        <View style={styles.labelRow}>
          <Image source={UI_IMAGES.wood} style={styles.labelIcon} />
          <Text style={styles.label}> Wood</Text>
        </View>
        <Text style={styles.value}>{player.wood}</Text>
      </View>
      <View style={styles.stat}>
        <View style={styles.labelRow}>
          <Image source={UI_IMAGES.metal} style={styles.labelIcon} />
          <Text style={styles.label}> Metal</Text>
        </View>
        <Text style={styles.value}>{player.metal}</Text>
      </View>
      <View style={styles.stat}>
        <View style={styles.labelRow}>
          <Image source={UI_IMAGES.weapon} style={styles.labelIcon} />
          <Text style={styles.label}> Tier</Text>
        </View>
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelIcon: {
    width: 14,
    height: 14,
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
