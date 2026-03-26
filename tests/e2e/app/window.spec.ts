import { test, expect } from '@playwright/test';
import { setupAppPage } from './helpers/appTestHelpers';

test.describe('App Window (APP-001, APP-006)', () => {
    test('APP-001: app renders successfully', async ({ page }) => {
        await setupAppPage(page);
        await expect(page.locator('.app-titlebar')).toBeVisible();
        await expect(page.locator('.matte-dashboard-shell, .dashboard-view').first()).toBeVisible();
    });

    test('APP-006: custom titlebar renders', async ({ page }) => {
        await setupAppPage(page);
        await expect(page.locator('.app-titlebar')).toBeVisible();
    });
});
