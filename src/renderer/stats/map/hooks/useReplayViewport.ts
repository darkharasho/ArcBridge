import { useCallback } from 'react';
import { useStatsStore } from '../../statsStore';

interface UseReplayViewportArgs {
    mapWidth: number;
    mapHeight: number;
    containerWidth: number;
    containerHeight: number;
}

const ZOOM_STEP = 1.25;
const MIN_SCALE = 0.5;
const MAX_SCALE = 8;

export function useReplayViewport({ mapWidth, mapHeight, containerWidth, containerHeight }: UseReplayViewportArgs) {
    const replayViewport = useStatsStore(state => state.replayViewport);
    const setReplayViewport = useStatsStore(state => state.setReplayViewport);
    const resetReplayViewport = useStatsStore(state => state.resetReplayViewport);

    const zoomIn = useCallback(() => {
        setReplayViewport({ scale: Math.min(replayViewport.scale * ZOOM_STEP, MAX_SCALE) });
    }, [replayViewport.scale, setReplayViewport]);

    const zoomOut = useCallback(() => {
        setReplayViewport({ scale: Math.max(replayViewport.scale / ZOOM_STEP, MIN_SCALE) });
    }, [replayViewport.scale, setReplayViewport]);

    const panBy = useCallback((dx: number, dy: number) => {
        setReplayViewport({ tx: replayViewport.tx + dx, ty: replayViewport.ty + dy });
    }, [replayViewport.tx, replayViewport.ty, setReplayViewport]);

    const resetViewport = useCallback(() => { resetReplayViewport(); }, [resetReplayViewport]);

    const centerOn = useCallback((x: number, y: number) => {
        setReplayViewport({
            tx: containerWidth / 2 - x * replayViewport.scale,
            ty: containerHeight / 2 - y * replayViewport.scale,
        });
    }, [containerWidth, containerHeight, replayViewport.scale, setReplayViewport]);

    return {
        scale: replayViewport.scale,
        tx: replayViewport.tx,
        ty: replayViewport.ty,
        zoomIn,
        zoomOut,
        panBy,
        resetViewport,
        centerOn,
        mapWidth,
        mapHeight,
    };
}
