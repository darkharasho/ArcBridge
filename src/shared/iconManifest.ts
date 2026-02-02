export type IconKind = 'skill' | 'buff' | 'sigil' | 'relic';

export type IconManifest = {
    version: number;
    generatedAt: string;
    entries: Record<string, string>;
    collisions?: Record<string, string[]>;
};

const manifestCache: Partial<Record<IconKind, IconManifest | null>> = {};
const manifestPromiseCache: Partial<Record<IconKind, Promise<IconManifest | null>>> = {};

export const normalizeIconKey = (name: string): string => {
    if (!name) return '';
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
};

const getImageBasePath = (): string => {
    if (typeof window === 'undefined') return './img';
    if (window.location.protocol === 'file:') return './img';
    const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    const baseUrl = (import.meta as any)?.env?.BASE_URL || './';
    if (isHttp && baseUrl && baseUrl !== './') {
        return `${String(baseUrl).replace(/\/?$/, '/') }img`.replace(/\/{2,}/g, '/');
    }
    return './img';
};

export const getIconAssetPath = (kind: IconKind, filename: string): string => {
    const basePath = getImageBasePath();
    return `${basePath}/${kind}-icons/${filename}`.replace(/\/{2,}/g, '/');
};

const getManifestUrl = (kind: IconKind): string => {
    const basePath = getImageBasePath();
    return `${basePath}/${kind}-icons/manifest.json`.replace(/\/{2,}/g, '/');
};

export const loadIconManifest = async (kind: IconKind): Promise<IconManifest | null> => {
    if (manifestCache[kind] !== undefined) return manifestCache[kind] || null;
    if (!manifestPromiseCache[kind]) {
        manifestPromiseCache[kind] = fetch(getManifestUrl(kind), { cache: 'force-cache' })
            .then((resp) => (resp.ok ? resp.json() : null))
            .then((data) => {
                const manifest = data && typeof data === 'object' && data.entries ? (data as IconManifest) : null;
                manifestCache[kind] = manifest;
                return manifest;
            })
            .catch(() => {
                manifestCache[kind] = null;
                return null;
            });
    }
    return manifestPromiseCache[kind] || null;
};

export const resolveIconUrl = (
    manifest: IconManifest | null,
    kind: IconKind,
    name: string
): string | null => {
    if (!manifest || !name) return null;
    const key = normalizeIconKey(name);
    const filename = manifest.entries[key];
    if (!filename) return null;
    return getIconAssetPath(kind, filename);
};
