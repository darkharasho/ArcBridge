import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMetricSectionState, type MetricItem, type PlayerRow } from '../stats/hooks/useMetricSectionState';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const METRICS: MetricItem[] = [
    { id: 'damage', label: 'Damage' },
    { id: 'cc', label: 'Crowd Control' },
    { id: 'breakbar', label: 'Breakbar Damage' },
];

const ROWS: PlayerRow[] = [
    { account: 'Alice.1234', profession: 'Guardian', professionList: ['Guardian'] },
    { account: 'Bob.5678', profession: 'Warrior', professionList: ['Warrior'] },
    { account: 'Alice.1234', profession: 'Guardian', professionList: ['Guardian'] }, // duplicate
];

const mockRenderIcon = vi.fn((profession: string | undefined) => (
    <span data-prof={profession} />
));

const defaultOptions = {
    metrics: METRICS,
    rows: ROWS,
    renderProfessionIcon: mockRenderIcon,
};

// ─── Initial state ────────────────────────────────────────────────────────────

describe('useMetricSectionState — initial state', () => {
    it('starts with sortState { key: value, dir: desc }', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        expect(result.current.sortState).toEqual({ key: 'value', dir: 'desc' });
    });

    it('uses metrics[0].id as default dense sort column', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        expect(result.current.denseSort.columnId).toBe('damage');
        expect(result.current.denseSort.dir).toBe('desc');
    });

    it('respects initialDenseSortColumnId option', () => {
        const { result } = renderHook(() =>
            useMetricSectionState({ ...defaultOptions, initialDenseSortColumnId: 'cc' })
        );
        expect(result.current.denseSort.columnId).toBe('cc');
    });

    it('starts with empty column and player selections', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        expect(result.current.selectedColumnIds).toEqual([]);
        expect(result.current.selectedPlayers).toEqual([]);
    });

    it('starts with empty searchSelectedIds set', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        expect(result.current.searchSelectedIds.size).toBe(0);
    });
});

// ─── updateSort ───────────────────────────────────────────────────────────────

describe('updateSort', () => {
    it('switches key and resets dir to desc when a different key is selected', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => result.current.updateSort('fightTime'));
        expect(result.current.sortState).toEqual({ key: 'fightTime', dir: 'desc' });
    });

    it('toggles direction when the same key is selected again', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        // Initial: { key: 'value', dir: 'desc' }
        act(() => result.current.updateSort('value'));
        expect(result.current.sortState).toEqual({ key: 'value', dir: 'asc' });
    });

    it('toggles back to desc on a third click on the same key', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => result.current.updateSort('value')); // desc → asc
        act(() => result.current.updateSort('value')); // asc → desc
        expect(result.current.sortState).toEqual({ key: 'value', dir: 'desc' });
    });

    it('resets to desc when switching from fightTime back to value', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => result.current.updateSort('fightTime'));
        act(() => result.current.updateSort('fightTime')); // toggle to asc
        act(() => result.current.updateSort('value'));     // switch key → reset to desc
        expect(result.current.sortState).toEqual({ key: 'value', dir: 'desc' });
    });

    it('is stable across re-renders (referential equality)', () => {
        const { result, rerender } = renderHook(() => useMetricSectionState(defaultOptions));
        const first = result.current.updateSort;
        rerender();
        expect(result.current.updateSort).toBe(first);
    });
});

// ─── denseSort ────────────────────────────────────────────────────────────────

describe('denseSort', () => {
    it('can be updated via setDenseSort', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => result.current.setDenseSort({ columnId: 'cc', dir: 'asc' }));
        expect(result.current.denseSort).toEqual({ columnId: 'cc', dir: 'asc' });
    });

    it('supports functional updater form', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() =>
            result.current.setDenseSort((prev) => ({
                columnId: prev.columnId,
                dir: prev.dir === 'desc' ? 'asc' : 'desc',
            }))
        );
        expect(result.current.denseSort.dir).toBe('asc');
    });
});

// ─── filteredMetrics ──────────────────────────────────────────────────────────

describe('filteredMetrics', () => {
    it('returns all metrics when search is empty', () => {
        const { result } = renderHook(() => useMetricSectionState({ ...defaultOptions, search: '' }));
        expect(result.current.filteredMetrics).toHaveLength(3);
    });

    it('returns all metrics when search is whitespace', () => {
        const { result } = renderHook(() => useMetricSectionState({ ...defaultOptions, search: '   ' }));
        expect(result.current.filteredMetrics).toHaveLength(3);
    });

    it('filters metrics by label substring (case-insensitive)', () => {
        const { result } = renderHook(() => useMetricSectionState({ ...defaultOptions, search: 'crowd' }));
        expect(result.current.filteredMetrics).toHaveLength(1);
        expect(result.current.filteredMetrics[0].id).toBe('cc');
    });

    it('matches mid-word substring', () => {
        const { result } = renderHook(() => useMetricSectionState({ ...defaultOptions, search: 'bar' }));
        // matches "Breakbar Damage"
        expect(result.current.filteredMetrics).toHaveLength(1);
        expect(result.current.filteredMetrics[0].id).toBe('breakbar');
    });

    it('returns empty list when no metrics match', () => {
        const { result } = renderHook(() => useMetricSectionState({ ...defaultOptions, search: 'zzz' }));
        expect(result.current.filteredMetrics).toHaveLength(0);
    });

    it('matches regardless of input case', () => {
        const { result } = renderHook(() => useMetricSectionState({ ...defaultOptions, search: 'DAMAGE' }));
        expect(result.current.filteredMetrics.map((m) => m.id)).toContain('damage');
        expect(result.current.filteredMetrics.map((m) => m.id)).toContain('breakbar');
    });
});

// ─── columnOptions / columnOptionsFiltered ────────────────────────────────────

describe('columnOptions', () => {
    it('maps every metric to { id, label }', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        expect(result.current.columnOptions).toEqual([
            { id: 'damage', label: 'Damage' },
            { id: 'cc', label: 'Crowd Control' },
            { id: 'breakbar', label: 'Breakbar Damage' },
        ]);
    });

    it('columnOptionsFiltered matches the search string', () => {
        const { result } = renderHook(() => useMetricSectionState({ ...defaultOptions, search: 'damage' }));
        const ids = result.current.columnOptionsFiltered.map((o) => o.id);
        expect(ids).toContain('damage');
        expect(ids).toContain('breakbar');
        expect(ids).not.toContain('cc');
    });
});

// ─── selectedMetrics ─────────────────────────────────────────────────────────

describe('selectedMetrics', () => {
    it('returns all metrics when nothing is selected', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        expect(result.current.selectedMetrics).toHaveLength(3);
    });

    it('returns only the selected metrics when column IDs are set', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => result.current.setSelectedColumnIds(['cc', 'breakbar']));
        expect(result.current.selectedMetrics).toHaveLength(2);
        expect(result.current.selectedMetrics.map((m) => m.id)).toEqual(['cc', 'breakbar']);
    });

    it('returns all metrics again after clearing selection', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => result.current.setSelectedColumnIds(['cc']));
        act(() => result.current.setSelectedColumnIds([]));
        expect(result.current.selectedMetrics).toHaveLength(3);
    });

    it('preserves metric order from the source array', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        // Select in reverse order — result should follow source order
        act(() => result.current.setSelectedColumnIds(['breakbar', 'damage']));
        expect(result.current.selectedMetrics.map((m) => m.id)).toEqual(['damage', 'breakbar']);
    });
});

// ─── playerOptions ────────────────────────────────────────────────────────────

describe('playerOptions', () => {
    it('deduplicates rows by account', () => {
        // ROWS has Alice twice
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        expect(result.current.playerOptions).toHaveLength(2);
        const accounts = result.current.playerOptions.map((o) => o.id);
        expect(accounts).toContain('Alice.1234');
        expect(accounts).toContain('Bob.5678');
    });

    it('uses account as both id and label', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        const alice = result.current.playerOptions.find((o) => o.id === 'Alice.1234')!;
        expect(alice.label).toBe('Alice.1234');
    });

    it('calls renderProfessionIcon with correct args for each player', () => {
        const icon = vi.fn(() => null);
        renderHook(() =>
            useMetricSectionState({ ...defaultOptions, rows: [ROWS[0]], renderProfessionIcon: icon })
        );
        expect(icon).toHaveBeenCalledWith('Guardian', ['Guardian'], 'w-3 h-3');
    });

    it('returns empty array when rows is empty', () => {
        const { result } = renderHook(() => useMetricSectionState({ ...defaultOptions, rows: [] }));
        expect(result.current.playerOptions).toHaveLength(0);
    });

    it('handles rows with missing profession gracefully', () => {
        const rows: PlayerRow[] = [{ account: 'Ghost.0000' }];
        const { result } = renderHook(() => useMetricSectionState({ ...defaultOptions, rows }));
        expect(result.current.playerOptions).toHaveLength(1);
    });
});

// ─── searchSelectedIds ────────────────────────────────────────────────────────

describe('searchSelectedIds', () => {
    it('is empty when nothing is selected', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        expect(result.current.searchSelectedIds.size).toBe(0);
    });

    it('includes column:<id> entries for selected columns', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => result.current.setSelectedColumnIds(['damage', 'cc']));
        expect(result.current.searchSelectedIds.has('column:damage')).toBe(true);
        expect(result.current.searchSelectedIds.has('column:cc')).toBe(true);
    });

    it('includes player:<id> entries for selected players', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => result.current.setSelectedPlayers(['Alice.1234']));
        expect(result.current.searchSelectedIds.has('player:Alice.1234')).toBe(true);
    });

    it('combines column and player entries', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => {
            result.current.setSelectedColumnIds(['damage']);
            result.current.setSelectedPlayers(['Bob.5678']);
        });
        expect(result.current.searchSelectedIds.has('column:damage')).toBe(true);
        expect(result.current.searchSelectedIds.has('player:Bob.5678')).toBe(true);
        expect(result.current.searchSelectedIds.size).toBe(2);
    });

    it('updates correctly when selections are cleared', () => {
        const { result } = renderHook(() => useMetricSectionState(defaultOptions));
        act(() => result.current.setSelectedColumnIds(['damage']));
        act(() => result.current.setSelectedColumnIds([]));
        expect(result.current.searchSelectedIds.size).toBe(0);
    });
});

// ─── fallback for empty metrics ───────────────────────────────────────────────

describe('edge cases', () => {
    it('handles empty metrics array without throwing', () => {
        const { result } = renderHook(() =>
            useMetricSectionState({ ...defaultOptions, metrics: [] })
        );
        expect(result.current.filteredMetrics).toHaveLength(0);
        expect(result.current.columnOptions).toHaveLength(0);
        expect(result.current.selectedMetrics).toHaveLength(0);
        expect(result.current.denseSort.columnId).toBe('value'); // fallback
    });

    it('handles undefined search (defaults to empty)', () => {
        const { result } = renderHook(() =>
            useMetricSectionState({ ...defaultOptions, search: undefined })
        );
        expect(result.current.filteredMetrics).toHaveLength(3);
    });
});
