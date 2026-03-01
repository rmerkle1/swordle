import { ImageSourcePropType } from 'react-native';
import { TileType, ActionType, BuildOption, FighterClass, FighterColor } from '../types';

export const TILE_IMAGES: Record<TileType, ImageSourcePropType> = {
  void: require('./tiles/void.png'),
  empty: require('./tiles/empty.png'),
  forest: require('./tiles/forest.png'),
  mountain: require('./tiles/mountain.png'),
  wall: require('./tiles/wall.png'),
  trap: require('./tiles/trap.png'),
  water: require('./tiles/water.png'),
  storm: require('./tiles/storm.png'),
};

export const ACTION_IMAGES: Record<ActionType, ImageSourcePropType> = {
  attack: require('./actions/attack.png'),
  defend: require('./actions/defend.png'),
  collect: require('./actions/collect.png'),
  build: require('./actions/build.png'),
  scout: require('./actions/scout.png'),
};

export const BUILD_IMAGES: Record<BuildOption, ImageSourcePropType> = {
  wall: require('./build/wall.png'),
  trap: require('./build/trap.png'),
  upgrade: require('./build/upgrade.png'),
};

export const FIGHTER_IMAGES: Record<FighterClass, Record<FighterColor, ImageSourcePropType>> = {
  knight: {
    red: require('./fighters/knight_red.png'),
    blue: require('./fighters/knight_blue.png'),
    yellow: require('./fighters/knight_yellow.png'),
    purple: require('./fighters/knight_purple.png'),
    green: require('./fighters/knight_green.png'),
  },
  archer: {
    red: require('./fighters/archer_red.png'),
    blue: require('./fighters/archer_blue.png'),
    yellow: require('./fighters/archer_yellow.png'),
    purple: require('./fighters/archer_purple.png'),
    green: require('./fighters/archer_green.png'),
  },
  cavalry: {
    red: require('./fighters/cavalry_red.png'),
    blue: require('./fighters/cavalry_blue.png'),
    yellow: require('./fighters/cavalry_yellow.png'),
    purple: require('./fighters/cavalry_purple.png'),
    green: require('./fighters/cavalry_green.png'),
  },
  mage: {
    red: require('./fighters/mage_red.png'),
    blue: require('./fighters/mage_blue.png'),
    yellow: require('./fighters/mage_yellow.png'),
    purple: require('./fighters/mage_purple.png'),
    green: require('./fighters/mage_green.png'),
  },
};

export const UI_IMAGES = {
  logo: require('./ui/logo.png') as ImageSourcePropType,
  wood: require('./ui/wood.png') as ImageSourcePropType,
  metal: require('./ui/metal.png') as ImageSourcePropType,
  weapon: require('./ui/weapon.png') as ImageSourcePropType,
  playerCount: require('./ui/player-count.png') as ImageSourcePropType,
  winner: require('./ui/winner.png') as ImageSourcePropType,
  lock: require('./ui/lock.png') as ImageSourcePropType,
  stunned: require('./ui/stunned.png') as ImageSourcePropType,
  checkmark: require('./ui/checkmark.png') as ImageSourcePropType,
  silhouette: require('./ui/silhouette.png') as ImageSourcePropType,
};
