export interface ParticlePreset {
    origin: 'center' | 'left' | 'top' | 'edges' | { x: number; y: number };
    direction: 'out' | 'in';
    count: number;
    spread: number;
    duration: number;
    size: [number, number];
    glow?: boolean;
}

export const PRESETS = {
    logArrival: { origin: 'left', direction: 'out', count: 18, spread: 130, duration: 600, size: [2, 5], glow: true },
    uploadSnap: { origin: 'edges', direction: 'in', count: 14, spread: 80, duration: 500, size: [2, 4], glow: true },
    statusBadgePuff: { origin: 'center', direction: 'out', count: 5, spread: 20, duration: 350, size: [1.5, 3] },
    discordSent: { origin: 'center', direction: 'out', count: 10, spread: 50, duration: 450, size: [2, 4], glow: true },
    statsSectionAppear: { origin: 'top', direction: 'out', count: 6, spread: 25, duration: 400, size: [1.5, 3] },
    logRemoval: { origin: 'center', direction: 'out', count: 12, spread: 100, duration: 500, size: [2, 4], glow: true },
    bulkUploadComplete: { origin: 'top', direction: 'out', count: 24, spread: 150, duration: 700, size: [2, 5], glow: true },
    tabTransition: { origin: 'edges', direction: 'out', count: 8, spread: 40, duration: 350, size: [1.5, 3] },
} as const satisfies Record<string, ParticlePreset>;
