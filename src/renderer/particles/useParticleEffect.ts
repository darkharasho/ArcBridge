import { useState, useCallback, type ReactNode, createElement } from 'react';
import { ParticleEmitter } from './ParticleEmitter';
import type { ParticlePreset } from './particlePresets';

export function useParticleEffect() {
    const [emitterKey, setEmitterKey] = useState(0);
    const [activePreset, setActivePreset] = useState<ParticlePreset | null>(null);

    const trigger = useCallback((preset: ParticlePreset) => {
        setActivePreset(preset);
        setEmitterKey(k => k + 1);
    }, []);

    const handleComplete = useCallback(() => {
        setActivePreset(null);
    }, []);

    const emitterNode: ReactNode = activePreset
        ? createElement(ParticleEmitter, {
            key: emitterKey,
            ...activePreset,
            onComplete: handleComplete,
        })
        : null;

    return { emitterNode, trigger };
}
