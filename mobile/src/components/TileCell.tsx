import React from 'react';
import { TouchableOpacity, Text, View, Image, StyleSheet } from 'react-native';
import { FoggedTile } from '../types';
import { TILE_COLORS, COLORS } from '../constants/theme';
import { TILE_IMAGES, FIGHTER_IMAGES } from '../assets';
import { FighterClass } from '../types';

const FOG_COLOR = '#0a0a1e';

interface Props {
  foggedTile: FoggedTile;
  size: number;
  isSelected: boolean;
  isLocked: boolean;
  isValidTarget: boolean;
  isAttackTarget?: boolean;
  onPress: (tileIndex: number) => void;
}

function blendColor(hex: string, overlay: string, opacity: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(overlay);
  const r = Math.round(r1 * (1 - opacity) + r2 * opacity);
  const g = Math.round(g1 * (1 - opacity) + g2 * opacity);
  const b = Math.round(b1 * (1 - opacity) + b2 * opacity);
  return `rgb(${r},${g},${b})`;
}

export default function TileCell({ foggedTile, size, isSelected, isLocked, isValidTarget, isAttackTarget = false, onPress }: Props) {
  const { visibility, displayType, displayEmoji, displayPlayer } = foggedTile;

  // Hidden tiles render as void
  if (visibility === 'hidden') {
    return <View style={{ width: size, height: size }} />;
  }

  const baseColor = TILE_COLORS[displayType] || TILE_COLORS.empty;
  const nonInteractive = displayType === 'water' || displayType === 'storm';

  let backgroundColor = baseColor;
  if (visibility === 'partial') {
    backgroundColor = blendColor(baseColor, FOG_COLOR, 0.2);
  } else if (visibility === 'fogged') {
    backgroundColor = blendColor(baseColor, FOG_COLOR, 0.4);
  }

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
          backgroundColor,
        },
        isSelected && styles.selected,
        isLocked && styles.locked,
        isValidTarget && styles.validTarget,
        isAttackTarget && styles.attackTarget,
      ]}
    >
      {displayType !== 'void' && (
        <Image
          source={TILE_IMAGES[displayType]}
          style={[
            styles.tileImage,
            { width: size, height: size },
            visibility === 'fogged' && styles.fadedImage,
          ]}
        />
      )}

      {/* Full visibility: fighter icon with colored border */}
      {displayPlayer && displayPlayer.isAlive && !displayPlayer.isSilhouette && (
        <View style={[styles.playerMarker, { borderColor: displayPlayer.color }]}>
          <Image source={FIGHTER_IMAGES[displayPlayer.fighterClass]} style={styles.fighterImage} />
        </View>
      )}

      {/* Partial visibility: silhouette dot with "?" */}
      {displayPlayer && displayPlayer.isAlive && displayPlayer.isSilhouette && (
        <View style={styles.silhouetteDot}>
          <Text style={styles.silhouetteText}>?</Text>
        </View>
      )}

      {/* Fog overlay for fogged tiles */}
      {visibility === 'fogged' && (
        <View style={styles.fogOverlay} pointerEvents="none" />
      )}

      {/* Partial overlay */}
      {visibility === 'partial' && (
        <View style={styles.partialOverlay} pointerEvents="none" />
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
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selected: {
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  locked: {
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  validTarget: {
    backgroundColor: 'rgba(240,192,64,0.25)',
  },
  tileImage: {
    position: 'absolute',
  },
  fadedImage: {
    opacity: 0.5,
  },
  playerMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fighterImage: {
    width: 30,
    height: 30,
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
  fogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,30,0.45)',
  },
  partialOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,30,0.15)',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(240,192,64,0.2)',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: COLORS.success,
    backgroundColor: 'rgba(46,204,113,0.2)',
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
