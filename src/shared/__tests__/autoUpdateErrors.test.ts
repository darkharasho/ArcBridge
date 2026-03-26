import { describe, expect, it } from 'vitest';
import {
    extractAutoUpdateErrorMessage,
    formatAutoUpdateErrorMessage,
    isRetryableAutoUpdateError,
} from '../autoUpdateErrors';

describe('autoUpdateErrors', () => {
    it('detects retryable http2 refused stream errors', () => {
        const err = { message: 'net::ERR_HTTP2_SERVER_REFUSED_STREAM' };

        expect(isRetryableAutoUpdateError(err)).toBe(true);
        expect(formatAutoUpdateErrorMessage(err)).toBe('The update server temporarily refused the download stream. Please try again in a moment.');
    });

    it('detects retryable timeout errors', () => {
        const err = new Error('Update check timed out after 30s');

        expect(isRetryableAutoUpdateError(err)).toBe(true);
        expect(formatAutoUpdateErrorMessage(err)).toBe('The update check timed out before the server responded. Please try again.');
    });

    it('detects retryable github 504 feed errors and hides html payloads', () => {
        const err = {
            message: 'Error: 504 "method: GET url: https://github.com/darkharasho/axibridge/releases.atom\\n\\n Data:\\n <!DOCTYPE html><html>..."'
        };

        expect(isRetryableAutoUpdateError(err)).toBe(true);
        expect(formatAutoUpdateErrorMessage(err)).toBe('GitHub temporarily failed to respond to the update check. Please try again in a moment.');
    });

    it('falls back to the raw message for unknown errors', () => {
        const err = new Error('Unexpected updater failure');

        expect(extractAutoUpdateErrorMessage(err)).toBe('Unexpected updater failure');
        expect(isRetryableAutoUpdateError(err)).toBe(false);
        expect(formatAutoUpdateErrorMessage(err)).toBe('Unexpected updater failure');
    });

    it('strips embedded data payloads from unknown errors', () => {
        const err = {
            message: 'Unexpected updater failure\\n\\nData:\\n<html>nope</html>'
        };

        expect(formatAutoUpdateErrorMessage(err)).toBe('Unexpected updater failure');
    });
});
