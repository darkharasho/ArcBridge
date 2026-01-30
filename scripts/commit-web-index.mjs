import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const indexPath = path.join(rootDir, 'dist-web', 'index.html');

if (!fs.existsSync(indexPath)) {
    console.log('commit-web-index: dist-web/index.html not found, skipping.');
    process.exit(0);
}

const run = (args) => spawnSync('git', args, { encoding: 'utf8' });

const gitCheck = run(['rev-parse', '--is-inside-work-tree']);
if (gitCheck.status !== 0) {
    console.log('commit-web-index: not a git repository, skipping.');
    process.exit(0);
}

const status = run(['status', '--porcelain', 'dist-web/index.html', 'dist-web/assets/index*']);
if (status.status !== 0 || !status.stdout.trim()) {
    console.log('commit-web-index: no index changes detected.');
    process.exit(0);
}

const name = run(['config', 'user.name']);
if (!name.stdout.trim()) {
    const actor = process.env.GITHUB_ACTOR || 'qa-build';
    run(['config', 'user.name', actor]);
}

const email = run(['config', 'user.email']);
if (!email.stdout.trim()) {
    const actor = process.env.GITHUB_ACTOR || 'qa-build';
    const fallback = process.env.GITHUB_ACTOR
        ? `${process.env.GITHUB_ACTOR}@users.noreply.github.com`
        : 'qa-build@users.noreply.github.com';
    run(['config', 'user.email', fallback]);
}

const addResult = run(['add', 'dist-web/index.html', 'dist-web/assets/index*']);
if (addResult.status !== 0) {
    console.error('commit-web-index: failed to stage index files.');
    process.exit(1);
}

const commitResult = run(['commit', '-m', 'Update dist-web index files']);
if (commitResult.status !== 0) {
    console.error('commit-web-index: commit failed.');
    process.exit(1);
}

console.log('commit-web-index: committed dist-web index files.');
