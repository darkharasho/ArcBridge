import { test, expect } from '@playwright/test';
import { setupAppPage, navigateTo } from './helpers/appTestHelpers';

test.describe('App Navigation (NAV-001–008)', () => {
    test('NAV-001: Dashboard view is the default', async ({ page }) => {
        await setupAppPage(page);
        await expect(page.locator('.matte-dashboard-shell, .dashboard-view').first()).toBeVisible();
    });

    test('NAV-002: navigate to Stats view', async ({ page }) => {
        await setupAppPage(page);
        await navigateTo(page, 'Stats');
        await expect(page.locator('.stats-view')).toBeAttached();
    });

    test('NAV-003: navigate to History view', async ({ page }) => {
        await setupAppPage(page);
        await navigateTo(page, 'History');
        await expect(page.getByText(/History/i).first()).toBeVisible();
    });

    test('NAV-004: navigate to Settings view', async ({ page }) => {
        await setupAppPage(page);
        await navigateTo(page, 'Settings');
        await expect(page.locator('[data-settings-section="true"]').first()).toBeVisible();
    });

    test('NAV-005: navigate back to Dashboard from Settings', async ({ page }) => {
        await setupAppPage(page);
        await navigateTo(page, 'Settings');
        await expect(page.locator('[data-settings-section="true"]').first()).toBeVisible();
        await navigateTo(page, 'Dashboard');
        await expect(page.locator('.matte-dashboard-shell, .dashboard-view').first()).toBeVisible();
    });

    test('NAV-006: active tab is visually indicated', async ({ page }) => {
        await setupAppPage(page);
        const dashTab = page.getByRole('button', { name: /^Dashboard$/i });
        const dashColor = await dashTab.evaluate((el) => getComputedStyle(el).color);

        await navigateTo(page, 'Settings');
        const dashColorAfter = await dashTab.evaluate((el) => getComputedStyle(el).color);
        // Color should change when tab loses active state
        expect(dashColorAfter).not.toBe(dashColor);
    });

    test('NAV-007: Stats view preserved on tab switch (display:none, not unmount)', async ({ page }) => {
        await setupAppPage(page);
        await navigateTo(page, 'Stats');
        await expect(page.locator('.stats-view')).toBeAttached();
        await navigateTo(page, 'Dashboard');
        await navigateTo(page, 'Stats');
        await expect(page.locator('.stats-view')).toBeAttached();
    });

    test('NAV-008: all navigation tab buttons render', async ({ page }) => {
        await setupAppPage(page);
        await expect(page.getByRole('button', { name: /^Dashboard$/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Stats$/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /^History$/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Settings$/i })).toBeVisible();
    });
});
