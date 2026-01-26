const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '..', 'testdata', '20260125-202439.json');
const expectedPath = process.argv[3] || path.join(__dirname, '..', 'testdata', 'boon-generation-expected.json');

const safeDiv = (a, b, fallback = 0) => (b ? a / b : fallback);

const isBoon = (meta) => {
  if (!meta || !meta.classification) return true;
  return meta.classification === 'Boon';
};

const computeGenerationMs = (category, stacking, generation, wasted, durationMs, groupCount, squadCount) => {
  const count = category === 'selfBuffs'
    ? 1
    : category === 'groupBuffs'
      ? Math.max(groupCount - 1, 0)
      : Math.max(squadCount - 1, 0);

  if (!count || !durationMs) {
    return { generationMs: 0, wastedMs: 0 };
  }

  if (stacking) {
    return {
      generationMs: generation * durationMs * count,
      wastedMs: wasted * durationMs * count,
    };
  }

  return {
    generationMs: (generation / 100) * durationMs * count,
    wastedMs: (wasted / 100) * durationMs * count,
  };
};

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const buffMap = data.buffMap || {};
const players = data.players || [];
const durationMs = data.durationMS || 0;
const squadPlayers = players.filter((p) => !p.notInSquad);
const squadCount = squadPlayers.length;
const groupCounts = new Map();
squadPlayers.forEach((player) => {
  const group = player.group ?? 0;
  groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
});

const perBoonTotals = {};
const perBoonPlayers = {};

squadPlayers.forEach((player) => {
  const account = player.account || player.name || player.character_name || 'Unknown';
  const groupCount = groupCounts.get(player.group ?? 0) || 1;
  ['selfBuffs', 'groupBuffs', 'squadBuffs'].forEach((category) => {
    (player[category] || []).forEach((buff) => {
      if (typeof buff?.id !== 'number') return;
      const boonId = `b${buff.id}`;
      const meta = buffMap[boonId];
      if (!isBoon(meta)) return;
      const stacking = meta?.stacking ?? false;
      const generation = buff.buffData?.[0]?.generation ?? 0;
      const wasted = buff.buffData?.[0]?.wasted ?? 0;
      const { generationMs } = computeGenerationMs(
        category,
        stacking,
        generation,
        wasted,
        durationMs,
        groupCount,
        squadCount,
      );
      if (!generationMs) return;

      if (!perBoonTotals[boonId]) {
        perBoonTotals[boonId] = {
          name: meta?.name || boonId,
          stacking: !!stacking,
          categories: {
            selfBuffs: 0,
            groupBuffs: 0,
            squadBuffs: 0,
          },
        };
      }

      perBoonTotals[boonId].categories[category] += generationMs / 1000;

      if (!perBoonPlayers[boonId]) {
        perBoonPlayers[boonId] = {};
      }
      if (!perBoonPlayers[boonId][account]) {
        perBoonPlayers[boonId][account] = 0;
      }
      perBoonPlayers[boonId][account] += generationMs / 1000;
    });
  });
});

const output = Object.keys(perBoonTotals)
  .sort()
  .map((boonId) => {
    const totals = perBoonTotals[boonId];
    const players = perBoonPlayers[boonId] || {};
    const topPlayers = Object.entries(players)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([account, total]) => ({ account, total: Number(total.toFixed(2)) }));

    return {
      id: boonId,
      name: totals.name,
      stacking: totals.stacking,
      categories: {
        selfBuffs: Number(totals.categories.selfBuffs.toFixed(2)),
        groupBuffs: Number(totals.categories.groupBuffs.toFixed(2)),
        squadBuffs: Number(totals.categories.squadBuffs.toFixed(2)),
      },
      topPlayers,
    };
  });

if (!fs.existsSync(expectedPath)) {
  fs.writeFileSync(expectedPath, JSON.stringify(output, null, 2));
  console.log(`Wrote expected data to ${expectedPath}`);
  process.exit(0);
}

const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
const expectedJson = JSON.stringify(expected);
const outputJson = JSON.stringify(output);

if (expectedJson !== outputJson) {
  console.error('Boon generation validation failed. Expected data differs from current output.');
  process.exit(1);
}

console.log('Boon generation validation passed.');
