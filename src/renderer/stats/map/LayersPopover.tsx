import React from 'react';
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

interface LayersPanelProps {
    open: boolean;
    onToggle: () => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({ open, onToggle }) => {
    const layers = useStatsStore(state => state.replayLayers);
    const setReplayLayer = useStatsStore(state => state.setReplayLayer);
    const setReplayHeatmapMode = useStatsStore(state => state.setReplayHeatmapMode);

    if (!open) {
        return (
            <button
                type="button"
                title="Show layers"
                onClick={onToggle}
                style={{
                    width: 28, flexShrink: 0,
                    background: 'var(--bg-elevated)',
                    borderRight: '1px solid var(--border-default)',
                    border: 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    paddingTop: 8, cursor: 'pointer',
                }}
            >
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>▶</span>
                <span style={{ writingMode: 'vertical-rl', fontSize: 9, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 7, transform: 'rotate(180deg)' }}>
                    Layers
                </span>
            </button>
        );
    }

    return (
        <div style={{
            width: 220, flexShrink: 0,
            background: 'var(--bg-elevated)',
            borderRight: '1px solid var(--border-default)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
            <div style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Layers</span>
                <button
                    type="button"
                    title="Collapse layers panel"
                    onClick={onToggle}
                    style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 3, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    ◀
                </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Squad overlay</div>
                {SQUAD_TOGGLES.map(t => (
                    <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-primary)', padding: '3px 0', cursor: 'pointer' }}>
                        <input type="checkbox"
                               checked={layers[t.key]}
                               onChange={e => setReplayLayer(t.key, e.currentTarget.checked)} />
                        <span>{t.label}</span>
                    </label>
                ))}
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 12, marginBottom: 6 }}>Events</div>
                {EVENT_TOGGLES.map(t => (
                    <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-primary)', padding: '3px 0', cursor: 'pointer' }}>
                        <input type="checkbox"
                               checked={layers[t.key]}
                               onChange={e => setReplayLayer(t.key, e.currentTarget.checked)} />
                        <span>{t.label}</span>
                    </label>
                ))}
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 12, marginBottom: 6 }}>Heatmap</div>
                {HEATMAP_OPTIONS.map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-primary)', padding: '3px 0', cursor: 'pointer' }}>
                        <input type="radio" name="replay-heatmap"
                               value={opt.value}
                               checked={layers.heatmap === opt.value}
                               onChange={() => setReplayHeatmapMode(opt.value)} />
                        <span>{opt.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

export default LayersPanel;
