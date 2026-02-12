import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, useWindowDimensions, StyleSheet } from 'react-native';
import { FoggedTile } from '../types';
import { BOARD_PADDING, COLORS } from '../constants/theme';
import TileCell from './TileCell';

interface Props {
  foggedTiles: FoggedTile[];
  boardSize: number;
  selectedTile: number | null;
  validTargets: Set<number>;
  onTilePress: (tileIndex: number) => void;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.3;

export default function GameBoard({ foggedTiles, boardSize, selectedTile, validTargets, onTilePress }: Props) {
  const { width } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);

  const baseTileSize = Math.floor((width - BOARD_PADDING * 2) / boardSize);
  const tileSize = Math.floor(baseTileSize * zoom);
  const gridWidth = tileSize * boardSize;

  const zoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));

  return (
    <View style={styles.wrapper}>
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn}>
          <Text style={styles.zoomTxt}>+</Text>
        </TouchableOpacity>
        <Text style={styles.zoomLevel}>{Math.round(zoom * 100)}%</Text>
        <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut}>
          <Text style={styles.zoomTxt}>{'\u2212'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        contentContainerStyle={styles.scrollOuter}
        showsHorizontalScrollIndicator={false}
      >
        <ScrollView
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <View style={[styles.board, { width: gridWidth, backgroundColor: '#000' }]}>
            {foggedTiles.map((ft) => (
              <TileCell
                key={ft.index}
                foggedTile={ft}
                size={tileSize}
                isSelected={selectedTile === ft.index}
                isValidTarget={validTargets.has(ft.index)}
                onPress={onTilePress}
              />
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#000',
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    gap: 12,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomTxt: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  zoomLevel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center',
  },
  scrollOuter: {
    flexGrow: 1,
  },
  scrollInner: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
