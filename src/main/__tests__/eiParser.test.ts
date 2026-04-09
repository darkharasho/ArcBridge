import { describe, it, expect } from 'vitest';
import { generateEiConf, DEFAULT_EI_SETTINGS, isNewerVersion } from '../eiParser';

describe('generateEiConf', () => {
    it('generates valid conf with default settings', () => {
        const conf = generateEiConf(DEFAULT_EI_SETTINGS, '/tmp/ei-output');
        expect(conf).toContain('SaveOutJSON=True');
        expect(conf).toContain('SaveOutHTML=False');
        expect(conf).toContain('DetailledWvW=True');
        expect(conf).toContain('OutLocation=/tmp/ei-output');
        expect(conf).toContain('CompressRaw=True');
        expect(conf).toContain('UploadToDPSReports=False');
        expect(conf).toContain('UploadToWingman=False');
        expect(conf).toContain('SaveAtOut=False');
    });

    it('reflects custom settings', () => {
        const settings = { ...DEFAULT_EI_SETTINGS, detailledWvW: false, saveOutHTML: true, memoryLimit: 4096 };
        const conf = generateEiConf(settings, '/tmp/out');
        expect(conf).toContain('DetailledWvW=False');
        expect(conf).toContain('SaveOutHTML=True');
        expect(conf).toContain('MemoryLimit=4096');
    });

    it('uses SaveAtOut=False and custom OutLocation', () => {
        const conf = generateEiConf(DEFAULT_EI_SETTINGS, '/my/output/dir');
        expect(conf).toContain('SaveAtOut=False');
        expect(conf).toContain('OutLocation=/my/output/dir');
    });
});

describe('isNewerVersion', () => {
    it('detects newer version', () => {
        expect(isNewerVersion('v3.20.0.0', 'v3.21.0.0')).toBe(true);
    });

    it('returns false for same version', () => {
        expect(isNewerVersion('v3.20.0.0', 'v3.20.0.0')).toBe(false);
    });

    it('returns false for older version', () => {
        expect(isNewerVersion('v3.21.0.0', 'v3.20.0.0')).toBe(false);
    });

    it('handles missing v prefix', () => {
        expect(isNewerVersion('3.20.0.0', '3.21.0.0')).toBe(true);
    });
});
