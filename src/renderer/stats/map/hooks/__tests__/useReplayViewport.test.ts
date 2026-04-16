import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReplayViewport } from '../useReplayViewport';
import { useStatsStore } from '../../../statsStore';

describe('useReplayViewport', () => {
    beforeEach(() => {
        const initial = (useStatsStore as any).getInitialState();
        useStatsStore.setState(initial);
    });

    it('starts at scale 1 with no translation', () => {
        const { result } = renderHook(() => useReplayViewport({ mapWidth: 600, mapHeight: 600, containerWidth: 600, containerHeight: 600 }));
        expect(result.current.scale).toBe(1);
        expect(result.current.tx).toBe(0);
        expect(result.current.ty).toBe(0);
    });

    it('zoomIn and zoomOut update scale in geometric steps', () => {
        const { result } = renderHook(() => useReplayViewport({ mapWidth: 600, mapHeight: 600, containerWidth: 600, containerHeight: 600 }));
        act(() => result.current.zoomIn());
        expect(result.current.scale).toBeGreaterThan(1);
        const s = result.current.scale;
        act(() => result.current.zoomOut());
        expect(result.current.scale).toBeLessThan(s);
    });

    it('resetViewport restores defaults', () => {
        const { result } = renderHook(() => useReplayViewport({ mapWidth: 600, mapHeight: 600, containerWidth: 600, containerHeight: 600 }));
        act(() => result.current.zoomIn());
        act(() => result.current.panBy(30, 40));
        act(() => result.current.resetViewport());
        expect(result.current.scale).toBe(1);
        expect(result.current.tx).toBe(0);
        expect(result.current.ty).toBe(0);
    });
});
