import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { FoggedTile } from '../types';
import { TILE_COLORS, COLORS } from '../constants/theme';

const FOG_COLOR = '#0a0a1e';

interface Props {
  foggedTile: FoggedTile;
  size: number;
  isSelected: boolean;
  isValidTarget: boolean;
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

export default function TileCell({ foggedTile, size, isSelected, isValidTarget, onPress }: Props) {
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
        isValidTarget && styles.validTarget,
      ]}
    >
      {displayEmoji ? (
        <Text
          style={[
            styles.emoji,
            { fontSize: size * 0.4 },
            visibility === 'fogged' && styles.fadedEmoji,
          ]}
        >
          {displayEmoji}
        </Text>
      ) : null}

      {/* Full visibility: colored player dot */}
      {displayPlayer && displayPlayer.isAlive && !displayPlayer.isSilhouette && (
        <View style={[styles.playerDot, { backgroundColor: displayPlayer.color }]} />
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
  validTarget: {
    backgroundColor: 'rgba(240,192,64,0.25)',
  },
  emoji: {
    position: 'absolute',
  },
  fadedEmoji: {
    opacity: 0.5,
  },
  playerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  silhouetteDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
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
});
