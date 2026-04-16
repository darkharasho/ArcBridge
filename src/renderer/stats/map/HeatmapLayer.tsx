import React, { useEffect, useRef } from 'react';
import type { HeatmapRaster } from './hooks/useHeatmapData';

interface HeatmapLayerProps {
    raster: HeatmapRaster | null;
    mapWidth: number;
    mapHeight: number;
    mode: 'off' | 'deaths' | 'time' | 'damage-taken';
}

function colorForMode(mode: HeatmapLayerProps['mode']): [number, number, number] {
    switch (mode) {
        case 'deaths':        return [239, 68, 68];
        case 'time':          return [34, 211, 238];
        case 'damage-taken':  return [249, 115, 22];
        default:              return [0, 0, 0]; // 'off' mode — unreachable when component renders (raster is null)
    }
}

export const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ raster, mapWidth, mapHeight, mode }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!raster) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        const [gw, gh] = raster.size;
        canvas.width = gw;
        canvas.height = gh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = ctx.createImageData(gw, gh);
        const [r, g, b] = colorForMode(mode);
        const max = raster.max || 1;
        for (let i = 0; i < raster.buffer.length; i++) {
            const v = raster.buffer[i] / max;
            const alpha = Math.min(255, Math.round(v * 210));
            const offset = i * 4;
            img.data[offset] = r;
            img.data[offset + 1] = g;
            img.data[offset + 2] = b;
            img.data[offset + 3] = alpha;
        }
        ctx.putImageData(img, 0, 0);
    }, [raster, mode]);

    if (!raster) return null;

    return (
        <foreignObject x={0} y={0} width={mapWidth} height={mapHeight}>
            <canvas
                ref={canvasRef}
                style={{
                    width: `${mapWidth}px`,
                    height: `${mapHeight}px`,
                    imageRendering: 'auto',
                    filter: 'blur(6px)',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                    opacity: 0.75,
                }}
            />
        </foreignObject>
    );
};

export default HeatmapLayer;
