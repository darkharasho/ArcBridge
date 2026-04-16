import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { LayersPopover } from '../LayersPopover';
import { useStatsStore } from '../../statsStore';

describe('LayersPopover', () => {
    beforeEach(() => {
        const initial = (useStatsStore as any).getInitialState();
        useStatsStore.setState(initial);
    });

    it('is closed by default and opens on button click', () => {
        render(<LayersPopover />);
        expect(screen.queryByLabelText(/centroid/i)).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /layers/i }));
        expect(screen.getByLabelText(/centroid/i)).toBeTruthy();
    });

    it('toggling a checkbox updates replayLayers', () => {
        render(<LayersPopover />);
        fireEvent.click(screen.getByRole('button', { name: /layers/i }));
        fireEvent.click(screen.getByLabelText(/centroid/i));
        expect(useStatsStore.getState().replayLayers.centroidSpread).toBe(true);
    });

    it('heatmap radio switches mode', () => {
        render(<LayersPopover />);
        fireEvent.click(screen.getByRole('button', { name: /layers/i }));
        fireEvent.click(screen.getByLabelText(/deaths/i));
        expect(useStatsStore.getState().replayLayers.heatmap).toBe('deaths');
    });
});
