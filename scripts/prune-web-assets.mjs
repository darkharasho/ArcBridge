#!/usr/bin/env node
import { existsSync, rmSync } from 'fs';
import path from 'path';

const outDir = process.argv[2] || 'dist-web';
const target = path.join(outDir, 'img', 'game-icons');
const spriteManifest = path.join(outDir, 'img', 'game-icons-sprite', 'manifest.json');

if (existsSync(target)) {
  if (existsSync(spriteManifest)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`Removed ${target} (sprite manifest detected)`);
  } else {
    console.log(`Keeping ${target} (no sprite manifest found)`);
  }
} else {
  console.log(`No game-icons folder found at ${target}`);
}
