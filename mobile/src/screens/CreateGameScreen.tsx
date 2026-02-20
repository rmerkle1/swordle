import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../constants/theme';
import { usePlayerStore } from '../store/playerStore';
import { api } from '../services/api';

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

  const coinCost = gamesToday === 0 ? 0 : 50;

  const handleCreate = async () => {
    if (!playerId) return;
    if (coinCost > 0 && coins < coinCost) {
      Alert.alert('Insufficient Coins', `You need ${coinCost} coins but only have ${coins}.`);
      return;
    }
    if (reservedSlots > 0 && !passcode.trim()) {
      Alert.alert('Passcode Required', 'Set a passcode when reserving slots.');
      return;
    }

    setCreating(true);
    try {
      const result = await api.createGame({
        maxPlayers,
        creatorId: playerId,
        moveDeadlineHour: deadlineHour,
        fighterClass,
        passcode: reservedSlots > 0 ? passcode.trim() : undefined,
        reservedSlots: reservedSlots > 0 ? reservedSlots : undefined,
        mapTheme,
      });
      usePlayerStore.setState({ coins: result.coinsRemaining, gamesToday: gamesToday + 1 });
      navigation.replace('Game', { gameId: result.id });
    } catch (err: any) {
      Alert.alert('Create Failed', err.message || 'Could not create game');
    }
    setCreating(false);
  };

  const playerCounts = [2, 3, 4, 6, 8, 10, 12, 16];

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
      <View style={styles.chipRow}>
        {playerCounts.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, maxPlayers === n && styles.chipActive]}
            onPress={() => {
              setMaxPlayers(n);
              if (reservedSlots >= n) setReservedSlots(n - 1);
            }}
          >
            <Text style={[styles.chipTxt, maxPlayers === n && styles.chipTxtActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
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
          <Text style={styles.classBtnTitle}>{c.name}</Text>
          <Text style={styles.classBtnDesc}>{c.desc}</Text>
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
      <Text style={styles.label}>Move Deadline Hour (UTC)</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => setDeadlineHour(Math.max(0, deadlineHour - 1))}>
          <Text style={styles.stepperTxt}>-</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{deadlineHour}</Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => setDeadlineHour(Math.min(23, deadlineHour + 1))}>
          <Text style={styles.stepperTxt}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Cost Display */}
      <View style={styles.costRow}>
        <Text style={styles.costLabel}>Cost:</Text>
        <Text style={[styles.costValue, coinCost === 0 && styles.costFree]}>
          {coinCost === 0 ? 'Free' : `${coinCost} coins`}
        </Text>
        <Text style={styles.costBalance}>Balance: {coins}</Text>
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
