import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

afterEach(() => {
    cleanup();
});

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const isResponsiveContainerSizeWarning = (args: any[]) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    return message.includes('The width(')
        && message.includes('and height(')
        && message.includes('of chart should be greater than 0');
};

beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
        if (isResponsiveContainerSizeWarning(args)) return;
        originalConsoleError(...args);
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
        if (isResponsiveContainerSizeWarning(args)) return;
        originalConsoleWarn(...args);
    });
});

afterAll(() => {
    (console.error as unknown as { mockRestore?: () => void }).mockRestore?.();
    (console.warn as unknown as { mockRestore?: () => void }).mockRestore?.();
});

Object.defineProperty(window, 'electronAPI', {
    value: {
        openExternal: () => {},
        mockWebReport: () => Promise.resolve({ success: false }),
        uploadWebReport: () => Promise.resolve({ success: false })
    },
    writable: true
});

if (!window.matchMedia) {
    window.matchMedia = () => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false
    });
}

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}

if (!('ResizeObserver' in window)) {
    // @ts-ignore
    window.ResizeObserver = ResizeObserverMock;
}

if (!HTMLCanvasElement.prototype.getContext) {
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = () => null;
}
