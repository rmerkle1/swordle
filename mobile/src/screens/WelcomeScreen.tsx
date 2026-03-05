import React, { useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';
import { usePlayerStore } from '../store/playerStore';
import { UI_IMAGES } from '../assets';

export default function WelcomeScreen() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { authenticateWallet } = usePlayerStore();

  const handleStart = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    if (trimmed.length > 20) {
      setError('Name must be 20 characters or less');
      return;
    }

    setLoading(true);
    setError('');
    console.log('[WelcomeScreen] Connect & Start pressed — name:', trimmed);
    try {
      await authenticateWallet(trimmed);
      console.log('[WelcomeScreen] authenticateWallet succeeded');
    } catch (err: any) {
      console.error('[WelcomeScreen] authenticateWallet error:', err?.message, err);
      const msg = err?.message || '';
      if (msg.includes('Found no installed wallet')) {
        setError('No Solana wallet found. Install a wallet app.');
      } else if (msg.includes('AUTHORIZATION_DECLINED') || msg.includes('declined')) {
        setError('Wallet connection was declined.');
      } else {
        setError(msg || 'Failed to authenticate. Is the server running?');
      }
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Image source={UI_IMAGES.logo} style={styles.titleLogo} />
        <Text style={styles.title}> Swordle</Text>
      </View>

      <Text style={styles.subtitle}>Choose your name to get started</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter name..."
        placeholderTextColor={COLORS.textSecondary}
        value={name}
        onChangeText={setName}
        maxLength={20}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleStart}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Connect Wallet & Start</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>You'll be prompted to connect your Solana wallet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleLogo: {
    width: 44,
    height: 44,
  },
  title: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: 'bold',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 32,
  },
  input: {
    width: '100%',
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
    textAlign: 'center',
  },
  error: {
    color: COLORS.error,
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    width: '100%',
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 16,
    opacity: 0.7,
  },
});
