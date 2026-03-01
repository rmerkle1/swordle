import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  attackTargetTiles?: Set<number>;
  myPlayerTile?: number | null;
  onTilePress: (tileIndex: number) => void;
  maxHeight?: number;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.5;

export default function GameBoard({ foggedTiles, boardSize, selectedTile, lockedTile, validTargets, attackTargetTiles, myPlayerTile, onTilePress, maxHeight }: Props) {
  const { width, height } = useWindowDimensions();
  const [zoom, setZoom] = useState(1.5);
  const zoomBase = useRef(1);
  const hScrollRef = useRef<ScrollView>(null);
  const vScrollRef = useRef<ScrollView>(null);
  const hasCentered = useRef(false);

  const baseTileSize = Math.floor((width - BOARD_PADDING * 2) / boardSize);
  const tileSize = Math.floor(baseTileSize * zoom);
  const gridWidth = tileSize * boardSize;
  const gridHeight = tileSize * boardSize;

  // Calculate center of visible (non-void) tiles
  const visibleCenter = useMemo(() => {
    const visible = foggedTiles.filter((ft) => ft.displayType !== 'void' && ft.visibility !== 'hidden');
    if (visible.length === 0) return null;

    let minCol = boardSize, maxCol = 0, minRow = boardSize, maxRow = 0;
    for (const ft of visible) {
      const col = ft.index % boardSize;
      const row = Math.floor(ft.index / boardSize);
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
    }

    return {
      col: (minCol + maxCol) / 2,
      row: (minRow + maxRow) / 2,
    };
  }, [foggedTiles, boardSize]);

  // Center the scroll on visible tiles on first render
  useEffect(() => {
    if (hasCentered.current || !visibleCenter) return;
    hasCentered.current = true;

    const viewportWidth = width - 8; // marginHorizontal: 4 * 2
    const viewportHeight = height * 0.5; // approximate board viewport height

    const centerX = visibleCenter.col * tileSize + tileSize / 2;
    const centerY = visibleCenter.row * tileSize + tileSize / 2;

    const offsetX = Math.max(0, centerX - viewportWidth / 2);
    const offsetY = Math.max(0, centerY - viewportHeight / 2);

    // Use setTimeout to ensure ScrollViews are laid out
    setTimeout(() => {
      hScrollRef.current?.scrollTo({ x: offsetX, animated: false });
      vScrollRef.current?.scrollTo({ y: offsetY, animated: false });
    }, 50);
  }, [visibleCenter, tileSize, width, height]);

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      zoomBase.current = zoom;
    })
    .onUpdate((event) => {
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomBase.current * event.scale)));
    });

  return (
    <View style={[styles.wrapper, maxHeight != null && { height: maxHeight }]}>
      <GestureDetector gesture={pinchGesture}>
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={hScrollRef}
            horizontal
            contentContainerStyle={styles.scrollOuter}
            showsHorizontalScrollIndicator={false}
          >
            <ScrollView
              ref={vScrollRef}
              contentContainerStyle={styles.scrollInner}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={[styles.board, { width: gridWidth, backgroundColor: '#101011' }]}>
                {foggedTiles.map((ft) => (
                  <TileCell
                    key={ft.index}
                    foggedTile={ft}
                    size={tileSize}
                    isSelected={selectedTile === ft.index}
                    isLocked={lockedTile === ft.index}
                    isValidTarget={validTargets.has(ft.index)}
                    isAttackTarget={attackTargetTiles?.has(ft.index) ?? false}
                    isMyTile={myPlayerTile === ft.index}
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
    backgroundColor: '#101011',
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
