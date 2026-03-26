import { test, expect } from '@playwright/test';
import { setupAppPage } from './helpers/appTestHelpers';

function makeMockLog(overrides: Record<string, unknown> = {}) {
    return {
        id: overrides.id ?? 'log-1',
        filePath: overrides.filePath ?? '/fake/logs/20260320-180000.zevtc',
        fileName: overrides.fileName ?? '20260320-180000.zevtc',
        fightName: overrides.fightName ?? 'Alpine Borderlands',
        permalink: overrides.permalink ?? 'https://dps.report/abc123',
        uploadTime: overrides.uploadTime ?? new Date().toISOString(),
        encounterDuration: overrides.encounterDuration ?? 180,
        status: overrides.status ?? 'success',
        error: overrides.error ?? null,
        squadDisplayCount: overrides.squadDisplayCount ?? 25,
        nonSquadDisplayCount: overrides.nonSquadDisplayCount ?? 30,
        details: overrides.details ?? null,
        summary: overrides.summary ?? {
            damage: 1500000, downs: 12, healing: 500000, barrier: 200000,
            cleanses: 150, strips: 80, cc: 4500, stability: 3200,
        },
        ...overrides,
    };
}

test.describe('Dashboard — Log Card Display (DASH-001–011)', () => {
    test('DASH-001: empty state when no logs', async ({ page }) => {
        await setupAppPage(page, { logs: [] });
        const cards = page.locator('.matte-log-card');
        await expect(cards).toHaveCount(0);
    });

    test('DASH-002: log card renders fight name', async ({ page }) => {
        await setupAppPage(page, { logs: [makeMockLog({ fightName: 'Alpine Borderlands' })] });
        await expect(page.getByText('Alpine Borderlands')).toBeVisible({ timeout: 5000 });
    });

    test('DASH-003: log card shows squad count', async ({ page }) => {
        await setupAppPage(page, { logs: [makeMockLog({ squadDisplayCount: 25 })] });
        await expect(page.getByText(/25/)).toBeVisible({ timeout: 5000 });
    });

    test('DASH-004: log card shows relative time', async ({ page }) => {
        await setupAppPage(page, { logs: [makeMockLog({ uploadTime: new Date().toISOString() })] });
        await expect(page.getByText(/just now|ago|sec/i)).toBeVisible({ timeout: 5000 });
    });

    test('DASH-006: multiple log cards render', async ({ page }) => {
        const logs = Array.from({ length: 5 }, (_, i) =>
            makeMockLog({ id: `log-${i}`, fightName: `Fight ${i + 1}` })
        );
        await setupAppPage(page, { logs });
        for (let i = 1; i <= 5; i++) {
            await expect(page.getByText(`Fight ${i}`)).toBeVisible({ timeout: 5000 });
        }
    });

    test('DASH-007: queued status indicator', async ({ page }) => {
        await setupAppPage(page, { logs: [makeMockLog({ status: 'queued', permalink: null })] });
        await expect(page.getByText(/Queued/i)).toBeVisible({ timeout: 5000 });
    });

    test('DASH-008: uploading status indicator', async ({ page }) => {
        await setupAppPage(page, { logs: [makeMockLog({ status: 'uploading', permalink: null })] });
        await expect(page.getByText(/Parsing|Uploading/i)).toBeVisible({ timeout: 5000 });
    });

    test('DASH-009: success status shows fight name', async ({ page }) => {
        await setupAppPage(page, { logs: [makeMockLog({ status: 'success' })] });
        await expect(page.getByText('Alpine Borderlands')).toBeVisible({ timeout: 5000 });
    });

    test('DASH-010: error status indicator', async ({ page }) => {
        await setupAppPage(page, {
            logs: [makeMockLog({ status: 'error', error: 'Upload failed: server error', permalink: null })],
        });
        await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 });
    });

    test('DASH-011: retrying status indicator', async ({ page }) => {
        await setupAppPage(page, { logs: [makeMockLog({ status: 'retrying', permalink: null })] });
        await expect(page.getByText(/Retrying/i)).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Dashboard — Log Card Interactions (DASH-020–021)', () => {
    test('DASH-020: click log card to expand', async ({ page }) => {
        await setupAppPage(page, { logs: [makeMockLog()] });
        const card = page.getByText('Alpine Borderlands').first();
        await card.click();
        await page.waitForTimeout(500);
    });

    test('DASH-021: click expanded card to collapse', async ({ page }) => {
        await setupAppPage(page, { logs: [makeMockLog()] });
        const card = page.getByText('Alpine Borderlands').first();
        await card.click();
        await page.waitForTimeout(300);
        await card.click();
        await page.waitForTimeout(300);
    });
});
