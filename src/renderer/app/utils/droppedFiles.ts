type DroppedFileLike = {
    name?: string;
    path?: string;
};

type DroppedItemLike = {
    kind?: string;
    getAsFile?: () => DroppedFileLike | null;
};

type TransferLike = {
    files?: ArrayLike<DroppedFileLike> | null;
    items?: ArrayLike<DroppedItemLike> | null;
};

interface DropOptions {
    allowJson?: boolean;
}

const isSupportedLogFile = (candidate: DroppedFileLike | null | undefined, options?: DropOptions) => {
    if (!candidate) return false;
    const name = String(candidate.name || candidate.path || '').toLowerCase();
    if (name.endsWith('.evtc') || name.endsWith('.zevtc')) return true;
    if (options?.allowJson && name.endsWith('.json')) return true;
    return false;
};

const resolveDroppedFilePath = (candidate: DroppedFileLike | null | undefined) => {
    const directPath = String(candidate?.path || '').trim();
    if (directPath) return directPath;
    if (!candidate) return '';
    try {
        return String(window.electronAPI?.resolveDroppedFilePath?.(candidate as File) || '').trim();
    } catch {
        return '';
    }
};

const pushIfValid = (
    bucket: Array<{ filePath: string; fileName: string }>,
    seenPaths: Set<string>,
    candidate: DroppedFileLike | null | undefined,
    options?: DropOptions
) => {
    if (!candidate || !isSupportedLogFile(candidate, options)) return;
    const filePath = resolveDroppedFilePath(candidate);
    if (!filePath || seenPaths.has(filePath)) return;
    seenPaths.add(filePath);
    const fileName = String(candidate.name || filePath.split(/[\\/]/).pop() || filePath);
    bucket.push({ filePath, fileName });
};

export const extractDroppedLogFiles = (transfer: TransferLike | null | undefined, options?: DropOptions) => {
    const resolved: Array<{ filePath: string; fileName: string }> = [];
    const seenPaths = new Set<string>();

    const items = transfer?.items;
    if (items) {
        for (const item of Array.from(items)) {
            if (!item || item.kind !== 'file' || typeof item.getAsFile !== 'function') continue;
            pushIfValid(resolved, seenPaths, item.getAsFile(), options);
        }
    }

    const files = transfer?.files;
    if (files) {
        for (const file of Array.from(files)) {
            pushIfValid(resolved, seenPaths, file, options);
        }
    }

    return resolved;
};
