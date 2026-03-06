import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../constants/theme';
import { usePlayerStore } from '../store/playerStore';
import { api } from '../services/api';
import { FIGHTER_IMAGES } from '../assets';
import { FighterClass } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signTransaction } from '../utils/wallet';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CreateGameScreen() {
  const navigation = useNavigation<Nav>();
  const { playerId, coins, gamesToday } = usePlayerStore();

  const [maxPlayers, setMaxPlayers] = useState(4);
  const [reservedSlots, setReservedSlots] = useState(0);
  const [passcode, setPasscode] = useState('');
  const [fighterClass, setFighterClass] = useState('knight');
  const [mapTheme, setMapTheme] = useState('default');
  const [deadlineHour, setDeadlineHour] = useState(0);
  const [creating, setCreating] = useState(false);

  const skrCost = 100; // Custom game creation always costs 100 $SKR

  const handleCreate = async () => {
    if (!playerId) return;
    if (reservedSlots > 0 && !passcode.trim()) {
      Alert.alert('Passcode Required', 'Set a passcode when reserving slots.');
      return;
    }

    setCreating(true);
    try {
      // Step 1: Check if $SKR fee is required
      console.log('[CreateGame] Checking $SKR fee...');
      const feeResult = await api.getCreateFeeTx();
      console.log('[CreateGame] Fee result:', JSON.stringify(feeResult));

      if (feeResult.needsSignature && feeResult.transaction) {
        // Step 2: Sign the $SKR transfer via MWA
        console.log('[CreateGame] Fee required — signing tx via MWA...');
        const mwaAuthToken = await AsyncStorage.getItem('swordle_auth_token');
        if (!mwaAuthToken) {
          console.error('[CreateGame] No MWA auth token found');
          Alert.alert('Wallet Error', 'Please reconnect your wallet.');
          setCreating(false);
          return;
        }
        const signedTx = await signTransaction(feeResult.transaction, mwaAuthToken);
        console.log('[CreateGame] Transaction signed');

        // Step 3: Submit signed transaction
        console.log('[CreateGame] Submitting signed tx to backend...');
        const confirmResult = await api.confirmEntry('0', signedTx);
        console.log('[CreateGame] Entry confirmed:', JSON.stringify(confirmResult));
      } else {
        console.log('[CreateGame] No $SKR fee required');
      }

      // Step 4: Create the game
      console.log('[CreateGame] Creating game...');
      const result = await api.createGame({
        maxPlayers,
        moveDeadlineHour: deadlineHour,
        fighterClass,
        passcode: reservedSlots > 0 ? passcode.trim() : undefined,
        reservedSlots: reservedSlots > 0 ? reservedSlots : undefined,
        mapTheme,
      });
      console.log('[CreateGame] Game created! id:', result.id);
      usePlayerStore.setState({ coins: result.coinsRemaining, gamesToday: gamesToday + 1 });
      navigation.replace('Game', { gameId: result.id });
    } catch (err: any) {
      console.error('[CreateGame] Error:', err?.message, err);
      const msg = err?.message || 'Could not create game';
      if (msg.includes('Insufficient $SKR')) {
        Alert.alert('Insufficient $SKR', msg);
      } else if (msg.includes('AUTHORIZATION_DECLINED') || msg.includes('declined')) {
        Alert.alert('Transaction Declined', 'You declined the $SKR transfer.');
      } else {
        Alert.alert('Create Failed', msg);
      }
    }
    setCreating(false);
  };

  const [playerCountText, setPlayerCountText] = useState(String(maxPlayers));

  const clampPlayers = (n: number) => Math.max(2, Math.min(16, n));

  const updateMaxPlayers = (n: number) => {
    const clamped = clampPlayers(n);
    setMaxPlayers(clamped);
    setPlayerCountText(String(clamped));
    if (reservedSlots >= clamped) setReservedSlots(clamped - 1);
  };

  const classes = [
    { id: 'knight', name: 'Knight', desc: '75% duel advantage' },
    { id: 'archer', name: 'Archer', desc: 'Ranged single-tile attack' },
    { id: 'cavalry', name: 'Cavalry', desc: 'Move 2 tiles per turn' },
    { id: 'mage', name: 'Mage', desc: 'Area-of-effect attack' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Create Game</Text>

      {/* Player Count */}
      <Text style={styles.label}>Player Count</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => updateMaxPlayers(maxPlayers - 1)}>
          <Text style={styles.stepperTxt}>-</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.stepperInput}
          value={playerCountText}
          onChangeText={setPlayerCountText}
          onBlur={() => {
            const parsed = parseInt(playerCountText, 10);
            updateMaxPlayers(isNaN(parsed) ? 2 : parsed);
          }}
          onSubmitEditing={() => {
            const parsed = parseInt(playerCountText, 10);
            updateMaxPlayers(isNaN(parsed) ? 2 : parsed);
          }}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={2}
        />
        <TouchableOpacity style={styles.stepperBtn} onPress={() => updateMaxPlayers(maxPlayers + 1)}>
          <Text style={styles.stepperTxt}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Reserved Slots */}
      <Text style={styles.label}>Reserved Slots</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => setReservedSlots(Math.max(0, reservedSlots - 1))}>
          <Text style={styles.stepperTxt}>-</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{reservedSlots}</Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => setReservedSlots(Math.min(maxPlayers - 1, reservedSlots + 1))}>
          <Text style={styles.stepperTxt}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Passcode */}
      {reservedSlots > 0 && (
        <>
          <Text style={styles.label}>Passcode</Text>
          <TextInput
            style={styles.input}
            value={passcode}
            onChangeText={setPasscode}
            placeholder="Enter passcode for reserved slots"
            placeholderTextColor={COLORS.textSecondary}
            maxLength={50}
          />
        </>
      )}

      {/* Fighter Class */}
      <Text style={styles.label}>Your Class</Text>
      {classes.map((c) => (
        <TouchableOpacity
          key={c.id}
          style={[styles.classBtn, fighterClass === c.id && styles.classBtnActive]}
          onPress={() => setFighterClass(c.id)}
        >
          <View style={styles.classBtnRow}>
            <Image source={FIGHTER_IMAGES[c.id as FighterClass].red} style={styles.classBtnImg} />
            <View style={styles.classBtnText}>
              <Text style={styles.classBtnTitle}>{c.name}</Text>
              <Text style={styles.classBtnDesc}>{c.desc}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* Map Theme */}
      <Text style={styles.label}>Map Theme</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, mapTheme === 'default' && styles.chipActive]}
          onPress={() => setMapTheme('default')}
        >
          <Text style={[styles.chipTxt, mapTheme === 'default' && styles.chipTxtActive]}>Default</Text>
        </TouchableOpacity>
      </View>

      {/* Move Deadline Hour */}
      <Text style={styles.label}>Daily Start Time (UTC)</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => setDeadlineHour(Math.max(0, deadlineHour - 1))}>
          <Text style={styles.stepperTxt}>-</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{String(deadlineHour).padStart(2, '0')}:00 UTC</Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => setDeadlineHour(Math.min(23, deadlineHour + 1))}>
          <Text style={styles.stepperTxt}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Cost Display */}
      <View style={styles.costRow}>
        <Text style={styles.costLabel}>Cost:</Text>
        <Text style={styles.costValue}>{skrCost} $SKR</Text>
      </View>

      {/* Create Button */}
      <TouchableOpacity
        style={[styles.createBtn, creating && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={creating}
      >
        <Text style={styles.createTxt}>{creating ? 'Creating...' : 'Create Game'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipTxt: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTxtActive: {
    color: '#fff',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperTxt: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  stepperValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'center',
  },
  stepperInput: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.textSecondary,
    paddingVertical: 4,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.textSecondary + '44',
  },
  classBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.textSecondary + '44',
    marginBottom: 8,
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
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  costLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  costValue: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  costFree: {
    color: COLORS.success,
  },
  costBalance: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginLeft: 'auto',
  },
  createBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
