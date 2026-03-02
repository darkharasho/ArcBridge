import util from 'node:util';

export type ConsoleLogEntry = { type: 'info' | 'error'; message: string; timestamp: string };

interface WindowLike {
    isDestroyed(): boolean;
    webContents: {
        isDestroyed(): boolean;
        send(channel: string, ...args: any[]): void;
    };
}

export function formatLogArg(arg: any): string {
    try {
        if (arg instanceof Error) {
            try {
                if (typeof arg.stack === 'string' && arg.stack.length > 0) {
                    return arg.stack;
                }
            } catch {
                // Some stack getters can throw; fall through to message.
            }
            const errorName = typeof arg.name === 'string' && arg.name.length > 0 ? arg.name : 'Error';
            const errorMessage = typeof arg.message === 'string' && arg.message.length > 0 ? arg.message : '[no message]';
            return `${errorName}: ${errorMessage}`;
        }
        if (typeof arg === 'object' && arg !== null) {
            try {
                return util.inspect(arg, {
                    depth: 3,
                    maxArrayLength: 50,
                    maxStringLength: 5000,
                    breakLength: 120,
                    customInspect: false,
                    getters: false
                });
            } catch {
                try {
                    return Object.prototype.toString.call(arg);
                } catch {
                    return '[Unserializable object]';
                }
            }
        }
        return String(arg);
    } catch {
        return '[Unserializable argument]';
    }
}

export function formatLogArgs(args: any[]): string {
    try {
        return args.map((arg) => formatLogArg(arg)).join(' ');
    } catch {
        return '[Log formatting failed]';
    }
}

const CONSOLE_LOG_HISTORY_MAX = 500;

export function setupConsoleLogger(getWindow: () => WindowLike | null | undefined) {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    let forwardToRenderer = false;
    let history: ConsoleLogEntry[] = [];

    const record = (entry: ConsoleLogEntry) => {
        history.push(entry);
        if (history.length > CONSOLE_LOG_HISTORY_MAX) {
            history = history.slice(history.length - CONSOLE_LOG_HISTORY_MAX);
        }
    };

    const send = (entry: ConsoleLogEntry) => {
        try {
            if (!forwardToRenderer) return;
            const win = getWindow();
            if (!win || win.isDestroyed()) return;
            if (win.webContents.isDestroyed()) return;
            win.webContents.send('console-log', entry);
        } catch {
            // Swallow send errors to avoid recursive console errors when the renderer is gone.
        }
    };

    console.log = (...args) => {
        const message = formatLogArgs(args);
        originalConsoleLog(message);
        const entry: ConsoleLogEntry = { type: 'info', message, timestamp: new Date().toISOString() };
        record(entry);
        send(entry);
    };

    console.warn = (...args) => {
        const message = formatLogArgs(args);
        originalConsoleWarn(message);
        const entry: ConsoleLogEntry = { type: 'info', message, timestamp: new Date().toISOString() };
        record(entry);
        send(entry);
    };

    console.error = (...args) => {
        const message = formatLogArgs(args);
        originalConsoleError(message);
        const entry: ConsoleLogEntry = { type: 'error', message, timestamp: new Date().toISOString() };
        record(entry);
        send(entry);
    };

    return {
        setForwarding: (enabled: boolean) => { forwardToRenderer = enabled; },
        getHistory: () => history as ReadonlyArray<ConsoleLogEntry>,
    };
}
