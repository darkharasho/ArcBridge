import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';

const SCHEMA_VERSION = 2;
const IDB_PREFIX = 'details:';
const MANIFEST_KEY = '_details_manifest';

type IdbEntry = { schemaVersion: number; details: any; storedAt: number };
type ManifestEntry = { storedAt: number; schemaVersion: number };
type Manifest = Record<string, ManifestEntry>;

export type DetailsFetcher = (logId: string) => Promise<any | null>;
export type DetailsResolver = (logId: string) => any | null;

export class DetailsCache {
    private lru = new Map<string, any>();
    private lruCapacity: number;
    private fetchDetails: DetailsFetcher;
    private resolveDetails: DetailsResolver | null;
    private inFlight = new Map<string, Promise<any | null>>();

    constructor(options: { lruCapacity?: number; fetchDetails: DetailsFetcher; resolveDetails?: DetailsResolver }) {
        this.lruCapacity = options.lruCapacity ?? 5;
        this.fetchDetails = options.fetchDetails;
        this.resolveDetails = options.resolveDetails ?? null;
    }

    /** Synchronous — checks memory LRU (with promotion), then synchronous resolver if provided. */
    peek(logId: string): any | undefined {
        const cached = this.lru.get(logId);
        if (cached !== undefined) {
            // Promote to most-recently-used to prevent eviction by concurrent prefetch
            this.lru.delete(logId);
            this.lru.set(logId, cached);
            return cached;
        }
        if (this.resolveDetails) {
            const resolved = this.resolveDetails(logId);
            if (resolved) {
                this.lruSet(logId, resolved);
                return resolved;
            }
        }
        return undefined;
    }

    /** Async — checks LRU → IndexedDB only (no IPC fallback).
     *  Use for pre-warming during worker streaming where network fetches would block. */
    async getLocal(logId: string): Promise<any | null> {
        const memHit = this.lru.get(logId);
        if (memHit !== undefined) {
            this.lru.delete(logId);
            this.lru.set(logId, memHit);
            return memHit;
        }
        try {
            const entry = await idbGet<IdbEntry>(IDB_PREFIX + logId);
            if (entry && entry.schemaVersion === SCHEMA_VERSION && entry.details) {
                this.lruSet(logId, entry.details);
                return entry.details;
            }
        } catch {
            // IndexedDB unavailable
        }
        return null;
    }

    /** Async — checks LRU → IndexedDB → IPC fallback. */
    async get(logId: string): Promise<any | null> {
        // Tier 1: memory LRU
        const memHit = this.lru.get(logId);
        if (memHit !== undefined) {
            // Promote to most-recently-used
            this.lru.delete(logId);
            this.lru.set(logId, memHit);
            return memHit;
        }

        // Tier 2: IndexedDB
        try {
            const entry = await idbGet<IdbEntry>(IDB_PREFIX + logId);
            if (entry && entry.schemaVersion === SCHEMA_VERSION && entry.details) {
                this.lruSet(logId, entry.details);
                return entry.details;
            }
        } catch {
            // IndexedDB unavailable — fall through to IPC
        }

        // Tier 3: IPC fallback (deduplicate concurrent requests)
        const existing = this.inFlight.get(logId);
        if (existing) return existing;

        const promise = this.fetchDetails(logId).then((fetched) => {
            this.inFlight.delete(logId);
            if (fetched) {
                this.lruSet(logId, fetched);
                this.idbPut(logId, fetched);
            }
            return fetched;
        }).catch((err) => {
            this.inFlight.delete(logId);
            throw err;
        });
        this.inFlight.set(logId, promise);
        return promise;
    }

    /** Write-through — stores in both LRU and IndexedDB. */
    async put(logId: string, details: any): Promise<void> {
        this.lruSet(logId, details);
        await this.idbPut(logId, details);
    }

    /** Fire-and-forget variant of put — does not await IndexedDB write. */
    putSync(logId: string, details: any): void {
        this.lruSet(logId, details);
        this.idbPut(logId, details);
    }

    /** Memory LRU only — no IndexedDB. Use for hot-path pre-warming where
     *  structured clone cost is unacceptable (10-40MB objects). */
    putMemoryOnly(logId: string, details: any): void {
        this.lruSet(logId, details);
    }

    /** Evict from memory LRU only (IndexedDB retained). */
    evict(logId: string): void {
        this.lru.delete(logId);
    }

    /** Evict from both memory and IndexedDB. */
    async purge(logId: string): Promise<void> {
        this.lru.delete(logId);
        try {
            await idbDel(IDB_PREFIX + logId);
            const manifest = await idbGet<Manifest>(MANIFEST_KEY);
            if (manifest && logId in manifest) {
                delete manifest[logId];
                await idbSet(MANIFEST_KEY, manifest);
            }
        } catch {
            // IndexedDB unavailable — memory eviction still succeeded
        }
    }

    /** Delete all IndexedDB entries older than `ttlMs` or with a stale schema version.
     *  Uses a lightweight manifest to avoid deserializing full detail blobs.
     *  Also evicts matching keys from the in-memory LRU. Fire-and-forget safe. */
    async sweep(ttlMs: number): Promise<number> {
        let deleted = 0;
        try {
            const manifest = await idbGet<Manifest>(MANIFEST_KEY) ?? {};
            const now = Date.now();
            const expiredKeys: string[] = [];
            for (const [key, meta] of Object.entries(manifest)) {
                if (
                    !meta ||
                    typeof meta.storedAt !== 'number' ||
                    now - meta.storedAt > ttlMs ||
                    meta.schemaVersion !== SCHEMA_VERSION
                ) {
                    expiredKeys.push(key);
                }
            }
            // Also find detail keys not in the manifest (legacy entries written before manifest existed)
            const allKeys = await idbKeys();
            const orphanKeys = allKeys.filter(
                (k): k is string =>
                    typeof k === 'string' &&
                    k.startsWith(IDB_PREFIX) &&
                    !(k.slice(IDB_PREFIX.length) in manifest)
            );
            const allExpired = [...expiredKeys.map((k) => IDB_PREFIX + k), ...orphanKeys];
            await Promise.all(
                allExpired.map(async (idbKey) => {
                    try {
                        await idbDel(idbKey);
                        const logId = idbKey.slice(IDB_PREFIX.length);
                        this.lru.delete(logId);
                        delete manifest[logId];
                        deleted++;
                    } catch {
                        // Individual delete failed — skip it
                    }
                })
            );
            if (deleted > 0) {
                await idbSet(MANIFEST_KEY, manifest).catch(() => {});
            }
        } catch {
            // IndexedDB unavailable — nothing to sweep
        }
        return deleted;
    }

    /** Current memory LRU size. */
    get memorySize(): number {
        return this.lru.size;
    }

    private lruSet(logId: string, details: any): void {
        this.lru.delete(logId);
        this.lru.set(logId, details);
        if (this.lru.size > this.lruCapacity) {
            const oldest = this.lru.keys().next().value;
            if (oldest !== undefined) this.lru.delete(oldest);
        }
    }

    private idbPut(logId: string, details: any): Promise<void> {
        const now = Date.now();
        const entry: IdbEntry = {
            schemaVersion: SCHEMA_VERSION,
            details,
            storedAt: now,
        };
        return idbSet(IDB_PREFIX + logId, entry).then(() => {
            // Update lightweight manifest for TTL sweep
            return idbGet<Manifest>(MANIFEST_KEY).then((manifest) => {
                const m = manifest ?? {};
                m[logId] = { storedAt: now, schemaVersion: SCHEMA_VERSION };
                return idbSet(MANIFEST_KEY, m);
            });
        }).catch(() => {
            // IndexedDB write failed — memory LRU still has it
        });
    }
}
