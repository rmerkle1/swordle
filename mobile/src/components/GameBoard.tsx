import React, { useState, useRef } from 'react';
import { View, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { FoggedTile } from '../types';
import { BOARD_PADDING } from '../constants/theme';
import TileCell from './TileCell';

interface Props {
  foggedTiles: FoggedTile[];
  boardSize: number;
  selectedTile: number | null;
  lockedTile: number | null;
  validTargets: Set<number>;
  onTilePress: (tileIndex: number) => void;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.5;

export default function GameBoard({ foggedTiles, boardSize, selectedTile, lockedTile, validTargets, onTilePress }: Props) {
  const { width } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  const zoomBase = useRef(1);

  const baseTileSize = Math.floor((width - BOARD_PADDING * 2) / boardSize);
  const tileSize = Math.floor(baseTileSize * zoom);
  const gridWidth = tileSize * boardSize;

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      zoomBase.current = zoom;
    })
    .onUpdate((event) => {
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomBase.current * event.scale)));
    });

  return (
    <View style={styles.wrapper}>
      <GestureDetector gesture={pinchGesture}>
        <View style={{ flex: 1 }}>
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
                    isLocked={lockedTile === ft.index}
                    isValidTarget={validTargets.has(ft.index)}
                    onPress={onTilePress}
                  />
                ))}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </GestureDetector>
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
