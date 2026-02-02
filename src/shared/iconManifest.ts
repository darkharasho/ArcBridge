export type IconKind = 'skill' | 'buff' | 'sigil' | 'relic' | 'trait';

export type IconManifest = {
    version: number;
    generatedAt: string;
    entries: Record<string, string>;
    collisions?: Record<string, string[]>;
};

export type IconAliasManifest = {
    version: number;
    generatedAt: string;
    traitAliases?: Record<string, string>;
    iconAliases?: Record<string, string>;
};

export type SkillIdNameMap = Record<string, string>;

const manifestCache: Partial<Record<IconKind, IconManifest | null>> = {};
const manifestPromiseCache: Partial<Record<IconKind, Promise<IconManifest | null>>> = {};
let aliasCache: IconAliasManifest | null | undefined = undefined;
let aliasPromise: Promise<IconAliasManifest | null> | null = null;
let skillIdNameCache: SkillIdNameMap | null | undefined = undefined;
let skillIdNamePromise: Promise<SkillIdNameMap | null> | null = null;

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
    if (isHttp) return '/img';
    return './img';
};

export const getIconAssetPath = (kind: IconKind, filename: string): string => {
    const basePath = getImageBasePath();
    return `${basePath}/${kind}-icons/${filename}`.replace(/\/{2,}/g, '/');
};

export const getUnknownSkillIconUrl = (): string => {
    const basePath = getImageBasePath();
    return `${basePath}/UnknownSkill.svg`.replace(/\/{2,}/g, '/');
};

const getManifestUrls = (kind: IconKind): string[] => {
    const basePath = getImageBasePath();
    const relative = `${basePath}/${kind}-icons/manifest.json`.replace(/\/{2,}/g, '/');
    if (typeof window === 'undefined') return [relative];
    const origin = window.location.origin.replace(/\/$/, '');
    const absolute = `${origin}/${kind}-icons/manifest.json`.replace(/\/{2,}/g, '/');
    const absoluteImg = `${origin}/img/${kind}-icons/manifest.json`.replace(/\/{2,}/g, '/');
    return [relative, absoluteImg, absolute];
};

const getAliasUrls = (): string[] => {
    const basePath = getImageBasePath();
    const relative = `${basePath}/icon-aliases.json`.replace(/\/{2,}/g, '/');
    if (typeof window === 'undefined') return [relative];
    const origin = window.location.origin.replace(/\/$/, '');
    const absoluteImg = `${origin}/img/icon-aliases.json`.replace(/\/{2,}/g, '/');
    const absolute = `${origin}/icon-aliases.json`.replace(/\/{2,}/g, '/');
    return [relative, absoluteImg, absolute];
};

export const loadIconAliases = async (): Promise<IconAliasManifest | null> => {
    if (aliasCache !== undefined) return aliasCache || null;
    if (!aliasPromise) {
        const urls = getAliasUrls();
        aliasPromise = (async () => {
            for (const url of urls) {
                try {
                    const resp = await fetch(url, { cache: 'force-cache' });
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    const manifest = data && typeof data === 'object' ? (data as IconAliasManifest) : null;
                    aliasCache = manifest;
                    return manifest;
                } catch {
                    continue;
                }
            }
            aliasCache = null;
            return null;
        })();
    }
    return aliasPromise || null;
};

const getSkillIdNameUrls = (): string[] => {
    const basePath = getImageBasePath();
    const relative = `${basePath}/skill-id-names.json`.replace(/\/{2,}/g, '/');
    if (typeof window === 'undefined') return [relative];
    const origin = window.location.origin.replace(/\/$/, '');
    const absoluteImg = `${origin}/img/skill-id-names.json`.replace(/\/{2,}/g, '/');
    const absolute = `${origin}/skill-id-names.json`.replace(/\/{2,}/g, '/');
    return [relative, absoluteImg, absolute];
};

export const loadSkillIdNames = async (): Promise<SkillIdNameMap | null> => {
    if (skillIdNameCache !== undefined) return skillIdNameCache || null;
    if (!skillIdNamePromise) {
        const urls = getSkillIdNameUrls();
        skillIdNamePromise = (async () => {
            for (const url of urls) {
                try {
                    const resp = await fetch(url, { cache: 'force-cache' });
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    if (data && typeof data === 'object') {
                        skillIdNameCache = data as SkillIdNameMap;
                        return skillIdNameCache;
                    }
                } catch {
                    continue;
                }
            }
            skillIdNameCache = null;
            return null;
        })();
    }
    return skillIdNamePromise || null;
};

export const loadIconManifest = async (kind: IconKind): Promise<IconManifest | null> => {
    if (manifestCache[kind] !== undefined) return manifestCache[kind] || null;
    if (!manifestPromiseCache[kind]) {
        const urls = getManifestUrls(kind);
        manifestPromiseCache[kind] = (async () => {
            for (const url of urls) {
                try {
                    const resp = await fetch(url, { cache: 'force-cache' });
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    const manifest = data && typeof data === 'object' && data.entries ? (data as IconManifest) : null;
                    if (manifest) {
                        manifestCache[kind] = manifest;
                        return manifest;
                    }
                } catch {
                    continue;
                }
            }
            manifestCache[kind] = null;
            return null;
        })();
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

export const guessIconUrl = (kind: IconKind, name: string): string | null => {
    if (!name) return null;
    const trimmed = name.trim();
    const preserved = trimmed
        .replace(/&/g, ' and ')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    const normalized = normalizeIconKey(trimmed);
    if (preserved) return getIconAssetPath(kind, `${preserved}.webp`);
    if (normalized) return getIconAssetPath(kind, `${normalized}.webp`);
    return null;
};
