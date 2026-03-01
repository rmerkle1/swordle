import React, { useCallback, useState } from 'react';
import { View, Text, SectionList, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Game } from '../types';
import { COLORS } from '../constants/theme';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { api } from '../services/api';
import { connectSocket, onGamesList } from '../services/socket';
import GameCard from '../components/GameCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function BattleScreen() {
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
      const socket = connectSocket();
      const unsubscribe = onGamesList((games) => {
        setGames(games);
      });
      return () => {
        unsubscribe();
      };
    }, [])
  );

  const myGames = games.filter((g) => g.players.some((p) => p.playerId === playerId));
  const myPlayer = (g: Game) => g.players.find((p) => p.playerId === playerId);

  const sections = [
    { title: 'Lobby', data: myGames.filter((g) => g.status === 'lobby') },
    { title: 'Active Games', data: myGames.filter((g) => g.status === 'active' && myPlayer(g)?.isAlive !== false) },
    { title: 'Battle History', data: [
      ...myGames.filter((g) => g.status === 'active' && myPlayer(g)?.isAlive === false),
      ...myGames.filter((g) => g.status === 'completed'),
    ]},
  ].filter((s) => s.data.length > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Games</Text>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <GameCard
            game={item}
            onPress={() => navigation.navigate('Game', { gameId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>No active games. Join one from Explore!</Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.textSecondary} />
        }
      />
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
    fontSize: 24,
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
});
