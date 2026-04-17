import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    const [popoverPos, setPopoverPos] = useState<{ bottom: number; right: number } | null>(null);
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const openPopover = useCallback(() => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        setPopoverPos({
            bottom: window.innerHeight - rect.top + 6,
            right: window.innerWidth - rect.right,
        });
        setOpen(true);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                popoverRef.current && !popoverRef.current.contains(target) &&
                btnRef.current && !btnRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={() => open ? setOpen(false) : openPopover()}
                title="Layers"
                aria-label="Layers"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
                <Settings size={14} /> Layers
            </button>
            {open && popoverPos && createPortal(
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-label="Layers"
                    style={{
                        position: 'fixed',
                        bottom: popoverPos.bottom,
                        right: popoverPos.right,
                        background: 'rgba(12, 18, 36, 0.98)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, padding: 12, minWidth: 240, zIndex: 9999,
                    }}
                >
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
                </div>,
                document.body
            )}
        </>
    );
};

export default LayersPopover;
