import React from 'react';
import { TouchableOpacity, Text, View, Image, StyleSheet } from 'react-native';
import { FoggedTile, FighterColor } from '../types';
import { TILE_IMAGES, FIGHTER_IMAGES } from '../assets';

interface Props {
  foggedTile: FoggedTile;
  size: number;
  isSelected: boolean;
  isLocked: boolean;
  isValidTarget: boolean;
  isAttackTarget?: boolean;
  isMyTile?: boolean;
  onPress: (tileIndex: number) => void;
}

export default function TileCell({ foggedTile, size, isSelected, isLocked, isValidTarget, isAttackTarget = false, isMyTile = false, onPress }: Props) {
  const { visibility, displayType, displayEmoji, displayPlayer } = foggedTile;

  // Hidden tiles render as void
  if (visibility === 'hidden') {
    return <View style={{ width: size, height: size }} />;
  }

  const nonInteractive = displayType === 'water' || displayType === 'storm';

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

        {/* Full visibility: fighter image fills tile */}
        {displayPlayer && displayPlayer.isAlive && !displayPlayer.isSilhouette && (
          <Image
            source={FIGHTER_IMAGES[displayPlayer.fighterClass][displayPlayer.color as FighterColor]}
            style={[styles.tileImage, { width: size, height: size }]}
          />
        )}

        {/* Partial visibility: silhouette dot with "?" */}
        {displayPlayer && displayPlayer.isAlive && displayPlayer.isSilhouette && (
          <View style={styles.silhouetteDot}>
            <Text style={styles.silhouetteText}>?</Text>
          </View>
        )}
      </View>

      {/* My tile highlight */}
      {isMyTile && (
        <View style={styles.myTileOverlay} pointerEvents="none" />
      )}

      {/* Selection overlay — renders on top of image */}
      {isSelected && (
        <View style={styles.selectedOverlay} pointerEvents="none" />
      )}

      {/* Locked move overlay — renders on top of image */}
      {isLocked && (
        <View style={styles.lockedOverlay} pointerEvents="none" />
      )}

      {/* Attack target overlay */}
      {isAttackTarget && (
        <View style={styles.attackTargetOverlay} pointerEvents="none" />
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
    borderColor: '#d74983',
  },
  locked: {
    borderWidth: 2,
    borderColor: '#88a5bb',
  },
  validTarget: {
    backgroundColor: 'rgba(215,73,131,0.25)',
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
    borderColor: '#d74983',
    backgroundColor: 'rgba(215,73,131,0.2)',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: '#88a5bb',
    backgroundColor: 'rgba(136,165,187,0.2)',
  },
  myTile: {
    borderWidth: 2,
    borderColor: 'rgba(215,73,131,0.5)',
  },
  myTileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(215,73,131,0.15)',
  },
  attackTarget: {
    borderWidth: 2,
    borderColor: 'rgba(233,69,96,0.8)',
  },
  attackTargetOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: 'rgba(233,69,96,0.8)',
    backgroundColor: 'rgba(233,69,96,0.3)',
  },
});
