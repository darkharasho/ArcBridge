import React, { useEffect, useRef } from 'react';
import type { HeatmapRaster } from './hooks/useHeatmapData';

interface HeatmapLayerProps {
    raster: HeatmapRaster | null;
    mapWidth: number;
    mapHeight: number;
    mode: 'off' | 'deaths' | 'time' | 'damage-taken';
}

/** Multi-stop RGBA colormap — each stop is [t, r, g, b, a] where t ∈ [0,1]. */
type ColorStop = [number, number, number, number, number];

const COLORMAPS: Record<string, ColorStop[]> = {
    deaths: [
        [0.00,   0,   0,   0,   0],
        [0.20,  80,   0,   0, 160],
        [0.45, 220,  20,  20, 210],
        [0.70, 255, 120,   0, 235],
        [0.88, 255, 220,  40, 245],
        [1.00, 255, 255, 255, 255],
    ],
    time: [
        [0.00,   0,   0,   0,   0],
        [0.20,   0,  30, 100, 160],
        [0.45,   0, 160, 200, 210],
        [0.70,  40, 230, 220, 235],
        [0.88, 180, 255, 255, 245],
        [1.00, 255, 255, 255, 255],
    ],
    'damage-taken': [
        [0.00,   0,   0,   0,   0],
        [0.20,  60,   0, 100, 160],
        [0.45, 180,  20, 180, 210],
        [0.70, 255, 100,  20, 235],
        [0.88, 255, 220,  80, 245],
        [1.00, 255, 255, 255, 255],
    ],
};

function sampleColormap(stops: ColorStop[], t: number): [number, number, number, number] {
    if (t <= 0) return [stops[0][1], stops[0][2], stops[0][3], stops[0][4]];
    if (t >= 1) {
        const last = stops[stops.length - 1];
        return [last[1], last[2], last[3], last[4]];
    }
    for (let i = 1; i < stops.length; i++) {
        const [t1, r1, g1, b1, a1] = stops[i];
        const [t0, r0, g0, b0, a0] = stops[i - 1];
        if (t <= t1) {
            const f = (t - t0) / (t1 - t0);
            return [
                Math.round(r0 + (r1 - r0) * f),
                Math.round(g0 + (g1 - g0) * f),
                Math.round(b0 + (b1 - b0) * f),
                Math.round(a0 + (a1 - a0) * f),
            ];
        }
    }
    const last = stops[stops.length - 1];
    return [last[1], last[2], last[3], last[4]];
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
        const stops = COLORMAPS[mode] ?? COLORMAPS['deaths'];
        const max = raster.max || 1;
        for (let i = 0; i < raster.buffer.length; i++) {
            // sqrt curve: spreads mid-range values upward so low-density areas read clearly
            const t = Math.sqrt(raster.buffer[i] / max);
            const [r, g, b, a] = sampleColormap(stops, t);
            const offset = i * 4;
            img.data[offset]     = r;
            img.data[offset + 1] = g;
            img.data[offset + 2] = b;
            img.data[offset + 3] = a;
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
                    filter: 'blur(8px)',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                }}
            />
        </foreignObject>
    );
};

export default HeatmapLayer;
