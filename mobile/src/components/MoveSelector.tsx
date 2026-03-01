import React from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { ActionType, BuildOption, TileType, GamePlayer, FighterClass } from '../types';
import { COLORS, BUILD_COSTS, UPGRADE_COSTS } from '../constants/theme';
import { ACTION_IMAGES, BUILD_IMAGES, UI_IMAGES } from '../assets';

const ACTIONS: ActionType[] = ['attack', 'defend', 'collect', 'build', 'scout'];
const LANDMARK_TILE_TYPES = new Set(['forest', 'mountain', 'water']);

const ACTION_COLORS: Record<ActionType, string> = {
  attack: '#e94560',
  defend: '#3498db',
  collect: '#2ecc71',
  build: '#f0c040',
  scout: '#9b59b6',
};

const ACTION_HIGHLIGHT_COLORS: Record<ActionType, string> = {
  attack: '#ff6b84',
  defend: '#5bb8f0',
  collect: '#50e88c',
  build: '#f5d46a',
  scout: '#b87dd4',
};

interface Props {
  selectedAction: ActionType | null;
  buildOption: BuildOption | null;
  isSubmitting: boolean;
  isStunned: boolean;
  isLocked?: boolean;
  targetTileType: TileType;
  player: GamePlayer;
  fighterClass: FighterClass;
  attackTarget: number | null;
  onSelectAction: (action: ActionType) => void;
  onSelectBuild: (option: BuildOption) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onChangeMoveRequest?: () => void;
  onRequestTarget?: () => void;
  onClearTarget?: () => void;
}

function getCollectLabel(tileType: TileType): string {
  if (tileType === 'forest') return 'Collect Wood';
  if (tileType === 'mountain') return 'Collect Metal';
  return 'Collect';
}

const BUILD_OPTIONS: BuildOption[] = ['wall', 'trap', 'upgrade'];

export default function MoveSelector({
  selectedAction, buildOption, isSubmitting, isStunned,
  isLocked = false,
  targetTileType, player, fighterClass, attackTarget,
  onSelectAction, onSelectBuild, onSubmit, onCancel,
  onChangeMoveRequest, onRequestTarget, onClearTarget,
}: Props) {
  const isRanged = fighterClass === 'archer' || fighterClass === 'mage';
  const needsTarget = isRanged && selectedAction === 'attack';
  const canAfford = (option: BuildOption) => {
    const cost = option === 'upgrade'
      ? (UPGRADE_COSTS[player.weaponTier - 1] || UPGRADE_COSTS[UPGRADE_COSTS.length - 1])
      : BUILD_COSTS[option];
    return player.wood >= cost.wood && player.metal >= cost.metal;
  };

  const canPlace = (option: BuildOption) => {
    if (option === 'upgrade') return true;
    return targetTileType === 'empty';
  };

  const isOptionEnabled = (option: BuildOption) => canAfford(option) && canPlace(option);

  const isSubmitReady = isStunned || (selectedAction !== null
    && (selectedAction !== 'build' || buildOption !== null)
    && (!needsTarget || attackTarget != null));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {isLocked && <Image source={UI_IMAGES.lock} style={styles.inlineIcon} />}
          <Text style={styles.title}>{isLocked ? ' Move Locked In' : 'Choose Action'}</Text>
        </View>
        {!isLocked && (
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
      {isStunned && (
        <View style={styles.stunnedBanner}>
          <View style={styles.stunnedRow}>
            <Image source={UI_IMAGES.stunned} style={styles.inlineIcon} />
            <Text style={styles.stunnedText}> Stunned — you can move but cannot act this turn</Text>
          </View>
        </View>
      )}
      <View style={styles.actions}>
        {ACTIONS.map((action) => {
          const canCollect = targetTileType === 'forest' || targetTileType === 'mountain';
          const disabled = isStunned || isLocked
            || (action === 'collect' && !canCollect)
            || (targetTileType === 'wall' && action !== 'attack')
            || (action === 'build' && LANDMARK_TILE_TYPES.has(targetTileType));
          return (
            <TouchableOpacity
              key={action}
              style={[
                styles.actionBtn,
                { backgroundColor: ACTION_COLORS[action] + (selectedAction === action ? 'DD' : '55') },
                selectedAction === action && { borderColor: ACTION_HIGHLIGHT_COLORS[action] },
                disabled && styles.buildDisabled,
              ]}
              disabled={disabled}
              onPress={() => {
                onSelectAction(action);
                if (action === 'attack' && isRanged && onRequestTarget) {
                  onRequestTarget();
                }
              }}
            >
              <Image source={ACTION_IMAGES[action]} style={styles.actionImage} />
              <Text style={[
                styles.actionLabel,
                selectedAction === action && styles.actionLabelSelected,
              ]}>
                {action === 'collect' ? getCollectLabel(targetTileType) :
                 action.charAt(0).toUpperCase() + action.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedAction === 'build' && (
        <View style={styles.buildMenu}>
          {BUILD_OPTIONS.map((option) => {
            const enabled = isOptionEnabled(option);
            const cost = option === 'upgrade'
              ? (UPGRADE_COSTS[player.weaponTier - 1] || UPGRADE_COSTS[UPGRADE_COSTS.length - 1])
              : BUILD_COSTS[option];
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.buildBtn,
                  buildOption === option && styles.buildSelected,
                  (!enabled || isLocked) && styles.buildDisabled,
                ]}
                disabled={!enabled || isLocked}
                onPress={() => onSelectBuild(option)}
              >
                <Image source={BUILD_IMAGES[option]} style={styles.buildImage} />
                <View style={styles.buildInfo}>
                  <Text style={[
                    styles.buildLabel,
                    buildOption === option && styles.buildLabelSelected,
                    !enabled && styles.buildLabelDisabled,
                  ]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                  <Text style={[styles.buildCost, !enabled && styles.buildLabelDisabled]}>
                    {cost.wood}W {cost.metal}M
                  </Text>
                </View>
                {!canAfford(option) && (
                  <Text style={styles.buildReason}>No resources</Text>
                )}
                {canAfford(option) && !canPlace(option) && (
                  <Text style={styles.buildReason}>Not empty</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {needsTarget && !isLocked && (
        <View style={styles.targetPrompt}>
          {attackTarget != null ? (
            <View style={styles.targetRow}>
              <Text style={styles.targetText}>
                Target: tile {attackTarget}
              </Text>
              <TouchableOpacity onPress={onClearTarget}>
                <Text style={styles.targetClear}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.targetText}>
              {fighterClass === 'archer'
                ? 'Tap a tile to target'
                : 'Tap top-left of 2\u00d72 area'}
            </Text>
          )}
        </View>
      )}

      {isLocked ? (
        <View style={styles.lockedLabelRow}>
          <View style={styles.lockedLabel}>
            <View style={styles.lockedRow}>
              <Image source={UI_IMAGES.checkmark} style={styles.inlineIcon} />
              <Text style={styles.lockedLabelText}> Move Locked In</Text>
            </View>
          </View>
          {onChangeMoveRequest && (
            <TouchableOpacity style={styles.changeBtn} onPress={onChangeMoveRequest}>
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.submitBtn, !isSubmitReady && styles.submitDisabled]}
          disabled={!isSubmitReady || isSubmitting}
          onPress={onSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit Move</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  stunnedBanner: {
    backgroundColor: 'rgba(220,53,69,0.2)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  stunnedText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 6,
  },
  actionBtn: {
    width: '18%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  actionSelected: {},
  actionImage: {
    width: 28,
    height: 28,
    marginBottom: 4,
  },
  actionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionLabelSelected: {
    color: '#fff',
  },
  buildMenu: {
    marginBottom: 16,
  },
  buildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buildSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(240,192,64,0.15)',
  },
  buildDisabled: {
    opacity: 0.4,
  },
  buildImage: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  buildInfo: {
    flex: 1,
  },
  buildLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  buildLabelSelected: {
    color: COLORS.gold,
  },
  buildLabelDisabled: {
    color: COLORS.textSecondary,
  },
  buildCost: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  buildReason: {
    color: COLORS.error,
    fontSize: 10,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lockedLabelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lockedLabel: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  lockedLabelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  changeBtn: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
  },
  changeBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  targetPrompt: {
    backgroundColor: 'rgba(233,69,96,0.15)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  targetText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  targetClear: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stunnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineIcon: {
    width: 16,
    height: 16,
  },
});
