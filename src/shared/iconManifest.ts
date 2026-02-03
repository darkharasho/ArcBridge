export type IconAsset = string;

export type SkillIdNameMap = Record<string, string>;

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
