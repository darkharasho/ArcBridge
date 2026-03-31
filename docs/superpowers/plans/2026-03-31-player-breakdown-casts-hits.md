# Player Breakdown: Casts, Hits, and Hits/Cast — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Casts, Hits, and Hits/Cast metrics to the player breakdown skill drill-down, sourcing cast counts from EI JSON rotation data.

**Architecture:** Add a `casts` field to `PlayerSkillDamageEntry`, populate it from `p.rotation` during aggregation in `computePlayerAggregation.ts`, and display three new metric rows in `PlayerBreakdownSection.tsx`. Skills without rotation data (conditions, procs) show casts as 0 and Hits/Cast as "—".

**Tech Stack:** TypeScript, React, Vitest

**Spec:** `docs/superpowers/specs/2026-03-31-player-breakdown-casts-hits-design.md`

---

### Task 1: Add `casts` field to `PlayerSkillDamageEntry`

**Files:**
- Modify: `src/renderer/stats/statsTypes.ts:40-49`

- [ ] **Step 1: Add the `casts` field to the interface**

In `src/renderer/stats/statsTypes.ts`, add `casts: number;` after the `hits` field:

```typescript
export interface PlayerSkillDamageEntry {
    id: string;
    name: string;
    icon?: string;
    damage: number;
    downContribution: number;
    hits: number;
    casts: number;
    min: number;
    max: number;
}
```

- [ ] **Step 2: Run typecheck to see what breaks**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: Errors in `computePlayerAggregation.ts` where `PlayerSkillDamageEntry` objects are created without `casts`. This confirms the type change propagated.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stats/statsTypes.ts
git commit -m "feat: add casts field to PlayerSkillDamageEntry type"
```

---

### Task 2: Initialize and populate `casts` in aggregation

**Files:**
- Modify: `src/renderer/stats/computePlayerAggregation.ts:1016` (initializer)
- Modify: `src/renderer/stats/computePlayerAggregation.ts:~1089` (rotation loop)

- [ ] **Step 1: Write the failing test**

Add a new test to `src/renderer/__tests__/computeStatsAggregation.skillDamage.test.ts`:

```typescript
it('aggregates casts from rotation data into player skill breakdown', () => {
    const arcDividerId = 29852;
    const playerKey = 'TestPlayer.1234';
    const log = {
        status: 'success',
        filePath: 'skill-casts-test',
        details: {
            durationMS: 10000,
            skillMap: {
                [`s${arcDividerId}`]: { name: 'Arc Divider', icon: 'https://example.invalid/arc.png' }
            },
            buffMap: {},
            players: [
                {
                    account: 'TestPlayer.1234',
                    profession: 'Berserker',
                    notInSquad: false,
                    dpsAll: [{ damage: 50000, dps: 5000 }],
                    statsAll: [{ connectedDamageCount: 20 }],
                    support: [{ resurrects: 0 }],
                    damage1S: [[0, 10000, 20000, 30000, 40000, 50000]],
                    targetDamage1S: [[[0, 10000, 20000, 30000, 40000, 50000]]],
                    targetDamageDist: [[[
                        { id: arcDividerId, totalDamage: 50000, connectedHits: 20, hits: 20, min: 1000, max: 5000, downContribution: 10000 }
                    ]]],
                    totalDamageDist: [[
                        { id: arcDividerId, totalDamage: 50000, connectedHits: 20, hits: 20, min: 1000, max: 5000, downContribution: 10000 }
                    ]],
                    rotation: [
                        { id: arcDividerId, skills: [0, 1500, 3000, 4500, 6000] }
                    ]
                }
            ],
            targets: []
        }
    };

    const { stats } = computeStatsAggregation({ logs: [log as any] });
    const playerBreakdown = (stats.playerSkillBreakdowns || []).find((entry: any) => entry.key === playerKey);
    expect(playerBreakdown).toBeTruthy();
    const skill = (playerBreakdown.skills || []).find((s: any) => s.name === 'Arc Divider');
    expect(skill).toBeTruthy();
    expect(skill.casts).toBe(5);
    expect(skill.hits).toBe(20);
});

it('sets casts to 0 for skills without rotation data (conditions/procs)', () => {
    const vampAuraId = 30285;
    const playerKey = 'TestPlayer.1234';
    const log = {
        status: 'success',
        filePath: 'skill-casts-no-rotation-test',
        details: {
            durationMS: 10000,
            skillMap: {},
            buffMap: {
                [`b${vampAuraId}`]: { name: 'Vampiric Aura', icon: 'https://example.invalid/vamp.png' }
            },
            players: [
                {
                    account: 'TestPlayer.1234',
                    profession: 'Berserker',
                    notInSquad: false,
                    dpsAll: [{ damage: 5000, dps: 500 }],
                    statsAll: [{ connectedDamageCount: 3 }],
                    support: [{ resurrects: 0 }],
                    damage1S: [[0, 1000, 2000, 3000, 4000, 5000]],
                    targetDamage1S: [[[0, 1000, 2000, 3000, 4000, 5000]]],
                    targetDamageDist: [[[
                        { id: vampAuraId, totalDamage: 5000, connectedHits: 3, hits: 3, min: 1000, max: 2000 }
                    ]]],
                    totalDamageDist: [[
                        { id: vampAuraId, totalDamage: 5000, connectedHits: 3, hits: 3, min: 1000, max: 2000 }
                    ]],
                    rotation: []
                }
            ],
            targets: []
        }
    };

    const { stats } = computeStatsAggregation({ logs: [log as any] });
    const playerBreakdown = (stats.playerSkillBreakdowns || []).find((entry: any) => entry.key === playerKey);
    expect(playerBreakdown).toBeTruthy();
    const skill = (playerBreakdown.skills || []).find((s: any) => s.name === 'Vampiric Aura');
    expect(skill).toBeTruthy();
    expect(skill.casts).toBe(0);
});

it('aggregates casts across multiple logs', () => {
    const arcDividerId = 29852;
    const playerKey = 'TestPlayer.1234';
    const makeLog = (casts: number[], hits: number, damage: number) => ({
        status: 'success',
        filePath: `skill-casts-multi-${casts.length}`,
        details: {
            durationMS: 5000,
            skillMap: {
                [`s${arcDividerId}`]: { name: 'Arc Divider' }
            },
            buffMap: {},
            players: [
                {
                    account: 'TestPlayer.1234',
                    profession: 'Berserker',
                    notInSquad: false,
                    dpsAll: [{ damage, dps: damage / 5 }],
                    statsAll: [{ connectedDamageCount: hits }],
                    support: [{ resurrects: 0 }],
                    damage1S: [[0, damage]],
                    targetDamage1S: [[[0, damage]]],
                    targetDamageDist: [[[
                        { id: arcDividerId, totalDamage: damage, connectedHits: hits, hits, min: 500, max: 3000 }
                    ]]],
                    totalDamageDist: [[
                        { id: arcDividerId, totalDamage: damage, connectedHits: hits, hits, min: 500, max: 3000 }
                    ]],
                    rotation: [
                        { id: arcDividerId, skills: casts }
                    ]
                }
            ],
            targets: []
        }
    });

    const { stats } = computeStatsAggregation({
        logs: [makeLog([0, 1000, 2000], 10, 20000) as any, makeLog([0, 1000], 8, 15000) as any]
    });
    const playerBreakdown = (stats.playerSkillBreakdowns || []).find((entry: any) => entry.key === playerKey);
    expect(playerBreakdown).toBeTruthy();
    const skill = (playerBreakdown.skills || []).find((s: any) => s.name === 'Arc Divider');
    expect(skill).toBeTruthy();
    expect(skill.casts).toBe(5);
    expect(skill.hits).toBe(18);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/__tests__/computeStatsAggregation.skillDamage.test.ts 2>&1 | tail -20`

Expected: New tests FAIL (either type error from missing `casts` init, or `skill.casts` is `undefined`).

- [ ] **Step 3: Initialize `casts: 0` in the skill entry constructor**

In `src/renderer/stats/computePlayerAggregation.ts`, at ~line 1016 where the `PlayerSkillDamageEntry` is created, add `casts: 0`:

```typescript
skillEntry = { id: skillId, name, icon, damage: 0, downContribution: 0, hits: 0, casts: 0, min: Infinity, max: 0 };
```

- [ ] **Step 4: Add rotation loop after damage dist processing**

In `src/renderer/stats/computePlayerAggregation.ts`, immediately after the closing of the `if (skillDamageSource === 'total') { ... } else { ... }` block (~line 1089), add:

```typescript
// Inject cast counts from rotation data
if (Array.isArray(p.rotation)) {
    p.rotation.forEach((rot: any) => {
        if (!rot?.id) return;
        const count = rot.skills?.length || 0;
        if (count <= 0) return;
        const skillId = `s${rot.id}`;
        const skillEntry = playerBreakdown!.skills.get(skillId);
        if (skillEntry) {
            skillEntry.casts += count;
        }
    });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/renderer/__tests__/computeStatsAggregation.skillDamage.test.ts 2>&1 | tail -20`

Expected: All tests PASS, including the three new ones.

- [ ] **Step 6: Run full validation**

Run: `npm run validate 2>&1 | tail -10`

Expected: No type errors, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/stats/computePlayerAggregation.ts src/renderer/__tests__/computeStatsAggregation.skillDamage.test.ts
git commit -m "feat: populate casts from rotation data in player skill breakdown"
```

---

### Task 3: Display Casts, Hits, and Hits/Cast in the UI

**Files:**
- Modify: `src/renderer/stats/sections/PlayerBreakdownSection.tsx:569-591`

- [ ] **Step 1: Add the three new metric rows**

In `src/renderer/stats/sections/PlayerBreakdownSection.tsx`, in the metric array at line 569, add three new entries after the `{ label: 'Max Hit', ... }` entry (line 590). The full array should now be:

```typescript
{([
    { label: 'Down Contribution', value: formatTopStatValue(activePlayerSkill?.downContribution || 0) },
    { label: 'Total Damage', value: formatTopStatValue(activePlayerSkill?.damage || 0) },
    {
        label: 'DPS',
        value: formatWithCommas(
            activePlayerBreakdown.totalFightMs > 0
                ? (activePlayerSkill?.damage || 0) / (activePlayerBreakdown.totalFightMs / 1000)
                : 0,
            1
        )
    },
    { label: 'Min Hit', value: formatTopStatValue(activePlayerSkill?.min || 0) },
    {
        label: 'Avg Hit',
        value: formatTopStatValue(
            (activePlayerSkill?.hits || 0) > 0
                ? Math.round((activePlayerSkill?.damage || 0) / (activePlayerSkill?.hits || 1))
                : 0
        )
    },
    { label: 'Max Hit', value: formatTopStatValue(activePlayerSkill?.max || 0) },
    { label: 'Casts', value: formatTopStatValue(activePlayerSkill?.casts || 0) },
    { label: 'Hits', value: formatTopStatValue(activePlayerSkill?.hits || 0) },
    {
        label: 'Hits / Cast',
        value: (activePlayerSkill?.casts || 0) > 0
            ? formatWithCommas((activePlayerSkill?.hits || 0) / (activePlayerSkill?.casts || 1), 2)
            : '—'
    }
]).map((row) => (
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint 2>&1 | tail -10`

Expected: No errors (max-warnings 0).

- [ ] **Step 4: Run unit tests**

Run: `npm run test:unit 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/sections/PlayerBreakdownSection.tsx
git commit -m "feat: display Casts, Hits, and Hits/Cast in player skill drill-down"
```
