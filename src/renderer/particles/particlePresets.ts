export interface ParticlePreset {
    origin: 'center' | 'left' | 'right' | 'top' | 'edges' | { x: number; y: number };
    direction: 'out' | 'in';
    count: number;
    spread: number;
    duration: number;
    size: [number, number];
    glow?: boolean;
}

export const PRESETS = {
    logArrival: { origin: 'right', direction: 'out', count: 22, spread: 180, duration: 1000, size: [3, 7], glow: true },
    uploadSnap: { origin: 'edges', direction: 'in', count: 18, spread: 100, duration: 550, size: [3, 6], glow: true },
    statusBadgePuff: { origin: 'center', direction: 'out', count: 8, spread: 30, duration: 400, size: [2, 4], glow: true },
    discordSent: { origin: 'center', direction: 'out', count: 14, spread: 60, duration: 500, size: [3, 5], glow: true },
    statsSectionAppear: { origin: 'top', direction: 'out', count: 6, spread: 25, duration: 400, size: [1.5, 3] },
    logRemoval: { origin: 'center', direction: 'out', count: 16, spread: 120, duration: 550, size: [3, 6], glow: true },
    bulkUploadComplete: { origin: 'top', direction: 'out', count: 24, spread: 150, duration: 700, size: [2, 5], glow: true },
    tabTransition: { origin: 'edges', direction: 'out', count: 8, spread: 40, duration: 350, size: [1.5, 3] },
} as const satisfies Record<string, ParticlePreset>;
