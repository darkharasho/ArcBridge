import React, { useRef, useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useStatsStore } from '../statsStore';

const SQUAD_TOGGLES: { key: 'centroidSpread' | 'tagRangeRings' | 'squadHealthStrip' | 'partyHulls' | 'allPartiesPanel'; label: string }[] = [
    { key: 'centroidSpread', label: 'Centroid + spread ring' },
    { key: 'tagRangeRings', label: 'Tag range rings (600 / 1200)' },
    { key: 'squadHealthStrip', label: 'Squad health strip' },
    { key: 'partyHulls', label: 'Per-party hulls' },
    { key: 'allPartiesPanel', label: 'All-parties panel' },
];

const EVENT_TOGGLES: { key: 'phases' | 'rallyRings' | 'targetFocusLines' | 'damagePulses'; label: string }[] = [
    { key: 'phases', label: 'Fight phases on timeline' },
    { key: 'rallyRings', label: 'Rally rings' },
    { key: 'targetFocusLines', label: 'Target-focus lines' },
    { key: 'damagePulses', label: 'Damage pulses' },
];

const HEATMAP_OPTIONS: { value: 'off' | 'deaths' | 'time' | 'damage-taken'; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'deaths', label: 'Deaths' },
    { value: 'time', label: 'Time spent' },
    { value: 'damage-taken', label: 'Damage taken' },
];

export const LayersPopover: React.FC = () => {
    const layers = useStatsStore(state => state.replayLayers);
    const setReplayLayer = useStatsStore(state => state.setReplayLayer);
    const setReplayHeatmapMode = useStatsStore(state => state.setReplayHeatmapMode);
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
        <div ref={panelRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setOpen(v => !v)}
                    title="Layers"
                    aria-label="Layers"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Settings size={14} /> Layers
            </button>
            {open && (
                <div role="dialog" aria-label="Layers"
                     style={{
                         position: 'absolute', right: 0, bottom: '100%', marginBottom: 6,
                         background: 'rgba(12, 18, 36, 0.98)',
                         border: '1px solid rgba(255,255,255,0.1)',
                         borderRadius: 8, padding: 12, minWidth: 240, zIndex: 50,
                     }}>
                    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Squad overlay</div>
                    {SQUAD_TOGGLES.map(t => (
                        <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0' }}>
                            <input type="checkbox"
                                   checked={layers[t.key]}
                                   onChange={e => setReplayLayer(t.key, e.currentTarget.checked)} />
                            <span>{t.label}</span>
                        </label>
                    ))}
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, marginBottom: 4 }}>Events</div>
                    {EVENT_TOGGLES.map(t => (
                        <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0' }}>
                            <input type="checkbox"
                                   checked={layers[t.key]}
                                   onChange={e => setReplayLayer(t.key, e.currentTarget.checked)} />
                            <span>{t.label}</span>
                        </label>
                    ))}
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, marginBottom: 4 }}>Heatmap</div>
                    {HEATMAP_OPTIONS.map(opt => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0' }}>
                            <input type="radio" name="heatmap"
                                   value={opt.value}
                                   checked={layers.heatmap === opt.value}
                                   onChange={() => setReplayHeatmapMode(opt.value)} />
                            <span>{opt.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LayersPopover;
