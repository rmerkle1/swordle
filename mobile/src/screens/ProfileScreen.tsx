import React, { useCallback, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { usePlayerStore } from '../store/playerStore';
import { truncateAddress } from '../utils/wallet';
import { api } from '../services/api';
import { FIGHTER_IMAGES } from '../assets';
import { ClassStats, FighterClass } from '../types';

const ALL_CLASSES: FighterClass[] = ['knight', 'archer', 'cavalry', 'mage'];
const DEFAULT_CLASS_STATS: Record<FighterClass, ClassStats> = {
  knight: { games: 0, wins: 0, losses: 0 },
  archer: { games: 0, wins: 0, losses: 0 },
  cavalry: { games: 0, wins: 0, losses: 0 },
  mage: { games: 0, wins: 0, losses: 0 },
};

export default function ProfileScreen() {
  const { playerName, playerId, walletAddress, stats, refreshStats, disconnectWallet } = usePlayerStore();
  const [disconnecting, setDisconnecting] = useState(false);
  const [classStats, setClassStats] = useState<Record<FighterClass, ClassStats>>(DEFAULT_CLASS_STATS);

  useFocusEffect(
    useCallback(() => {
      refreshStats();
      if (playerId) {
        api.getClassStats(playerId).then(setClassStats).catch(() => {});
      }
    }, [playerId])
  );

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectWallet();
    } catch {
      // state is cleared regardless
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{playerName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{playerName}</Text>
        {walletAddress ? (
          <Text style={styles.wallet}>{truncateAddress(walletAddress)}</Text>
        ) : null}
        <Text style={styles.id}>{playerId}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.gamesPlayed}</Text>
          <Text style={styles.statLabel}>Games</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.wins}</Text>
          <Text style={styles.statLabel}>Wins</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{Math.round(stats.winRate * 100)}%</Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.eliminations}</Text>
          <Text style={styles.statLabel}>Eliminations</Text>
        </View>
      </View>

      <Text style={styles.fightersHeading}>Fighters</Text>
      <View style={styles.fightersGrid}>
        {ALL_CLASSES.map((cls) => {
          const s = classStats[cls];
          return (
            <View key={cls} style={styles.fighterCard}>
              <Image source={FIGHTER_IMAGES[cls].red} style={styles.fighterImage} />
              <Text style={styles.fighterName}>
                {cls.charAt(0).toUpperCase() + cls.slice(1)}
              </Text>
              <Text style={styles.fighterRecord}>
                W: {s.wins}  L: {s.losses}
              </Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.disconnectButton, disconnecting && styles.buttonDisabled]}
        onPress={handleDisconnect}
        disabled={disconnecting}
      >
        {disconnecting ? (
          <ActivityIndicator color={COLORS.error} />
        ) : (
          <Text style={styles.disconnectText}>Disconnect Wallet</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  wallet: {
    color: COLORS.accent,
    fontSize: 13,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  id: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  fightersHeading: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  fightersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fighterCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  fighterImage: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  fighterName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  fighterRecord: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  disconnectButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  disconnectText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '600',
  },
});
