import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');
const releaseNotesPath = path.join(rootDir, 'RELEASE_NOTES.md');

const loadEnvFile = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) return;
        const key = match[1];
        let value = match[2] ?? '';
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    });
};

loadEnvFile(path.join(rootDir, '.env'));

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
    console.error('GITHUB_TOKEN (or GH_TOKEN) is not set. Aborting release body update.');
    process.exit(1);
}

if (!fs.existsSync(releaseNotesPath)) {
    console.error('RELEASE_NOTES.md not found. Aborting release body update.');
    process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson?.version || '0.0.0';
const tagName = `v${version}`;

const publishConfig = packageJson?.build?.publish || {};
const owner = publishConfig.owner;
const repo = publishConfig.repo;
if (!owner || !repo) {
    console.error('Missing GitHub owner/repo in package.json build.publish.');
    process.exit(1);
}

const notes = fs.readFileSync(releaseNotesPath, 'utf8').trim();
if (!notes) {
    console.error('RELEASE_NOTES.md is empty. Aborting release body update.');
    process.exit(1);
}

const request = async (method, url, body) => {
    const resp = await fetch(url, {
        method,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    if (resp.status === 404) return { ok: false, status: 404, data: null };
    const data = await resp.json().catch(() => null);
    return { ok: resp.ok, status: resp.status, data };
};

const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

const findReleaseByTag = async () => {
    const releasesResp = await request('GET', `${baseUrl}/releases?per_page=100`);
    if (!releasesResp.ok || !Array.isArray(releasesResp.data)) return null;
    return releasesResp.data.find((release) => release?.tag_name === tagName) || null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let releaseResp = await request('GET', `${baseUrl}/releases/tags/${tagName}`);
if (releaseResp.status === 404) {
    const retryDelays = [800, 1200, 1800, 2600, 3400];
    for (const delay of retryDelays) {
        await sleep(delay);
        const existing = await findReleaseByTag();
        if (existing?.id) {
            releaseResp = { ok: true, status: 200, data: existing };
            break;
        }
    }
    if (releaseResp.status === 404) {
        releaseResp = await request('POST', `${baseUrl}/releases`, {
            tag_name: tagName,
            name: tagName,
            body: notes,
            draft: true,
            prerelease: false
        });
    }
}

if (!releaseResp.ok || !releaseResp.data?.id) {
    console.error(`Failed to create/load release for ${tagName}.`);
    process.exit(1);
}

const updateResp = await request('PATCH', `${baseUrl}/releases/${releaseResp.data.id}`, {
    body: notes,
    draft: false
});

if (!updateResp.ok) {
    console.error(`Failed to update release body (${updateResp.status}).`);
    process.exit(1);
}

console.log(`Updated GitHub release body for ${tagName}.`);
