import { create } from 'zustand';
import type { AggregationProgressState, AggregationDiagnosticsState } from './hooks/useStatsAggregationWorker';

// Hash function moved from aggregationCache.ts — used by App.tsx store sync
export function hashAggregationSettings(mvpWeights: any, statsViewSettings: any, disruptionMethod: any): string {
    const key = JSON.stringify({ mvpWeights, statsViewSettings, disruptionMethod });
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

interface StatsStoreState {
    result: any | null;
    inputsHash: string | null;
    progress: AggregationProgressState;
    diagnostics: AggregationDiagnosticsState | null;
    groupHeights: Record<string, number>;
    activeNavGroup: string;
    selectedReplayFightId: string | null;
    replayPlayhead: { timeMs: number; playing: boolean; speed: number };
    replayViewport: { scale: number; tx: number; ty: number; followTarget: string | null };
    replaySelectedParty: number;

    setResult: (result: any, inputsHash: string) => void;
    setProgress: (progress: AggregationProgressState) => void;
    setDiagnostics: (diagnostics: AggregationDiagnosticsState | null) => void;
    setGroupHeight: (groupId: string, height: number) => void;
    setActiveNavGroup: (groupId: string) => void;
    clearResult: () => void;
    setSelectedReplayFight: (fightId: string | null) => void;
    setReplayPlayhead: (patch: Partial<{ timeMs: number; playing: boolean; speed: number }>) => void;
    setReplayViewport: (patch: Partial<{ scale: number; tx: number; ty: number }>) => void;
    setReplayFollowTarget: (target: string | null) => void;
    setReplaySelectedParty: (party: number) => void;
    resetReplayViewport: () => void;
}

const initialState = {
    result: null,
    inputsHash: null,
    progress: {
        active: false,
        phase: 'idle' as const,
        streamed: 0,
        total: 0,
        startedAt: 0,
        completedAt: 0,
    },
    diagnostics: null,
    groupHeights: {},
    activeNavGroup: 'overview',
    selectedReplayFightId: null,
    replayPlayhead: { timeMs: 0, playing: false, speed: 1 },
    replayViewport: { scale: 1, tx: 0, ty: 0, followTarget: null },
    replaySelectedParty: 0,
};

export const useStatsStore = create<StatsStoreState>()((set) => ({
    ...initialState,

    setResult: (result, inputsHash) => set({ result, inputsHash }),
    setProgress: (progress) => set({ progress }),
    setDiagnostics: (diagnostics) => set({ diagnostics }),
    setGroupHeight: (groupId, height) =>
        set((state) => {
            if (state.groupHeights[groupId] === height) return state;
            return { groupHeights: { ...state.groupHeights, [groupId]: height } };
        }),
    setActiveNavGroup: (groupId) => set({ activeNavGroup: groupId }),
    clearResult: () => set({ result: null, inputsHash: null }),
    setSelectedReplayFight: (fightId) => set((state) => ({
        selectedReplayFightId: fightId,
        replayPlayhead: { ...state.replayPlayhead, timeMs: 0, playing: false },
    })),
    setReplayPlayhead: (patch) => set((state) => ({
        replayPlayhead: { ...state.replayPlayhead, ...patch },
    })),
    setReplayViewport: (patch) => set((state) => ({
        replayViewport: { ...state.replayViewport, ...patch },
    })),
    setReplayFollowTarget: (target) => set((state) => ({
        replayViewport: { ...state.replayViewport, followTarget: target },
    })),
    setReplaySelectedParty: (party) => set({
        replaySelectedParty: Math.max(0, Math.min(5, Math.floor(Number.isFinite(party) ? party : 0))),
    }),
    resetReplayViewport: () => set((state) => ({
        replayViewport: { ...state.replayViewport, scale: 1, tx: 0, ty: 0 },
    })),
    getInitialState: () => initialState,
}));

// Attach getInitialState as a static method for test resets
(useStatsStore as any).getInitialState = () => initialState;
