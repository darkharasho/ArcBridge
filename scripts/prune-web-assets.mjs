#!/usr/bin/env node
import { existsSync, rmSync } from 'fs';
import path from 'path';

const outDir = process.argv[2] || 'dist-web';
const target = path.join(outDir, 'img', 'game-icons');

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${target}`);
} else {
  console.log(`No game-icons folder found at ${target}`);
}
