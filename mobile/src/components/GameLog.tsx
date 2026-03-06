import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
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
      <ScrollView style={styles.list} nestedScrollEnabled>
        {reversed.map((item) => {
          const isChat = item.eventType === 'chat';

          return (
            <View key={item.id} style={[styles.row, isChat && styles.chatRow]}>
              <View style={[styles.dayBadge, isChat && styles.chatBadge]}>
                <Text style={[styles.dayText, isChat && styles.chatBadgeText]}>
                  {isChat ? 'MSG' : `D${item.day}`}
                </Text>
              </View>
              {isChat ? (
                <Text style={styles.chatMessage}>
                  {item.playerName ? (
                    <Text style={{ color: item.playerColor, fontWeight: 'bold' }}>{item.playerName}: </Text>
                  ) : null}
                  {item.message}
                </Text>
              ) : (
                <Text style={styles.message}>
                  {item.playerName ? (
                    <Text style={{ color: item.playerColor }}>{item.playerName} </Text>
                  ) : null}
                  {item.playerName ? item.message.replace(`${item.playerName} `, '') : item.message}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
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
  chatRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  dayBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  chatBadge: {
    backgroundColor: '#3a3a5c',
  },
  dayText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: 'bold',
  },
  chatBadgeText: {
    color: '#a0a0ff',
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  chatMessage: {
    color: COLORS.text,
    fontSize: 12,
    flex: 1,
    fontStyle: 'italic',
  },
});
