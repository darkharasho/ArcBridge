#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

const readBumpArg = () => {
    const allowedBumps = new Set(['patch', 'minor', 'major']);
    const bumpIndex = args.findIndex((arg) => arg === '--bump');
    if (bumpIndex >= 0 && args[bumpIndex + 1]) return args[bumpIndex + 1];
    const direct = args.find((arg) => allowedBumps.has(arg));
    return direct || null;
};

const allowedBumps = new Set(['patch', 'minor', 'major']);
const bumpType = readBumpArg();
const skipReleaseNotes = args.includes('--skip-release-notes') || args.includes('--no-release-notes');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const gitCmd = isWin ? 'git.exe' : 'git';

const run = (command, commandArgs, options = {}) => {
    const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
    if (result.status !== 0) {
        const error = new Error(`Command failed: ${command} ${commandArgs.join(' ')}`);
        error.exitCode = result.status ?? 1;
        throw error;
    }
};

const bumpVersion = (current, type) => {
    const match = current.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        throw new Error(`Unsupported version format: ${current}`);
    }
    let major = Number(match[1]);
    let minor = Number(match[2]);
    let patch = Number(match[3]);

    if (type === 'major') { major += 1; minor = 0; patch = 0; }
    else if (type === 'minor') { minor += 1; patch = 0; }
    else if (type === 'patch') { patch += 1; }

    return `${major}.${minor}.${patch}`;
};

const packagePath = path.resolve('package.json');
const packageRaw = fs.readFileSync(packagePath, 'utf8');
const packageJson = JSON.parse(packageRaw);
const currentVersion = String(packageJson.version || '').trim();

if (!currentVersion) {
    console.error('package.json is missing a version.');
    process.exit(1);
}

const nextVersion = bumpType ? bumpVersion(currentVersion, bumpType) : currentVersion;
const tagName = `v${nextVersion}`;

try {
    // Quick local validation (typecheck + lint); full test suite runs in CI
    run(npmCmd, ['run', 'validate']);

    // Bump version
    if (bumpType) {
        if (!allowedBumps.has(bumpType)) {
            console.error(`Invalid bump type: ${bumpType}. Use patch, minor, or major.`);
            process.exit(1);
        }
        packageJson.version = nextVersion;
        fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 4)}\n`);
        run(npmCmd, ['install']);
    }

    // Generate release notes if not skipped
    if (!skipReleaseNotes) {
        run(npmCmd, ['run', 'generate:release-notes']);
    }

    // Commit
    const filesToAdd = ['package.json', 'package-lock.json'];
    if (fs.existsSync(path.resolve('RELEASE_NOTES.md'))) {
        filesToAdd.push('RELEASE_NOTES.md');
    }
    run(gitCmd, ['add', ...filesToAdd]);
    run(gitCmd, ['commit', '-m', `chore: release ${tagName}`]);
    run(gitCmd, ['push']);

    // Tag and push tag
    run(gitCmd, ['tag', tagName]);
    run(gitCmd, ['push', 'origin', tagName]);

    console.log(`\nRelease ${tagName} prepared and tag pushed.`);
    console.log('GitHub Actions will now build and publish the release.');
} catch (error) {
    const exitCode = error?.exitCode ?? 1;
    process.exit(exitCode);
}
