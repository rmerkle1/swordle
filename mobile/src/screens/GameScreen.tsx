import React, { useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { COLORS } from '../constants/theme';
import { useGameStore, getAdjacentTiles } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { api } from '../services/api';
import { computeFoggedBoard } from '../utils/fogOfWar';
import GameBoard from '../components/GameBoard';
import PlayerStatsBar from '../components/PlayerStats';
import MoveSelector from '../components/MoveSelector';

type GameRoute = RouteProp<RootStackParamList, 'Game'>;

export default function GameScreen() {
  const route = useRoute<GameRoute>();
  const { playerId } = usePlayerStore();
  const {
    currentGame, setCurrentGame,
    selectedTile, selectTile,
    pendingAction, setPendingAction,
    buildOption, setBuildOption,
    isSubmitting, setSubmitting,
    showBanner, setShowBanner,
    resetMove,
    submittedMove, setSubmittedMove,
    tileMemory, myTraps,
    updateTileMemory, addMyTrap,
  } = useGameStore();

  useEffect(() => {
    api.getGame(route.params.gameId).then((g) => {
      if (g) setCurrentGame(g);
    });
    return () => setCurrentGame(null);
  }, [route.params.gameId]);

  const myPlayer = currentGame?.players.find((p) => p.id === playerId);

  // Update tile memory when position or day changes
  useEffect(() => {
    if (!myPlayer || !currentGame) return;
    updateTileMemory(
      myPlayer.position,
      currentGame.boardSize,
      currentGame.tiles,
      currentGame.currentDay,
    );
  }, [myPlayer?.position, currentGame?.currentDay]);

  // Auto-expire submitted move when day changes
  useEffect(() => {
    if (submittedMove && currentGame && submittedMove.day !== currentGame.currentDay) {
      setSubmittedMove(null);
    }
  }, [currentGame?.currentDay, submittedMove]);

  // Compute fogged board
  const foggedTiles = useMemo(() => {
    if (!currentGame || !myPlayer) return [];
    return computeFoggedBoard(
      currentGame.tiles,
      currentGame.players,
      myPlayer.id,
      myPlayer.position,
      currentGame.boardSize,
      currentGame.currentDay,
      tileMemory,
      myTraps,
    );
  }, [currentGame?.tiles, currentGame?.players, myPlayer?.position, currentGame?.boardSize, currentGame?.currentDay, tileMemory, myTraps]);

  const validTargets = useMemo(() => {
    if (!myPlayer || !currentGame) return new Set<number>();
    const adj = getAdjacentTiles(myPlayer.position, currentGame.boardSize);
    const blockedTypes = new Set(['wall', 'void', 'water', 'storm']);
    const blocked = new Set(
      currentGame.tiles.filter((t) => blockedTypes.has(t.type)).map((t) => t.index)
    );
    return new Set(adj.filter((i) => !blocked.has(i)));
  }, [myPlayer?.position, currentGame?.tiles, currentGame?.boardSize]);

  const handleTilePress = useCallback((tileIndex: number) => {
    if (submittedMove && submittedMove.day === currentGame?.currentDay) return;
    if (selectedTile === tileIndex) {
      resetMove();
    } else if (validTargets.has(tileIndex)) {
      selectTile(tileIndex);
    } else {
      resetMove();
    }
  }, [selectedTile, validTargets, submittedMove, currentGame?.currentDay]);

  const handleSubmit = useCallback(async () => {
    if (!currentGame || !myPlayer || selectedTile === null || !pendingAction) return;

    // Track trap placement
    if (pendingAction === 'build' && buildOption === 'trap') {
      addMyTrap(selectedTile);
    }

    setSubmitting(true);
    await api.submitMove(currentGame.id, {
      playerId: myPlayer.id,
      fromTile: myPlayer.position,
      toTile: selectedTile,
      action: pendingAction,
    });
    setSubmittedMove({
      toTile: selectedTile,
      action: pendingAction,
      buildOption: buildOption,
      day: currentGame.currentDay,
    });
    setSubmitting(false);
    setShowBanner(true);
    resetMove();
    setTimeout(() => setShowBanner(false), 2000);
  }, [currentGame, myPlayer, selectedTile, pendingAction, buildOption]);

  if (!currentGame || !myPlayer) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showBanner && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{'\u2705'} Move submitted!</Text>
        </View>
      )}
      <PlayerStatsBar player={myPlayer} currentDay={currentGame.currentDay} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <GameBoard
          foggedTiles={foggedTiles}
          boardSize={currentGame.boardSize}
          selectedTile={selectedTile}
          lockedTile={submittedMove?.toTile ?? null}
          validTargets={validTargets}
          onTilePress={handleTilePress}
        />
        {selectedTile !== null && (
          <MoveSelector
            selectedAction={pendingAction}
            buildOption={buildOption}
            isSubmitting={isSubmitting}
            isStunned={myPlayer.isStunned}
            targetTileType={currentGame.tiles[selectedTile].type}
            player={myPlayer}
            onSelectAction={setPendingAction}
            onSelectBuild={setBuildOption}
            onSubmit={handleSubmit}
            onCancel={resetMove}
          />
        )}
        {submittedMove && selectedTile === null && (
          <MoveSelector
            selectedAction={submittedMove.action}
            buildOption={submittedMove.buildOption}
            isSubmitting={false}
            isStunned={myPlayer.isStunned}
            isLocked
            targetTileType={currentGame.tiles[submittedMove.toTile]?.type ?? 'empty'}
            player={myPlayer}
            onSelectAction={setPendingAction}
            onSelectBuild={setBuildOption}
            onSubmit={handleSubmit}
            onCancel={resetMove}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 16,
  },
  scroll: {
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: COLORS.success,
    padding: 10,
    alignItems: 'center',
  },
  bannerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
