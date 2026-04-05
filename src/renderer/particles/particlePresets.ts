export interface ParticlePreset {
    origin: 'center' | 'left' | 'right' | 'top' | 'edges' | 'surface' | { x: number; y: number };
    direction: 'out' | 'in';
    count: number;
    spread: number;
    duration: number;
    size: [number, number];
    glow?: boolean;
    color?: string;
}

export const PRESETS = {
    logArrival: { origin: 'right', direction: 'out', count: 20, spread: 130, duration: 1200, size: [2, 5], glow: true },
    uploadSuccess: { origin: 'right', direction: 'out', count: 20, spread: 130, duration: 1200, size: [2, 5], glow: true, color: '#4ade80' },
    statusBadgePuff: { origin: 'center', direction: 'out', count: 14, spread: 80, duration: 1200, size: [3, 6], glow: true },
    discordSent: { origin: 'right', direction: 'out', count: 20, spread: 130, duration: 1200, size: [2, 5], glow: true, color: '#a78bfa' },
    statsSectionAppear: { origin: 'top', direction: 'out', count: 12, spread: 80, duration: 1200, size: [3, 6], glow: true },
    logRemoval: { origin: 'surface', direction: 'out', count: 40, spread: 350, duration: 1400, size: [3, 7], glow: true },
    bulkUploadComplete: { origin: 'top', direction: 'out', count: 30, spread: 300, duration: 1600, size: [4, 8], glow: true },
    tabTransition: { origin: 'edges', direction: 'out', count: 30, spread: 400, duration: 1200, size: [3, 7], glow: true },
} as const satisfies Record<string, ParticlePreset>;
