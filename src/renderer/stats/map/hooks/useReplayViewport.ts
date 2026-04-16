import { useCallback } from 'react';
import { useStatsStore } from '../../statsStore';

interface UseReplayViewportArgs {
    mapWidth: number;
    mapHeight: number;
    containerWidth: number;
    containerHeight: number;
}

const ZOOM_STEP = 0.15;
const MIN_SCALE = 1;
const MAX_SCALE = 50;

export function useReplayViewport({ mapWidth, mapHeight, containerWidth, containerHeight }: UseReplayViewportArgs) {
    const replayViewport = useStatsStore(state => state.replayViewport);
    const setReplayViewport = useStatsStore(state => state.setReplayViewport);
    const resetReplayViewport = useStatsStore(state => state.resetReplayViewport);

    const zoomIn = useCallback(() => {
        const { replayViewport: prev } = useStatsStore.getState();
        setReplayViewport({ scale: Math.min(prev.scale * (1 + ZOOM_STEP * 2), MAX_SCALE) });
    }, [setReplayViewport]);

    const zoomOut = useCallback(() => {
        const { replayViewport: prev } = useStatsStore.getState();
        setReplayViewport({ scale: Math.max(prev.scale * (1 - ZOOM_STEP * 2), MIN_SCALE) });
    }, [setReplayViewport]);

    const panBy = useCallback((dx: number, dy: number) => {
        const { replayViewport: prev } = useStatsStore.getState();
        setReplayViewport({ tx: prev.tx + dx, ty: prev.ty + dy });
    }, [setReplayViewport]);

    const resetViewport = useCallback(() => { resetReplayViewport(); }, [resetReplayViewport]);

    const centerOn = useCallback((x: number, y: number) => {
        const { replayViewport: prev } = useStatsStore.getState();
        setReplayViewport({
            tx: containerWidth / 2 - x * prev.scale,
            ty: containerHeight / 2 - y * prev.scale,
        });
    }, [containerWidth, containerHeight, setReplayViewport]);

    const attachWheelZoom = useCallback((el: Element): (() => void) => {
        const handler = (e: Event) => {
            const we = e as WheelEvent;
            we.preventDefault();
            const { replayViewport: prev } = useStatsStore.getState();
            const rect = el.getBoundingClientRect();
            const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE,
                prev.scale * (1 - Math.sign(we.deltaY) * ZOOM_STEP)
            ));
            if (next === prev.scale) return;
            const ratio = next / prev.scale;
            // Convert screen cursor position to SVG viewBox coordinates
            const svgX = ((we.clientX - rect.left) / rect.width) * mapWidth;
            const svgY = ((we.clientY - rect.top) / rect.height) * mapHeight;
            setReplayViewport({
                scale: next,
                tx: svgX * (1 - ratio) + ratio * prev.tx,
                ty: svgY * (1 - ratio) + ratio * prev.ty,
            });
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, [mapWidth, mapHeight, setReplayViewport]);

    return {
        scale: replayViewport.scale,
        tx: replayViewport.tx,
        ty: replayViewport.ty,
        zoomIn,
        zoomOut,
        panBy,
        resetViewport,
        centerOn,
        attachWheelZoom,
        mapWidth,
        mapHeight,
    };
}
