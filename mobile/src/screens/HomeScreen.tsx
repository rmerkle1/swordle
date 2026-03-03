import React, { useCallback, useState } from 'react';
import { View, Text, Image, SectionList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Modal } from 'react-native';
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
import { UI_IMAGES, FIGHTER_IMAGES } from '../assets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signTransaction } from '../utils/wallet';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const { games, setGames } = useGameStore();
  const { playerId, coins } = usePlayerStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [pendingJoinGameId, setPendingJoinGameId] = useState<string | null>(null);

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

  const handleJoinGame = async (gameId: string) => {
    if (!playerId) return;
    setPendingJoinGameId(gameId);
    setShowClassPicker(true);
  };

  const confirmJoinWithClass = async (fighterClass: string) => {
    if (!playerId || !pendingJoinGameId) return;
    setShowClassPicker(false);
    console.log('[JoinGame] Joining game', pendingJoinGameId, 'as', fighterClass);
    try {
      // Step 1: Check if $SKR fee is required
      console.log('[JoinGame] Checking $SKR fee...');
      const feeResult = await api.getEntryFeeTx(pendingJoinGameId);
      console.log('[JoinGame] Fee result:', JSON.stringify(feeResult));

      if (feeResult.needsSignature && feeResult.transaction) {
        // Step 2: Sign the $SKR transfer via MWA
        console.log('[JoinGame] Fee required — signing tx via MWA...');
        const mwaAuthToken = await AsyncStorage.getItem('swordle_auth_token');
        if (!mwaAuthToken) {
          console.error('[JoinGame] No MWA auth token found');
          Alert.alert('Wallet Error', 'Please reconnect your wallet.');
          setPendingJoinGameId(null);
          return;
        }
        const signedTx = await signTransaction(feeResult.transaction, mwaAuthToken);
        console.log('[JoinGame] Transaction signed');

        // Step 3: Submit signed transaction
        console.log('[JoinGame] Submitting signed tx to backend...');
        const confirmResult = await api.confirmEntry(pendingJoinGameId, signedTx);
        console.log('[JoinGame] Entry confirmed:', JSON.stringify(confirmResult));
      } else {
        console.log('[JoinGame] No $SKR fee required (first free game)');
      }

      // Step 4: Join the game
      console.log('[JoinGame] Calling joinGame API...');
      const result = await api.joinGame(pendingJoinGameId, playerId, fighterClass);
      console.log('[JoinGame] Joined! Game status:', result.game.status);
      if (result.coinsRemaining !== undefined) {
        usePlayerStore.setState({ coins: result.coinsRemaining });
      }
      refreshGames();
      if (result.game.status === 'active') {
        navigation.navigate('Game', { gameId: result.game.id });
      }
    } catch (err: any) {
      console.error('[JoinGame] Error:', err?.message, err);
      const msg = err?.message || 'Could not join game';
      if (msg.includes('Insufficient $SKR')) {
        Alert.alert('Insufficient $SKR', msg);
      } else if (msg.includes('AUTHORIZATION_DECLINED') || msg.includes('declined')) {
        Alert.alert('Transaction Declined', 'You declined the $SKR transfer.');
      } else {
        Alert.alert('Join Failed', msg);
      }
    }
    setPendingJoinGameId(null);
  };

  const isMyGame = (g: Game) => g.players.some((p) => p.playerId === playerId);
  const defaultLobbies = games.filter((g) => g.isDefault && g.status === 'lobby');
  const customLobbies = games.filter((g) => !g.isDefault && g.status === 'lobby' && !isMyGame(g));
  const activeOthers = games.filter((g) => g.status === 'active' && !isMyGame(g));

  const sections = [
    { title: 'Daily Game', data: defaultLobbies },
    { title: 'Open Lobbies', data: customLobbies },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <Image source={UI_IMAGES.logo} style={styles.headingLogo} />
        <Text style={styles.heading}> Swordle</Text>
        <Text style={styles.coinBalance}>{coins} coins</Text>
      </View>
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
      <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateGame')}>
        <Text style={styles.createTxt}>+ Create Game</Text>
      </TouchableOpacity>

      {/* Class Picker Modal */}
      <Modal visible={showClassPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Class</Text>

            <TouchableOpacity style={[styles.classBtn, styles.classBtnActive]} onPress={() => confirmJoinWithClass('knight')}>
              <View style={styles.classBtnRow}>
                <Image source={FIGHTER_IMAGES.knight.red} style={styles.classBtnImg} />
                <View style={styles.classBtnText}>
                  <Text style={styles.classBtnTitle}>Knight</Text>
                  <Text style={styles.classBtnDesc}>Melee fighter with 75% duel advantage</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.classBtn, styles.classBtnActive]} onPress={() => confirmJoinWithClass('archer')}>
              <View style={styles.classBtnRow}>
                <Image source={FIGHTER_IMAGES.archer.red} style={styles.classBtnImg} />
                <View style={styles.classBtnText}>
                  <Text style={styles.classBtnTitle}>Archer</Text>
                  <Text style={styles.classBtnDesc}>Ranged attacker targeting adjacent tiles</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.classBtn, styles.classBtnActive]} onPress={() => confirmJoinWithClass('cavalry')}>
              <View style={styles.classBtnRow}>
                <Image source={FIGHTER_IMAGES.cavalry.red} style={styles.classBtnImg} />
                <View style={styles.classBtnText}>
                  <Text style={styles.classBtnTitle}>Cavalry</Text>
                  <Text style={styles.classBtnDesc}>Can move 2 tiles per turn</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.classBtn, styles.classBtnActive]} onPress={() => confirmJoinWithClass('mage')}>
              <View style={styles.classBtnRow}>
                <Image source={FIGHTER_IMAGES.mage.red} style={styles.classBtnImg} />
                <View style={styles.classBtnText}>
                  <Text style={styles.classBtnTitle}>Mage</Text>
                  <Text style={styles.classBtnDesc}>Area-of-effect ranged attack</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowClassPicker(false); setPendingJoinGameId(null); }}>
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  headingLogo: {
    width: 32,
    height: 32,
  },
  heading: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
  },
  coinBalance: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '600',
    position: 'absolute',
    right: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 360,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    alignSelf: 'center',
    marginTop: 8,
  },
  modalCancelTxt: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  classBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  classBtnActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '22',
  },
  classBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classBtnImg: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  classBtnText: {
    flex: 1,
  },
  classBtnTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  classBtnDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
