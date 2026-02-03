#!/usr/bin/env node
import { existsSync, rmSync } from 'fs';
import path from 'path';

const outDir = process.argv[2] || 'dist-web';
const gameIcons = path.join(outDir, 'img', 'game-icons');
const gameSprites = path.join(outDir, 'img', 'game-icons-sprite');

if (existsSync(gameIcons)) {
  rmSync(gameIcons, { recursive: true, force: true });
  console.log(`Removed ${gameIcons}`);
} else {
  console.log(`No game-icons folder found at ${gameIcons}`);
}

if (existsSync(gameSprites)) {
  rmSync(gameSprites, { recursive: true, force: true });
  console.log(`Removed ${gameSprites}`);
} else {
  console.log(`No game-icons-sprite folder found at ${gameSprites}`);
}
