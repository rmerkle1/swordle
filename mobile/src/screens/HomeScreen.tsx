import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Game } from '../types';
import { COLORS } from '../constants/theme';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { api } from '../services/api';
import GameCard from '../components/GameCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { games, setGames } = useGameStore();
  const { playerId } = usePlayerStore();
  const [refreshing, setRefreshing] = useState(false);

  const refreshGames = useCallback(() => {
    api.getGames().then(setGames).catch(() => {});
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const g = await api.getGames();
      setGames(g);
    } catch {}
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshGames();
    }, [])
  );

  const handleCreateGame = async () => {
    if (!playerId) return;
    try {
      const game = await api.createGame(4, playerId);
      setGames([game, ...games]);
      navigation.navigate('Game', { gameId: game.id });
    } catch (err) {
      console.error('Failed to create game:', err);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    if (!playerId) return;
    try {
      const { game } = await api.joinGame(gameId, playerId);
      refreshGames();
      if (game.status === 'active') {
        navigation.navigate('Game', { gameId: game.id });
      }
    } catch (err: any) {
      Alert.alert('Join Failed', err.message || 'Could not join game');
    }
  };

  const sections = [
    { title: 'Active Games', data: games.filter((g) => g.status === 'active') },
    { title: 'Lobby', data: games.filter((g) => g.status === 'lobby') },
    { title: 'Completed', data: games.filter((g) => g.status === 'completed') },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{'\u{2694}\uFE0F'} Swordle</Text>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const alreadyJoined = item.players.some((p) => p.playerId === playerId);
          return (
            <GameCard
              game={item}
              onPress={() => navigation.navigate('Game', { gameId: item.id })}
              onJoin={item.status === 'lobby' && !alreadyJoined ? () => handleJoinGame(item.id) : undefined}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No games yet</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.textSecondary} />
        }
      />
      <TouchableOpacity style={styles.createBtn} onPress={handleCreateGame}>
        <Text style={styles.createTxt}>+ Create Game</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heading: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  listContent: {
    paddingBottom: 80,
  },
  empty: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  createBtn: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
