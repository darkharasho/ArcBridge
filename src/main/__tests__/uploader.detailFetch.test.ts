import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { Uploader } from '../uploader';

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

type MockedAxios = {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
};

describe('Uploader detailed JSON fetch', () => {
    const mockedAxios = axios as unknown as MockedAxios;

    beforeEach(() => {
        mockedAxios.get.mockReset();
        mockedAxios.post.mockReset();
    });

    it('deduplicates concurrent requests for the same permalink', async () => {
        const uploader = new Uploader();
        (uploader as any).getDetailFetchBackoffMs = () => 0;

        let resolveRequest: (value: { status: number; data: string }) => void = () => undefined;
        mockedAxios.get.mockImplementation(() => new Promise<{ status: number; data: string }>((resolve) => {
            resolveRequest = resolve;
        }));

        const first = uploader.fetchDetailedJson('https://dps.report/abcd-1234');
        const second = uploader.fetchDetailedJson('https://dps.report/abcd-1234');

        expect(mockedAxios.get).toHaveBeenCalledTimes(1);

        resolveRequest({
            status: 200,
            data: JSON.stringify({ players: [] })
        });

        const [firstResult, secondResult] = await Promise.all([first, second]);
        expect(firstResult).toEqual({ players: [] });
        expect(secondResult).toEqual({ players: [] });
    });

    it('caches terminal parse failures to avoid repeated heavy retries', async () => {
        const uploader = new Uploader();
        (uploader as any).getDetailFetchBackoffMs = () => 0;

        mockedAxios.get.mockResolvedValue({
            status: 200,
            data: '{"eliteInsightsVersion":"3.18.1.0"'
        });

        const first = await uploader.fetchDetailedJson('https://dps.report/broken-5678');
        const firstError = String((first as any)?.error || '');
        expect(['incomplete-json', 'invalid-json']).toContain(firstError);
        expect(mockedAxios.get).toHaveBeenCalledTimes(4);

        mockedAxios.get.mockClear();

        const second = await uploader.fetchDetailedJson('https://dps.report/broken-5678');
        expect(second).toMatchObject({ error: firstError, cached: true });
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });
});
