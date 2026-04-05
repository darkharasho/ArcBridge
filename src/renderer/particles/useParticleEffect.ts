import { useState, useCallback, useEffect, type ReactNode, createElement } from 'react';
import { ParticleEmitter } from './ParticleEmitter';
import type { ParticlePreset } from './particlePresets';

let activeEmitterCount = 0;
const MAX_ACTIVE_EMITTERS = 5;

export function useParticleEffect() {
    const [emitterKey, setEmitterKey] = useState(0);
    const [activePreset, setActivePreset] = useState<ParticlePreset | null>(null);

    const trigger = useCallback((preset: ParticlePreset) => {
        if (activeEmitterCount >= MAX_ACTIVE_EMITTERS) return;
        activeEmitterCount++;
        setActivePreset(preset);
        setEmitterKey(k => k + 1);
    }, []);

    const handleComplete = useCallback(() => {
        activeEmitterCount = Math.max(0, activeEmitterCount - 1);
        setActivePreset(null);
    }, []);

    useEffect(() => {
        return () => {
            if (activePreset) {
                activeEmitterCount = Math.max(0, activeEmitterCount - 1);
            }
        };
    }, [activePreset]);

    const emitterNode: ReactNode = activePreset
        ? createElement(ParticleEmitter, {
            key: emitterKey,
            ...activePreset,
            onComplete: handleComplete,
        })
        : null;

    return { emitterNode, trigger };
}
