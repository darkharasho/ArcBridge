export type IconKind = 'game';

export type IconSpriteEntry = {
    sheet: string;
    x: number;
    y: number;
    w: number;
    h: number;
};

export type IconSpriteMeta = {
    width: number;
    height: number;
    tile: number;
    columns: number;
    rows: number;
};

export type IconEntry = string | IconSpriteEntry;

export type IconAsset = string | IconSpriteRef;

export type IconSpriteRef = {
    type: 'sprite';
    sheetUrl: string;
    x: number;
    y: number;
    w: number;
    h: number;
    columns: number;
    rows: number;
};

export type IconManifest = {
    version: number;
    generatedAt: string;
    entries: Record<string, IconEntry>;
    collisions?: Record<string, string[]>;
    sprites?: Record<string, IconSpriteMeta>;
};

export type IconAliasManifest = {
    version: number;
    generatedAt: string;
    traitAliases?: Record<string, string>;
    iconAliases?: Record<string, string>;
};

export type SkillIdNameMap = Record<string, string>;

let manifestCache: IconManifest | null | undefined = undefined;
let manifestPromise: Promise<IconManifest | null> | null = null;
let aliasCache: IconAliasManifest | null | undefined = undefined;
let aliasPromise: Promise<IconAliasManifest | null> | null = null;
let overrideCache: IconAliasManifest | null | undefined = undefined;
let overridePromise: Promise<IconAliasManifest | null> | null = null;
let skillIdNameCache: SkillIdNameMap | null | undefined = undefined;
let skillIdNamePromise: Promise<SkillIdNameMap | null> | null = null;

export const normalizeIconKey = (name: string): string => {
    if (!name) return '';
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’'`´"]/g, '')
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

export const getIconAssetPath = (_kind: IconKind, filename: string): string => {
    const basePath = getImageBasePath();
    return `${basePath}/game-icons/${filename}`.replace(/\/{2,}/g, '/');
};

export const getGameIconSpritePath = (filename: string): string => {
    const basePath = getImageBasePath();
    return `${basePath}/game-icons-sprite/${filename}`.replace(/\/{2,}/g, '/');
};

export const getUnknownSkillIconUrl = (): string => {
    const basePath = getImageBasePath();
    return `${basePath}/UnknownSkill.svg`.replace(/\/{2,}/g, '/');
};

const getManifestUrls = (): string[] => {
    const basePath = getImageBasePath();
    const spriteRelative = `${basePath}/game-icons-sprite/manifest.json`.replace(/\/{2,}/g, '/');
    const relative = `${basePath}/game-icons/manifest.json`.replace(/\/{2,}/g, '/');
    if (typeof window === 'undefined') return [spriteRelative, relative];
    const origin = window.location.origin.replace(/\/$/, '');
    const absolute = `${origin}/game-icons/manifest.json`.replace(/\/{2,}/g, '/');
    const absoluteImg = `${origin}/img/game-icons/manifest.json`.replace(/\/{2,}/g, '/');
    const spriteAbsolute = `${origin}/game-icons-sprite/manifest.json`.replace(/\/{2,}/g, '/');
    const spriteAbsoluteImg = `${origin}/img/game-icons-sprite/manifest.json`.replace(/\/{2,}/g, '/');
    return [spriteRelative, spriteAbsoluteImg, spriteAbsolute, relative, absoluteImg, absolute];
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

const getOverrideUrls = (): string[] => {
    const basePath = getImageBasePath();
    const relative = `${basePath}/icon-aliases.overrides.json`.replace(/\/{2,}/g, '/');
    if (typeof window === 'undefined') return [relative];
    const origin = window.location.origin.replace(/\/$/, '');
    const absoluteImg = `${origin}/img/icon-aliases.overrides.json`.replace(/\/{2,}/g, '/');
    const absolute = `${origin}/icon-aliases.overrides.json`.replace(/\/{2,}/g, '/');
    return [relative, absoluteImg, absolute];
};

export const loadIconAliases = async (): Promise<IconAliasManifest | null> => {
    if (aliasCache !== undefined) return aliasCache || null;
    if (!aliasPromise) {
        const urls = getAliasUrls();
        aliasPromise = (async () => {
            for (const url of urls) {
                try {
                    const resp = await fetch(url, { cache: 'no-store' });
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    const manifest = data && typeof data === 'object' ? (data as IconAliasManifest) : null;
                    aliasCache = manifest;
                    break;
                } catch {
                    continue;
                }
            }
            if (aliasCache === undefined) aliasCache = null;
            return aliasCache;
        })();
    }
    const base = await (aliasPromise || Promise.resolve(null));

    if (overrideCache !== undefined) {
        if (!overrideCache && !base) return base || null;
        return {
            ...(base || { version: 1, generatedAt: new Date().toISOString() }),
            iconAliases: {
                ...(base?.iconAliases || {}),
                ...(overrideCache?.iconAliases || {})
            },
            traitAliases: {
                ...(base?.traitAliases || {}),
                ...(overrideCache?.traitAliases || {})
            }
        };
    }

    if (!overridePromise) {
        const overrideUrls = getOverrideUrls();
        overridePromise = (async () => {
            for (const url of overrideUrls) {
                try {
                    const resp = await fetch(url, { cache: 'no-store' });
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    const manifest = data && typeof data === 'object' ? (data as IconAliasManifest) : null;
                    overrideCache = manifest;
                    return manifest;
                } catch {
                    continue;
                }
            }
            overrideCache = null;
            return null;
        })();
    }
    const overrides = await overridePromise;
    if (!overrides && !base) return null;
    return {
        ...(base || { version: 1, generatedAt: new Date().toISOString() }),
        iconAliases: {
            ...(base?.iconAliases || {}),
            ...(overrides?.iconAliases || {})
        },
        traitAliases: {
            ...(base?.traitAliases || {}),
            ...(overrides?.traitAliases || {})
        }
    };
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
                    const resp = await fetch(url, { cache: 'no-store' });
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

export const loadIconManifest = async (): Promise<IconManifest | null> => {
    if (manifestCache !== undefined) return manifestCache || null;
    if (!manifestPromise) {
        const urls = getManifestUrls();
        manifestPromise = (async () => {
            for (const url of urls) {
                try {
                    const resp = await fetch(url, { cache: 'no-store' });
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    const manifest = data && typeof data === 'object' && data.entries ? (data as IconManifest) : null;
                    if (manifest) {
                        manifestCache = manifest;
                        return manifest;
                    }
                } catch {
                    continue;
                }
            }
            manifestCache = null;
            return null;
        })();
    }
    return manifestPromise || null;
};

export const resolveIconUrl = (manifest: IconManifest | null, name: string): IconAsset | null => {
    if (!manifest || !name) return null;
    const key = normalizeIconKey(name);
    const filename = manifest.entries[key];
    if (!filename) return null;
    if (typeof filename === 'string') {
        return getIconAssetPath('game', filename);
    }
    const sheetUrl = getGameIconSpritePath(filename.sheet);
    const sheetMeta = manifest.sprites?.[filename.sheet];
    return {
        type: 'sprite',
        sheetUrl,
        x: filename.x,
        y: filename.y,
        w: filename.w,
        h: filename.h,
        columns: sheetMeta?.columns || 1,
        rows: sheetMeta?.rows || 1
    };
};

export const guessIconUrl = (name: string): string | null => {
    if (!name) return null;
    const trimmed = name.trim();
    const preserved = trimmed
        .replace(/&/g, ' and ')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    const deapostrophed = trimmed
        .replace(/[’'`´"]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    const mergedPossessive = preserved.replace(/_s_/, 's_');
    const mergedPossessiveLower = mergedPossessive.toLowerCase();
    const preservedLower = preserved.toLowerCase();
    const deapostrophedLower = deapostrophed.toLowerCase();
    const normalized = normalizeIconKey(trimmed);
    if (deapostrophed) return getIconAssetPath('game', `${deapostrophed}.webp`);
    if (mergedPossessive) return getIconAssetPath('game', `${mergedPossessive}.webp`);
    if (preserved) return getIconAssetPath('game', `${preserved}.webp`);
    if (deapostrophedLower) return getIconAssetPath('game', `${deapostrophedLower}.webp`);
    if (mergedPossessiveLower) return getIconAssetPath('game', `${mergedPossessiveLower}.webp`);
    if (preservedLower) return getIconAssetPath('game', `${preservedLower}.webp`);
    if (normalized) return getIconAssetPath('game', `${normalized}.webp`);
    return null;
};
