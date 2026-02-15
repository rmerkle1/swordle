/**
 * Generates 64x64 solid-color placeholder PNGs for all game asset slots.
 * Run once: node mobile/scripts/generate-placeholders.js
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const SIZE = 128;

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function createPng(color, outPath) {
  const [r, g, b] = hexToRgb(color);
  const png = new PNG({ width: SIZE, height: SIZE });

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (SIZE * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }

  const buffer = PNG.sync.write(png);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log(`  Created ${path.relative(assetsDir, outPath)}`);
}

const assetsDir = path.join(__dirname, '..', 'src', 'assets');

// Tile images — colors match TILE_COLORS from theme.ts
const tiles = {
  void: '#1a1a2e',
  empty: '#2d2d4e',
  forest: '#2d6a4f',
  mountain: '#6c757d',
  wall: '#4a3728',
  trap: '#dc3545',
  water: '#1a5276',
  storm: '#5b2c6f',
};

// Action images
const actions = {
  attack: '#e94560',
  defend: '#3498db',
  collect: '#2ecc71',
  build: '#f39c12',
  scout: '#9b59b6',
};

// Build images
const build = {
  wall: '#4a3728',
  trap: '#dc3545',
  upgrade: '#f0c040',
};

// UI images
const ui = {
  logo: '#e94560',
  wood: '#2d6a4f',
  metal: '#6c757d',
  weapon: '#f39c12',
  'player-count': '#3498db',
  winner: '#f0c040',
  lock: '#a0a0b0',
  stunned: '#dc3545',
  checkmark: '#2ecc71',
};

console.log('Generating placeholder PNGs...\n');

console.log('Tiles:');
for (const [name, color] of Object.entries(tiles)) {
  createPng(color, path.join(assetsDir, 'tiles', `${name}.png`));
}

console.log('\nActions:');
for (const [name, color] of Object.entries(actions)) {
  createPng(color, path.join(assetsDir, 'actions', `${name}.png`));
}

console.log('\nBuild:');
for (const [name, color] of Object.entries(build)) {
  createPng(color, path.join(assetsDir, 'build', `${name}.png`));
}

console.log('\nUI:');
for (const [name, color] of Object.entries(ui)) {
  createPng(color, path.join(assetsDir, 'ui', `${name}.png`));
}

console.log('\nDone! Generated 25 placeholder PNGs.');
