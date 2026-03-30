# Minimum Fight Participation Threshold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable minimum fight participation percentage that filters low-participation players from leaderboards and MVP scoring.

**Architecture:** A new `minParticipationPercent` field in `IStatsViewSettings` (default 0) flows through to `computeStatsAggregation`, which filters `playerEntries` into a `leaderboardEntries` subset used for leaderboard construction and MVP scoring. Dense table rows remain unfiltered. A slider control in SettingsView lets users configure the threshold.

**Tech Stack:** TypeScript, React, Vitest

---

### Task 1: Add setting to type definitions and defaults

**Files:**
- Modify: `src/renderer/global.d.ts:73-81` (IStatsViewSettings interface)
- Modify: `src/renderer/global.d.ts:196-204` (DEFAULT_STATS_VIEW_SETTINGS)

- [ ] **Step 1: Add `minParticipationPercent` to `IStatsViewSettings`**

In `src/renderer/global.d.ts`, add the field to the interface at line 80 (before the closing brace):

```typescript
// In IStatsViewSettings, add after topSkillsMetric:
    minParticipationPercent: number;
```

The full interface becomes:
```typescript
export interface IStatsViewSettings {
    showTopStats: boolean;
    showMvp: boolean;
    roundCountStats: boolean;
    splitPlayersByClass: boolean;
    topStatsMode: 'total' | 'perSecond' | 'perMinute';
    topSkillDamageSource: 'total' | 'target';
    topSkillsMetric: 'damage' | 'downContribution';
    minParticipationPercent: number;
}
```

- [ ] **Step 2: Add default value**

In `src/renderer/global.d.ts`, add to `DEFAULT_STATS_VIEW_SETTINGS` at line 203 (before the closing brace):

```typescript
    minParticipationPercent: 0
```

The full default becomes:
```typescript
export const DEFAULT_STATS_VIEW_SETTINGS: IStatsViewSettings = {
    showTopStats: true,
    showMvp: true,
    roundCountStats: false,
    splitPlayersByClass: false,
    topStatsMode: 'total',
    topSkillDamageSource: 'target',
    topSkillsMetric: 'damage',
    minParticipationPercent: 0
};
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS (the new field has a default, so existing spread patterns like `{ ...DEFAULT_STATS_VIEW_SETTINGS, ...(settings.statsViewSettings || {}) }` will provide it automatically).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/global.d.ts
git commit -m "feat: add minParticipationPercent to IStatsViewSettings"
```

### Task 2: Filter leaderboard and MVP entries in aggregation

**Files:**
- Modify: `src/renderer/stats/computeStatsAggregation.ts:130,227-284,487`

- [ ] **Step 1: Read `minParticipationPercent` from settings**

In `src/renderer/stats/computeStatsAggregation.ts`, after line 142 (where `splitPlayersByClass` is read), add:

```typescript
        const minParticipationPercent = activeStatsViewSettings.minParticipationPercent ?? 0;
```

- [ ] **Step 2: Create `leaderboardEntries` after `playerEntries` is built**

After line 227 (the closing of the `playerEntries` block, before line 229 `const hasMitigationTotals`), insert:

```typescript
        const totalLogCount = logs.length;
        const minLogsRequired = minParticipationPercent > 0
            ? Math.ceil(totalLogCount * (minParticipationPercent / 100))
            : 0;
        const leaderboardEntries = minLogsRequired > 0
            ? playerEntries.filter(({ stat }) => stat.logsJoined >= minLogsRequired)
            : playerEntries;
```

- [ ] **Step 3: Use `leaderboardEntries` for leaderboard construction**

At line 282, change `createLB` to use `leaderboardEntries` instead of `playerEntries`:

```typescript
        // Before:
        const createLB = (k: string, higher: boolean) => buildLeaderboard(playerEntries.map(({ stat }) => ({
            account: stat.account, profession: stat.profession, professionList: stat.professionList, value: getVal(stat, k), count: stat.logsJoined
        })), higher);

        // After:
        const createLB = (k: string, higher: boolean) => buildLeaderboard(leaderboardEntries.map(({ stat }) => ({
            account: stat.account, profession: stat.profession, professionList: stat.professionList, value: getVal(stat, k), count: stat.logsJoined
        })), higher);
```

- [ ] **Step 4: Use `leaderboardEntries` for MVP scoring**

At line 487, inside `computeCategoryScores`, change the `playerEntries.forEach` to use `leaderboardEntries`:

```typescript
        // Before (line 487):
                playerEntries.forEach(({ stat }) => {

        // After:
                leaderboardEntries.forEach(({ stat }) => {
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/stats/computeStatsAggregation.ts
git commit -m "feat: filter low-participation players from leaderboards and MVP scoring"
```

### Task 3: Add settings UI control

**Files:**
- Modify: `src/renderer/SettingsView.tsx:1892` (after the "Split players by class" toggle)

- [ ] **Step 1: Add participation threshold slider**

In `src/renderer/SettingsView.tsx`, after the "Split players by class" `Toggle` block (line ~1892, before the `<div className="py-3">` that starts "Top Stats Calculation"), insert:

```tsx
                            <div className="py-3">
                                <div className="flex items-center justify-between mb-1">
                                    <div>
                                        <div className="text-sm font-medium text-gray-200">Min. Fight Participation</div>
                                        <div className="text-xs text-gray-500">Exclude players below this threshold from leaderboards and MVP.</div>
                                    </div>
                                    <div className="text-sm font-semibold text-blue-200 tabular-nums w-12 text-right">
                                        {statsViewSettings.minParticipationPercent}%
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={statsViewSettings.minParticipationPercent}
                                    onChange={(e) => updateStatsViewSetting('minParticipationPercent', Number(e.target.value))}
                                    className="w-full accent-blue-500"
                                />
                                <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                                    <span>0% (all players)</span>
                                    <span>100%</span>
                                </div>
                            </div>
```

- [ ] **Step 2: Run typecheck and lint**

```bash
npm run validate
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/SettingsView.tsx
git commit -m "feat: add min fight participation slider to stats settings"
```

### Task 4: Write unit tests

**Files:**
- Modify: `src/renderer/__tests__/StatsView.integration.test.tsx` (or create new test file if more appropriate)

- [ ] **Step 1: Identify existing test patterns**

Read `src/renderer/__tests__/StatsView.integration.test.tsx` to understand the test setup and patterns used. The test file uses `computeStatsAggregation` with mock log data and `IMvpWeights` / `IStatsViewSettings`.

Alternatively, check if there's a dedicated test file for `computeStatsAggregation`. If so, add tests there.

- [ ] **Step 2: Write test for threshold=0 (default, no filtering)**

Create or add to the appropriate test file:

```typescript
describe('minParticipationPercent', () => {
    it('includes all players in leaderboards when threshold is 0', () => {
        // Use existing test fixture data or minimal mock logs
        // with players having varying logsJoined counts
        const result = computeStatsAggregation({
            logs: testLogs, // at least 10 logs with some players in only 2
            statsViewSettings: { ...DEFAULT_STATS_VIEW_SETTINGS, minParticipationPercent: 0 }
        });
        // All players should appear in leaderboards
        const allAccounts = result.leaderboards.downContrib.map((r: any) => r.account);
        expect(allAccounts).toContain(lowParticipationPlayerAccount);
    });

    it('excludes low-participation players from leaderboards when threshold is 80', () => {
        const result = computeStatsAggregation({
            logs: testLogs, // 10 logs, player in only 2 = 20% participation
            statsViewSettings: { ...DEFAULT_STATS_VIEW_SETTINGS, minParticipationPercent: 80 }
        });
        const allAccounts = result.leaderboards.downContrib.map((r: any) => r.account);
        expect(allAccounts).not.toContain(lowParticipationPlayerAccount);
    });

    it('still includes low-participation players in offense table rows', () => {
        const result = computeStatsAggregation({
            logs: testLogs,
            statsViewSettings: { ...DEFAULT_STATS_VIEW_SETTINGS, minParticipationPercent: 80 }
        });
        const tableAccounts = result.offensePlayers.map((r: any) => r.account);
        expect(tableAccounts).toContain(lowParticipationPlayerAccount);
    });
});
```

Note: The exact test setup will depend on how existing tests construct mock log data. Follow the patterns already established in the test file. The key assertions are:
1. threshold=0 → all players in leaderboards
2. threshold=80 with 10 logs → player with 2 logs excluded from leaderboards
3. threshold=80 → same player still in table rows (offensePlayers, defensePlayers, etc.)

- [ ] **Step 3: Run tests**

```bash
npm run test:unit
```

Expected: All tests pass including new ones.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/__tests__/
git commit -m "test: add unit tests for min participation threshold filtering"
```

### Task 5: Validate

- [ ] **Step 1: Run full validation**

```bash
npm run validate
```

Expected: typecheck and lint pass with 0 warnings.

- [ ] **Step 2: Run all unit tests**

```bash
npm run test:unit
```

Expected: All tests pass, no regressions.
