import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../constants/theme';
import { useGameStore, getAdjacentTiles } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { api } from '../services/api';
import { computeFoggedBoard } from '../utils/fogOfWar';
import GameBoard from '../components/GameBoard';
import PlayerStatsBar from '../components/PlayerStats';
import MoveSelector from '../components/MoveSelector';
import GameLog from '../components/GameLog';
import { UI_IMAGES } from '../assets';

type GameRoute = RouteProp<RootStackParamList, 'Game'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const POLL_INTERVAL = 5000;

export default function GameScreen() {
  const route = useRoute<GameRoute>();
  const navigation = useNavigation<Nav>();
  const { playerId } = usePlayerStore();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    let isInitial = true;
    const fetchGame = () => {
      api.getGame(route.params.gameId).then((g) => {
        if (g) {
          setCurrentGame(g);
          setLoadError(false);
        } else if (isInitial) {
          setLoadError(true);
        }
        isInitial = false;
      }).catch(() => {
        if (isInitial) setLoadError(true);
        isInitial = false;
      });
    };
    fetchGame();
    pollRef.current = setInterval(fetchGame, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      setCurrentGame(null);
    };
  }, [route.params.gameId]);

  const myPlayer = currentGame?.players.find((p) => p.playerId === playerId);

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
    setErrorBanner(null);
    try {
      await api.submitMove(currentGame.id, {
        playerId: myPlayer.id,
        fromTile: myPlayer.position,
        toTile: selectedTile,
        action: pendingAction,
        buildOption: pendingAction === 'build' ? buildOption : null,
      });
      setSubmittedMove({
        toTile: selectedTile,
        action: pendingAction,
        buildOption: buildOption,
        day: currentGame.currentDay,
      });
      setShowBanner(true);
      resetMove();
      setTimeout(() => setShowBanner(false), 2000);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to submit move');
      setTimeout(() => setErrorBanner(null), 3000);
    } finally {
      setSubmitting(false);
    }
  }, [currentGame, myPlayer, selectedTile, pendingAction, buildOption]);

  const handleLeave = useCallback(() => {
    if (!currentGame || !playerId) return;
    const isLobby = currentGame.status === 'lobby';
    const title = isLobby ? 'Leave Lobby' : 'Forfeit Game';
    const message = isLobby
      ? 'Are you sure you want to leave this lobby?'
      : 'Are you sure you want to forfeit? You will be eliminated.';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isLobby ? 'Leave' : 'Forfeit',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.leaveGame(currentGame.id, playerId);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to leave game');
          }
        },
      },
    ]);
  }, [currentGame, playerId]);

  if (!currentGame) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>
          {loadError ? 'Failed to load game' : 'Loading...'}
        </Text>
        {loadError && (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoadError(false);
              api.getGame(route.params.gameId).then((g) => {
                if (g) setCurrentGame(g);
                else setLoadError(true);
              }).catch(() => setLoadError(true));
            }}
          >
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Game completed — show victory/game-over screen
  if (currentGame.status === 'completed') {
    const winnerPlayer = currentGame.winner
      ? currentGame.players.find((p) => p.id === currentGame.winner)
      : null;
    const isWinner = winnerPlayer?.playerId === playerId;

    return (
      <View style={styles.container}>
        <View style={styles.gameOverOverlay}>
          <Text style={styles.gameOverTitle}>
            {isWinner ? 'Victory!' : 'Game Over'}
          </Text>
          {winnerPlayer && (
            <Text style={styles.gameOverWinner}>
              {isWinner ? 'You won!' : `${winnerPlayer.name} wins!`}
            </Text>
          )}
          {!winnerPlayer && (
            <Text style={styles.gameOverWinner}>No survivors</Text>
          )}
          <Text style={styles.gameOverDay}>
            Lasted {currentGame.currentDay} days
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <GameBoard
            foggedTiles={foggedTiles}
            boardSize={currentGame.boardSize}
            selectedTile={null}
            lockedTile={null}
            validTargets={new Set()}
            onTilePress={() => {}}
          />
          {currentGame.events.length > 0 && (
            <GameLog events={currentGame.events} />
          )}
        </ScrollView>
      </View>
    );
  }

  // Lobby — waiting for players
  if (currentGame.status === 'lobby') {
    return (
      <View style={styles.container}>
        <View style={styles.lobbyOverlay}>
          <Text style={styles.lobbyTitle}>Waiting for Players</Text>
          <Text style={styles.lobbyCount}>
            {currentGame.players.length}/{currentGame.maxPlayers} joined
          </Text>
          {currentGame.players.map((p) => (
            <Text key={p.id} style={[styles.lobbyPlayer, { color: p.color }]}>
              {p.name}
            </Text>
          ))}
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
            <Text style={styles.leaveTxt}>Leave Lobby</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Player not found in active game
  if (!myPlayer) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>You are not in this game</Text>
      </View>
    );
  }

  const isEliminated = !myPlayer.isAlive;

  return (
    <View style={styles.container}>
      {showBanner && (
        <View style={styles.banner}>
          <View style={styles.bannerRow}>
            <Image source={UI_IMAGES.checkmark} style={styles.bannerIcon} />
            <Text style={styles.bannerText}> Move submitted!</Text>
          </View>
        </View>
      )}
      {errorBanner && (
        <View style={styles.errorBanner}>
          <Text style={styles.bannerText}>{errorBanner}</Text>
        </View>
      )}
      {isEliminated && (
        <View style={styles.eliminatedBanner}>
          <Text style={styles.bannerText}>You have been eliminated</Text>
        </View>
      )}
      <PlayerStatsBar player={myPlayer} currentDay={currentGame.currentDay} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <GameBoard
          foggedTiles={foggedTiles}
          boardSize={currentGame.boardSize}
          selectedTile={isEliminated ? null : selectedTile}
          lockedTile={submittedMove?.toTile ?? null}
          validTargets={isEliminated ? new Set() : validTargets}
          onTilePress={isEliminated ? () => {} : handleTilePress}
        />
        {!isEliminated && selectedTile !== null && (
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
        {!isEliminated && submittedMove && selectedTile === null && (
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
        {currentGame.events.length > 0 && (
          <GameLog events={currentGame.events} />
        )}
        {!isEliminated && (
          <TouchableOpacity style={styles.forfeitBtn} onPress={handleLeave}>
            <Text style={styles.forfeitTxt}>Forfeit Game</Text>
          </TouchableOpacity>
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
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
  },
  retryTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: COLORS.success,
    padding: 10,
    alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: COLORS.error,
    padding: 10,
    alignItems: 'center',
  },
  eliminatedBanner: {
    backgroundColor: '#555',
    padding: 10,
    alignItems: 'center',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIcon: {
    width: 16,
    height: 16,
  },
  bannerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  gameOverOverlay: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  gameOverTitle: {
    color: COLORS.gold,
    fontSize: 32,
    fontWeight: 'bold',
  },
  gameOverWinner: {
    color: COLORS.text,
    fontSize: 18,
    marginTop: 8,
  },
  gameOverDay: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  lobbyOverlay: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  lobbyCount: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 16,
  },
  lobbyPlayer: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 4,
  },
  leaveBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  leaveTxt: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  forfeitBtn: {
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
  },
  forfeitTxt: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});
