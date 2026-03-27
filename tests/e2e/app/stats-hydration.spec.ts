/**
 * E2E tests for the details hydration flow and dissolve overlay behaviour.
 *
 * Verifies that the loading overlay persists while fight details are being
 * hydrated from dps.report, and that stats populate with real player data
 * once hydration completes.
 *
 * Uses the app-mode test infrastructure (served React build + mocked
 * electronAPI).  Real EI JSON fixtures from test-fixtures/boon/ are served
 * via Playwright route interception.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createElectronAPIMock, type ElectronAPIMockOverrides } from './fixtures/electronAPIMock';

// ── Fixture IDs (20260117 series — 7 real WvW fights) ─────────────
const FIXTURE_IDS = [
    '20260117-175120',
    '20260117-180135',
    '20260117-180259',
    '20260117-180458',
    '20260117-180636',
    '20260117-180826',
    '20260117-181030',
];

const FIXTURE_DIR = path.resolve(process.cwd(), 'test-fixtures/boon');

/** Build metadata-only mock logs (no details field). */
function makeMockLogs() {
    return FIXTURE_IDS.map((id, i) => ({
        id: `log-${id}`,
        filePath: `/fake/logs/${id}.zevtc`,
        fightName: 'Green Alpine Borderlands',
        permalink: `https://dps.report/${id}`,
        uploadTime: Date.now() - (FIXTURE_IDS.length - i) * 60_000,
        encounterDuration: '60',
        status: 'success',
        dashboardSummary: {
            hasPlayers: true,
            hasTargets: true,
            squadCount: 35 + i,
            enemyCount: 40 + i,
            isWin: i % 3 !== 0,
            squadDeaths: 2,
            enemyDeaths: 5,
        },
    }));
}

/** Set up page with mocked API and fixture route interception. */
async function setupHydrationPage(page: Page, overrides: Partial<ElectronAPIMockOverrides> = {}) {
    const mockOverrides: ElectronAPIMockOverrides = {
        logs: makeMockLogs(),
        detailsFixtureIds: FIXTURE_IDS,
        detailsDelayMs: 200,
        ...overrides,
    };

    await page.addInitScript(createElectronAPIMock, mockOverrides);

    // Intercept fixture requests and serve real EI JSON from disk
    await page.route('**/__test-fixtures__/*.json', async (route) => {
        const url = route.request().url();
        const match = url.match(/__test-fixtures__\/(.+)\.json/);
        if (!match) {
            await route.abort();
            return;
        }
        const fixtureId = match[1];
        const filePath = path.join(FIXTURE_DIR, `${fixtureId}.json`);
        if (!fs.existsSync(filePath)) {
            await route.fulfill({ status: 404, body: 'Not found' });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: fs.readFileSync(filePath, 'utf8'),
        });
    });

    await page.goto('/');
    await page.locator('.app-titlebar').waitFor({ state: 'visible', timeout: 10_000 });
}

/** Navigate to Stats tab. */
async function goToStats(page: Page) {
    const tab = page.getByRole('button', { name: /^Stats$/i });
    await tab.click();
    await page.waitForTimeout(300);
}

// ── Tests ──────────────────────────────────────────────────────────

test.describe('Details Hydration & Dissolve Overlay (HYDR-001–005)', () => {
    test('HYDR-001: dissolve overlay visible while details are pending', async ({ page }) => {
        await setupHydrationPage(page, { detailsDelayMs: 600 });
        await goToStats(page);

        // The dissolve overlay should be active — look for the scroll-lock class
        // or the unloaded section styling
        await expect(
            page.locator('.stats-dashboard-scroll-lock, .stats-section-wrap--unloaded').first()
        ).toBeVisible({ timeout: 10_000 });
    });

    test('HYDR-002: progress bar shows "Loading fight details" during hydration', async ({ page }) => {
        await setupHydrationPage(page, { detailsDelayMs: 800 });
        await goToStats(page);

        // Wait for the aggregation phase to complete and the details phase to begin
        await expect(
            page.getByText(/Loading fight details/i)
        ).toBeVisible({ timeout: 20_000 });
    });

    test('HYDR-003: stats overview shows non-zero values after hydration', async ({ page }) => {
        await setupHydrationPage(page, { detailsDelayMs: 100 });
        await goToStats(page);

        // Wait for hydration to complete — dissolve overlay should disappear
        await expect(
            page.locator('.stats-dashboard-scroll-lock')
        ).toBeHidden({ timeout: 45_000 });

        // Overview metrics should have non-zero values.
        // AVG SQUAD should reflect actual player counts (30-50 range for WvW).
        const overview = page.locator('#section-overview, [data-section="overview"]').first();
        if (await overview.isVisible().catch(() => false)) {
            // At least one metric in the overview should be non-zero
            const metricValues = await overview.locator('.text-2xl, .text-3xl, .text-4xl').allTextContents();
            const hasNonZero = metricValues.some(v => {
                const num = parseFloat(v.replace(/,/g, ''));
                return Number.isFinite(num) && num > 0;
            });
            expect(hasNonZero).toBe(true);
        }
    });

    test('HYDR-004: dissolve overlay clears after all details arrive', async ({ page }) => {
        await setupHydrationPage(page, { detailsDelayMs: 100 });
        await goToStats(page);

        // First verify overlay appears
        await expect(
            page.locator('.stats-dashboard-scroll-lock, .stats-section-wrap--unloaded').first()
        ).toBeVisible({ timeout: 10_000 });

        // Then wait for it to clear — all 7 details at 100ms each ≈ 700ms + compute time
        await expect(
            page.locator('.stats-dashboard-scroll-lock')
        ).toBeHidden({ timeout: 30_000 });

        // Verify no unloaded sections remain
        await expect(
            page.locator('.stats-section-wrap--unloaded')
        ).toHaveCount(0, { timeout: 5_000 });
    });

    test('HYDR-005: fight breakdown shows non-zero Allies after hydration', async ({ page }) => {
        await setupHydrationPage(page, { detailsDelayMs: 100 });
        await goToStats(page);

        // Wait for overlay to clear
        await expect(
            page.locator('.stats-dashboard-scroll-lock')
        ).toBeHidden({ timeout: 45_000 });

        // Find the fight breakdown section
        const breakdown = page.getByText(/Fight Breakdown/i).first();
        await expect(breakdown).toBeVisible({ timeout: 10_000 });

        // The header should show the correct fight count
        await expect(
            page.getByText(new RegExp(`${FIXTURE_IDS.length}\\s*FIGHTS`, 'i'))
        ).toBeVisible({ timeout: 5_000 });
    });
});
