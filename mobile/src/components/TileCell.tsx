import React from 'react';
import { TouchableOpacity, Text, View, Image, StyleSheet } from 'react-native';
import { FoggedTile, FighterColor } from '../types';
import { TILE_IMAGES, FIGHTER_IMAGES, UI_IMAGES } from '../assets';

const LEGACY_COLOR_MAP: Record<string, FighterColor> = {
  '#e94560': 'red',
  '#3498db': 'blue',
  '#2ecc71': 'green',
  '#f39c12': 'yellow',
  '#9b59b6': 'purple',
};

function toFighterColor(color: string): FighterColor {
  return (LEGACY_COLOR_MAP[color] || color || 'red') as FighterColor;
}

interface Props {
  foggedTile: FoggedTile;
  size: number;
  isSelected: boolean;
  isLocked: boolean;
  isValidTarget: boolean;
  isAttackTarget?: boolean;
  isMyTile?: boolean;
  isTombstone?: boolean;
  onPress: (tileIndex: number) => void;
}

export default function TileCell({ foggedTile, size, isSelected, isLocked, isValidTarget, isAttackTarget = false, isMyTile = false, isTombstone = false, onPress }: Props) {
  const { visibility, displayType, displayEmoji, displayPlayer } = foggedTile;

  // Hidden tiles render as void
  if (visibility === 'hidden') {
    return <View style={{ width: size, height: size }} />;
  }

  const nonInteractive = (displayType === 'water' || displayType === 'storm') && !isAttackTarget;

  // Fog = opacity on the entire cell content
  const cellOpacity = visibility === 'full' ? 1.0 : 0.5;

  return (
    <TouchableOpacity
      onPress={nonInteractive ? undefined : () => onPress(foggedTile.index)}
      activeOpacity={nonInteractive ? 1 : 0.7}
      disabled={nonInteractive}
      style={[
        styles.cell,
        {
          width: size,
          height: size,
        },
        isSelected && styles.selected,
        isLocked && styles.locked,
        isValidTarget && styles.validTarget,
        isAttackTarget && styles.attackTarget,
        isMyTile && styles.myTile,
      ]}
    >
      {/* Tile background with fog opacity */}
      <View style={{ opacity: cellOpacity, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {displayType !== 'void' && (
          <Image
            source={TILE_IMAGES[displayType]}
            style={[
              styles.tileImage,
              { width: size, height: size },
            ]}
          />
        )}
      </View>

      {/* My tile highlight — behind fighter */}
      {isMyTile && (
        <View style={styles.myTileOverlay} pointerEvents="none" />
      )}

      {/* Valid target overlay — behind fighter */}
      {isValidTarget && !isSelected && !isAttackTarget && (
        <View style={styles.validTargetOverlay} pointerEvents="none" />
      )}

      {/* Full visibility: fighter image fills tile — on top of highlights */}
      {displayPlayer && displayPlayer.isAlive && !displayPlayer.isSilhouette && (
        <Image
          source={FIGHTER_IMAGES[displayPlayer.fighterClass][toFighterColor(displayPlayer.color)]}
          style={[styles.tileImage, { width: size, height: size, opacity: cellOpacity }]}
        />
      )}

      {/* Partial visibility: silhouette image — on top of highlights */}
      {displayPlayer && displayPlayer.isAlive && displayPlayer.isSilhouette && (
        <Image
          source={UI_IMAGES.silhouette}
          style={[styles.tileImage, { width: size, height: size, opacity: cellOpacity }]}
        />
      )}

      {/* Selection overlay — on top of everything */}
      {isSelected && (
        <View style={styles.selectedOverlay} pointerEvents="none" />
      )}

      {/* Locked move overlay — on top of everything */}
      {isLocked && (
        <View style={styles.lockedOverlay} pointerEvents="none" />
      )}

      {/* Attack target overlay — on top of everything */}
      {isAttackTarget && (
        <View style={styles.attackTargetOverlay} pointerEvents="none" />
      )}

      {/* Tombstone marker */}
      {isTombstone && (
        <View style={styles.tombstoneOverlay} pointerEvents="none">
          <Image source={UI_IMAGES.tombstone} style={styles.tombstoneImg} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'transparent',
  },
  selected: {
    borderWidth: 2,
    borderColor: '#edd555',
  },
  locked: {
    borderWidth: 2,
    borderColor: '#88a5bb',
  },
  validTarget: {
    backgroundColor: 'rgba(237,213,85,0.25)',
  },
  tileImage: {
    position: 'absolute',
  },
  silhouetteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#555',
    borderWidth: 1,
    borderColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouetteText: {
    color: '#aaa',
    fontSize: 9,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: '#edd555',
    backgroundColor: 'rgba(237,213,85,0.35)',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: '#88a5bb',
    backgroundColor: 'rgba(136,165,187,0.2)',
  },
  myTile: {
    borderWidth: 2,
    borderColor: 'rgba(237,213,85,0.4)',
  },
  myTileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(237,213,85,0.15)',
  },
  attackTarget: {
    borderWidth: 2,
    borderColor: 'rgba(190,34,47,0.8)',
  },
  attackTargetOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: 'rgba(190,34,47,0.8)',
    backgroundColor: 'rgba(190,34,47,0.3)',
  },
  validTargetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(237,213,85,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(237,213,85,0.4)',
  },
  tombstoneOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tombstoneImg: {
    width: 28,
    height: 28,
    opacity: 0.85,
  },
});
