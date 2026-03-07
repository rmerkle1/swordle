import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, useWindowDimensions } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../constants/theme';
import { useGameStore, getAdjacentTiles } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { api } from '../services/api';
import { connectSocket, joinGame as socketJoinGame, leaveGame as socketLeaveGame, onGameUpdate } from '../services/socket';
import { computeFoggedBoard } from '../utils/fogOfWar';
import GameBoard from '../components/GameBoard';
import PlayerStatsBar from '../components/PlayerStats';
import MoveSelector from '../components/MoveSelector';
import GameLog from '../components/GameLog';
import { UI_IMAGES } from '../assets';

type GameRoute = RouteProp<RootStackParamList, 'Game'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const POLL_INTERVAL = 30000;

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
    attackTarget, setAttackTarget,
    tileMemory, myTraps, scoutedTraps,
    updateTileMemory, addMyTrap, addScoutedTrap, clearScoutedTrap,
  } = useGameStore();

  const [myGamePlayerId, setMyGamePlayerId] = useState<string | null>(null);
  const [isSelectingTarget, setIsSelectingTarget] = useState(false);
  const [deadlineRemaining, setDeadlineRemaining] = useState<string | null>(null);
  const [deadlineUrgent, setDeadlineUrgent] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatSentDay, setChatSentDay] = useState<number | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const { height: windowHeight } = useWindowDimensions();

  // Move deadline countdown
  useEffect(() => {
    if (!currentGame || currentGame.status !== 'active' || currentGame.moveDeadlineHour == null) {
      setDeadlineRemaining(null);
      return;
    }
    const computeRemaining = () => {
      const now = new Date();
      const deadlineHour = currentGame.moveDeadlineHour;
      const target = new Date(now);
      target.setUTCHours(deadlineHour, 0, 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setUTCDate(target.getUTCDate() + 1);
      }
      const diffMs = target.getTime() - now.getTime();
      const totalMins = Math.ceil(diffMs / 60000);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      setDeadlineUrgent(totalMins < 60);
      if (hours > 0) {
        setDeadlineRemaining(`${hours}h ${mins}m remaining`);
      } else {
        setDeadlineRemaining(`${mins}m remaining`);
      }
    };
    computeRemaining();
    const interval = setInterval(computeRemaining, 60000);
    return () => clearInterval(interval);
  }, [currentGame?.status, currentGame?.moveDeadlineHour]);

  useEffect(() => {
    let isInitial = true;
    const fetchGame = (gpId?: string | null) => {
      api.getGame(route.params.gameId, gpId || undefined).then((g) => {
        if (g) {
          setCurrentGame(g);
          setLoadError(false);
          // Discover myPlayer's gamePlayerId on first fetch
          if (!gpId) {
            const me = g.players.find((p) => p.playerId === playerId);
            if (me) {
              setMyGamePlayerId(me.id);
              // Re-join socket with player identity for filtered updates
              socketLeaveGame(route.params.gameId);
              socketJoinGame(route.params.gameId, me.id);
            }
          }
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
    pollRef.current = setInterval(() => fetchGame(myGamePlayerId), POLL_INTERVAL);

    // Socket.io real-time updates
    const socket = connectSocket();
    socketJoinGame(route.params.gameId);
    const unsubscribe = onGameUpdate((game) => {
      setCurrentGame(game);
      setLoadError(false);
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      socketLeaveGame(route.params.gameId);
      unsubscribe();
      setCurrentGame(null);
    };
  }, [route.params.gameId, playerId]);

  // Update poll interval when myGamePlayerId changes
  useEffect(() => {
    if (!myGamePlayerId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      api.getGame(route.params.gameId, myGamePlayerId || undefined).then((g) => {
        if (g) {
          setCurrentGame(g);
          setLoadError(false);
        }
      }).catch(() => {});
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [myGamePlayerId, route.params.gameId]);

  const myPlayer = currentGame?.players.find((p) => p.playerId === playerId);

  // Update tile memory when position or day changes
  useEffect(() => {
    if (!myPlayer || !currentGame) return;
    if (myPlayer.position == null || currentGame.boardSize === 0) return;
    updateTileMemory(
      myPlayer.position,
      currentGame.boardSize,
      currentGame.tiles,
      currentGame.currentDay,
    );
  }, [myPlayer?.position, currentGame?.currentDay]);

  // Restore pending move from backend when entering the game
  useEffect(() => {
    if (!currentGame || !myPlayer || currentGame.status !== 'active') return;
    if (submittedMove && submittedMove.day === currentGame.currentDay) return;

    api.getPendingMove(currentGame.id, myPlayer.id).then(({ pendingMove }) => {
      if (pendingMove && pendingMove.day === currentGame.currentDay) {
        setSubmittedMove({
          toTile: pendingMove.toTile,
          action: pendingMove.action as any,
          buildOption: (pendingMove.buildOption as any) || null,
          attackTarget: pendingMove.attackTarget ?? null,
          day: pendingMove.day,
        });
      }
    }).catch(() => {});
  }, [currentGame?.id, myPlayer?.id, currentGame?.status]);

  // Scan events for scouted traps
  useEffect(() => {
    if (!currentGame || !myPlayer) return;
    for (const event of currentGame.events) {
      if (event.trapRevealTile != null && event.playerId === myPlayer.id) {
        // Check if the trap tile is still a trap (not yet triggered)
        const tile = currentGame.tiles[event.trapRevealTile];
        if (tile && tile.type === 'trap') {
          addScoutedTrap(event.trapRevealTile);
        } else {
          clearScoutedTrap(event.trapRevealTile);
        }
      }
    }
  }, [currentGame?.events, myPlayer?.id]);

  // Auto-expire submitted move when day changes
  useEffect(() => {
    if (submittedMove && currentGame && submittedMove.day !== currentGame.currentDay) {
      setSubmittedMove(null);
    }
  }, [currentGame?.currentDay, submittedMove]);

  // Compute fogged board
  const foggedTiles = useMemo(() => {
    if (!currentGame || !myPlayer || myPlayer.position == null || currentGame.boardSize === 0) return [];
    return computeFoggedBoard(
      currentGame.tiles,
      currentGame.players,
      myPlayer.id,
      myPlayer.position,
      currentGame.boardSize,
      currentGame.currentDay,
      tileMemory,
      myTraps,
      scoutedTraps,
    );
  }, [currentGame?.tiles, currentGame?.players, myPlayer?.position, currentGame?.boardSize, currentGame?.currentDay, tileMemory, myTraps, scoutedTraps]);

  const validTargets = useMemo(() => {
    if (!myPlayer || !currentGame || myPlayer.position == null || currentGame.boardSize === 0) return new Set<number>();
    const bs = currentGame.boardSize;
    const adj = getAdjacentTiles(myPlayer.position, bs);
    const blockedTypes = new Set(['void', 'water', 'storm']);
    const blocked = new Set(
      currentGame.tiles.filter((t) => blockedTypes.has(t.type)).map((t) => t.index)
    );
    const targets = new Set([myPlayer.position, ...adj.filter((i) => !blocked.has(i))]);
    // Cavalry: also include tiles reachable in 2 steps
    if (myPlayer.fighterClass === 'cavalry') {
      const intermediates = getAdjacentTiles(myPlayer.position, bs);
      for (const mid of intermediates) {
        if (blocked.has(mid)) continue;
        for (const dest of getAdjacentTiles(mid, bs)) {
          if (!blocked.has(dest)) targets.add(dest);
        }
      }
    }
    return targets;
  }, [myPlayer?.position, myPlayer?.fighterClass, currentGame?.tiles, currentGame?.boardSize]);

  // Valid attack targets for ranged classes
  const validAttackTargets = useMemo(() => {
    if (!myPlayer || !currentGame || !selectedTile) return new Set<number>();
    const bs = currentGame.boardSize;
    const totalTiles = bs * bs;
    const blockedTypes = new Set(['void', 'water']);
    const blocked = new Set(
      currentGame.tiles.filter((t) => blockedTypes.has(t.type)).map((t) => t.index)
    );

    if (myPlayer.fighterClass === 'archer') {
      const adj = getAdjacentTiles(selectedTile, bs);
      return new Set(adj.filter((i) => i !== selectedTile && !blocked.has(i)));
    }

    if (myPlayer.fighterClass === 'mage') {
      const result = new Set<number>();
      const destAdj = getAdjacentTiles(selectedTile, bs);
      // Check every possible top-left position on the board
      for (let tl = 0; tl < totalTiles; tl++) {
        const tlX = tl % bs;
        if (tlX + 1 >= bs) continue; // right edge
        const tr = tl + 1;
        const bl = tl + bs;
        const br = bl + 1;
        if (br >= totalTiles) continue; // bottom edge
        const area = [tl, tr, bl, br];
        // Area must not contain selectedTile (no melee)
        if (area.includes(selectedTile)) continue;
        // At least one tile of the 2x2 must be adjacent to selectedTile
        const hasAdj = area.some((t) => destAdj.includes(t));
        if (hasAdj) result.add(tl);
      }
      return result;
    }

    return new Set<number>();
  }, [myPlayer?.fighterClass, selectedTile, currentGame?.tiles, currentGame?.boardSize]);

  const isRangedClass = myPlayer?.fighterClass === 'archer' || myPlayer?.fighterClass === 'mage';

  // Tiles to highlight as attack zone
  const attackTargetTilesSet = useMemo(() => {
    if (!myPlayer || !currentGame) return new Set<number>();
    // Melee: highlight destination tile when attack is selected
    if (pendingAction === 'attack' && selectedTile != null && !isRangedClass) {
      return new Set([selectedTile]);
    }
    // Ranged selecting target: show all valid attack target tiles
    if (pendingAction === 'attack' && isRangedClass && isSelectingTarget && attackTarget == null) {
      return validAttackTargets;
    }
    // Ranged with target selected
    if (attackTarget == null) return new Set<number>();
    if (myPlayer.fighterClass === 'archer') return new Set([attackTarget]);
    if (myPlayer.fighterClass === 'mage') {
      const bs = currentGame.boardSize;
      return new Set([attackTarget, attackTarget + 1, attackTarget + bs, attackTarget + bs + 1]);
    }
    return new Set<number>();
  }, [attackTarget, myPlayer?.fighterClass, currentGame?.boardSize, pendingAction, selectedTile, isRangedClass, isSelectingTarget, validAttackTargets]);

  const handleTilePress = useCallback((tileIndex: number) => {
    if (submittedMove && submittedMove.day === currentGame?.currentDay) return;

    // Target selection mode for ranged classes
    if (isSelectingTarget) {
      if (validAttackTargets.has(tileIndex)) {
        setAttackTarget(tileIndex);
      }
      setIsSelectingTarget(false);
      return;
    }

    // Stunned players can only select their current tile (cannot move)
    if (myPlayer?.isStunned && tileIndex !== myPlayer.position) {
      return;
    }

    if (selectedTile === tileIndex) {
      resetMove();
    } else if (validTargets.has(tileIndex)) {
      selectTile(tileIndex);
    } else {
      resetMove();
    }
  }, [selectedTile, validTargets, submittedMove, currentGame?.currentDay, isSelectingTarget, validAttackTargets, myPlayer?.isStunned, myPlayer?.position]);

  const handleSubmit = useCallback(async () => {
    if (!currentGame || !myPlayer || selectedTile === null || !pendingAction) return;

    // Track trap placement
    if (pendingAction === 'build' && buildOption === 'trap') {
      addMyTrap(selectedTile);
    }

    setSubmitting(true);
    setErrorBanner(null);
    try {
      const isRanged = myPlayer.fighterClass === 'archer' || myPlayer.fighterClass === 'mage';
      await api.submitMove(currentGame.id, {
        playerId: myPlayer.id,
        fromTile: myPlayer.position,
        toTile: selectedTile,
        action: pendingAction,
        buildOption: pendingAction === 'build' ? buildOption : null,
        attackTarget: isRanged && pendingAction === 'attack' ? attackTarget : null,
      });
      setSubmittedMove({
        toTile: selectedTile,
        action: pendingAction,
        buildOption: buildOption,
        attackTarget: isRanged && pendingAction === 'attack' ? attackTarget : null,
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
  }, [currentGame, myPlayer, selectedTile, pendingAction, buildOption, attackTarget]);

  const handleRequestSubmit = useCallback(() => {
    if (!currentGame || selectedTile === null || !pendingAction) return;
    const dest = selectedTile === myPlayer?.position ? 'Stay in place' : `Move to tile ${selectedTile}`;
    const buildSuffix = pendingAction === 'build' && buildOption ? ` (${buildOption})` : '';
    const isRanged = myPlayer?.fighterClass === 'archer' || myPlayer?.fighterClass === 'mage';
    const targetSuffix = isRanged && pendingAction === 'attack' && attackTarget != null
      ? `, target: tile ${attackTarget}` : '';
    const summary = `${dest}, action: ${pendingAction}${buildSuffix}${targetSuffix}`;
    Alert.alert('Confirm Move', summary, [
      { text: 'Go Back', style: 'cancel' },
      { text: 'Lock In', onPress: handleSubmit },
    ]);
  }, [currentGame, myPlayer, selectedTile, pendingAction, buildOption, attackTarget, handleSubmit]);

  const handleChangeMove = useCallback(async () => {
    if (!currentGame || !myPlayer) return;
    setErrorBanner(null);
    try {
      await api.deleteMove(currentGame.id, myPlayer.id);
      setSubmittedMove(null);
      setAttackTarget(null);
      setIsSelectingTarget(false);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to change move');
      setTimeout(() => setErrorBanner(null), 3000);
    }
  }, [currentGame, myPlayer]);

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

  const handleSendChat = useCallback(async () => {
    if (!currentGame || !chatText.trim() || chatSending) return;
    setChatSending(true);
    try {
      await api.sendChat(currentGame.id, chatText.trim());
      setChatSentDay(currentGame.currentDay);
      setChatText('');
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to send message');
      setTimeout(() => setErrorBanner(null), 3000);
    } finally {
      setChatSending(false);
    }
  }, [currentGame, chatText, chatSending]);

  // Reset chat sent status when day changes
  useEffect(() => {
    if (currentGame && chatSentDay !== null && chatSentDay !== currentGame.currentDay) {
      setChatSentDay(null);
    }
  }, [currentGame?.currentDay, chatSentDay]);

  // Detect if we already sent a chat this day from events
  useEffect(() => {
    if (!currentGame || !myPlayer) return;
    const chatDay = currentGame.currentDay + 1;
    const alreadySent = currentGame.events.some(
      (e) => e.eventType === 'chat' && e.playerId === myPlayer.id && e.day === chatDay
    );
    if (alreadySent) setChatSentDay(currentGame.currentDay);
  }, [currentGame?.events, currentGame?.currentDay, myPlayer?.id]);

  const canChat = currentGame?.status === 'active' && myPlayer?.isAlive && chatSentDay !== currentGame?.currentDay;

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
            myPlayerTile={myPlayer?.position ?? null}
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
    let deadlineText: string | null = null;
    if (currentGame.isDefault && currentGame.lobbyDeadline) {
      const remaining = new Date(currentGame.lobbyDeadline).getTime() - Date.now();
      if (remaining > 0) {
        const mins = Math.ceil(remaining / 60000);
        deadlineText = mins > 60 ? `Starts in ${Math.floor(mins / 60)}h ${mins % 60}m` : `Starts in ${mins}m`;
      }
    }

    return (
      <View style={styles.container}>
        <View style={styles.lobbyOverlay}>
          <Text style={styles.lobbyTitle}>
            {currentGame.isDefault ? 'Daily Game' : 'Waiting for Players'}
          </Text>
          <Text style={styles.lobbyCount}>
            {currentGame.players.length}/{currentGame.maxPlayers} joined
          </Text>
          {deadlineText && (
            <Text style={styles.lobbyDeadline}>{deadlineText}</Text>
          )}
          {currentGame.isDefault && currentGame.players.length < 4 && (
            <Text style={styles.lobbyHint}>Needs at least 4 players to start</Text>
          )}
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
      {!isEliminated && (
        <>
          <PlayerStatsBar player={myPlayer} currentDay={currentGame.currentDay} />
          {deadlineRemaining && (
            <Text style={[styles.deadlineText, deadlineUrgent && styles.deadlineUrgent]}>
              {deadlineRemaining}
            </Text>
          )}
        </>
      )}
      <ScrollView contentContainerStyle={styles.scroll}>
        {isEliminated && (
          <View style={styles.eliminatedMapContainer}>
            <GameBoard
              foggedTiles={foggedTiles}
              boardSize={currentGame.boardSize}
              selectedTile={null}
              lockedTile={null}
              validTargets={new Set()}
              myPlayerTile={null}
              tombstoneTile={myPlayer.position}
              onTilePress={() => {}}
              maxHeight={windowHeight * 0.45}
            />
            <View style={styles.eliminatedMapOverlay} pointerEvents="none" />
            <View style={styles.eliminatedBannerOverlay} pointerEvents="none">
              <Text style={styles.eliminatedTitle}>You Have Been Eliminated</Text>
              <Text style={styles.eliminatedSubtitle}>Lasted {currentGame.currentDay} days</Text>
            </View>
          </View>
        )}
        {!isEliminated && (
          <GameBoard
            foggedTiles={foggedTiles}
            boardSize={currentGame.boardSize}
            selectedTile={selectedTile}
            lockedTile={submittedMove?.toTile ?? null}
            validTargets={submittedMove ? new Set() : (isSelectingTarget ? validAttackTargets : (selectedTile !== null ? new Set() : validTargets))}
            attackTargetTiles={attackTargetTilesSet}
            myPlayerTile={myPlayer?.position ?? null}
            onTilePress={handleTilePress}
            maxHeight={windowHeight * 0.45}
          />
        )}
        {!isEliminated && selectedTile !== null && (
          <MoveSelector
            selectedAction={pendingAction}
            buildOption={buildOption}
            isSubmitting={isSubmitting}
            isStunned={myPlayer.isStunned}
            targetTileType={currentGame.tiles[selectedTile].type}
            player={myPlayer}
            fighterClass={myPlayer.fighterClass}
            attackTarget={attackTarget}
            onSelectAction={setPendingAction}
            onSelectBuild={setBuildOption}
            onSubmit={handleRequestSubmit}
            onCancel={() => { resetMove(); setIsSelectingTarget(false); }}
            onRequestTarget={() => setIsSelectingTarget(true)}
            onClearTarget={() => { setAttackTarget(null); setIsSelectingTarget(false); }}
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
            fighterClass={myPlayer.fighterClass}
            attackTarget={submittedMove.attackTarget ?? null}
            onSelectAction={setPendingAction}
            onSelectBuild={setBuildOption}
            onSubmit={handleSubmit}
            onCancel={resetMove}

          />
        )}
        {!isEliminated && (
          <View style={styles.chatContainer}>
            <TextInput
              style={[styles.chatInput, !canChat && styles.chatInputDisabled]}
              placeholder={chatSentDay === currentGame.currentDay ? 'Message sent today' : 'Send a message...'}
              placeholderTextColor={COLORS.textSecondary}
              value={chatText}
              onChangeText={setChatText}
              maxLength={140}
              editable={canChat}
            />
            <TouchableOpacity
              style={[styles.chatSendBtn, (!canChat || !chatText.trim()) && styles.chatSendBtnDisabled]}
              onPress={handleSendChat}
              disabled={!canChat || !chatText.trim() || chatSending}
            >
              <Text style={styles.chatSendTxt}>Send</Text>
            </TouchableOpacity>
          </View>
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
  eliminatedMapContainer: {
    position: 'relative',
  },
  eliminatedMapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  eliminatedBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliminatedTitle: {
    color: COLORS.error,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  eliminatedSubtitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    marginBottom: 8,
  },
  lobbyDeadline: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  lobbyHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 12,
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
  deadlineText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  deadlineUrgent: {
    color: COLORS.error,
  },
  chatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginTop: 8,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  chatInputDisabled: {
    opacity: 0.5,
  },
  chatSendBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chatSendBtnDisabled: {
    opacity: 0.4,
  },
  chatSendTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
