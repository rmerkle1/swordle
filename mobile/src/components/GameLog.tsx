import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { GameEvent } from '../types';
import { COLORS } from '../constants/theme';

interface Props {
  events: GameEvent[];
}

export default function GameLog({ events }: Props) {
  const reversed = [...events].reverse();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Game Log</Text>
      <FlatList
        data={reversed}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.dayBadge}>
              <Text style={styles.dayText}>D{item.day}</Text>
            </View>
            <Text style={styles.message}>
              {item.playerName ? (
                <Text style={{ color: item.playerColor }}>{item.playerName} </Text>
              ) : null}
              {item.playerName ? item.message.replace(`${item.playerName} `, '') : item.message}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 8,
    marginTop: 8,
  },
  header: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  list: {
    maxHeight: 150,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  dayText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: 'bold',
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
});
