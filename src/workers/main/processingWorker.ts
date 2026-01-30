import { parentPort } from 'worker_threads';
import fs from 'fs';
import { createHash } from 'crypto';
import zlib from 'zlib';
import { computeOutgoingConditions } from '../../shared/conditionsMetrics';
import type { WorkerRequest, WorkerResponse } from './types';

if (!parentPort) {
    throw new Error('This file must be run as a worker thread');
}

const port = parentPort;

const sendResponse = (response: WorkerResponse) => {
    port.postMessage(response);
};

const handleHash = async (id: string, filePath: string): Promise<void> => {
    try {
        const hash = await new Promise<string>((resolve, reject) => {
            const hasher = createHash('sha256');
            const stream = fs.createReadStream(filePath);
            stream.on('data', (chunk) => hasher.update(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(hasher.digest('hex')));
        });
        sendResponse({ type: 'HASH_RESULT', id, hash });
    } catch (error: any) {
        sendResponse({
            type: 'ERROR',
            id,
            error: error?.message || String(error),
            stack: error?.stack
        });
    }
};

const handleJsonParse = async (id: string, filePath: string, isGzipped: boolean): Promise<void> => {
    try {
        const raw = await fs.promises.readFile(filePath);
        let data: any;

        if (isGzipped) {
            const inflated = await new Promise<Buffer>((resolve, reject) => {
                zlib.gunzip(raw, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            data = JSON.parse(inflated.toString('utf8'));
        } else {
            data = JSON.parse(raw.toString('utf8'));
        }

        sendResponse({ type: 'JSON_PARSE_RESULT', id, data });
    } catch (error: any) {
        sendResponse({
            type: 'ERROR',
            id,
            error: error?.message || String(error),
            stack: error?.stack
        });
    }
};

const handleMetrics = (id: string, payload: {
    players: any[];
    targets: any[];
    skillMap?: Record<string, { name?: string }>;
    buffMap?: Record<string, { name?: string; classification?: string }>;
}): void => {
    try {
        const result = computeOutgoingConditions(payload);
        sendResponse({ type: 'METRICS_RESULT', id, result });
    } catch (error: any) {
        sendResponse({
            type: 'ERROR',
            id,
            error: error?.message || String(error),
            stack: error?.stack
        });
    }
};

port.on('message', async (request: WorkerRequest) => {
    switch (request.type) {
        case 'HASH':
            await handleHash(request.id, request.filePath);
            break;
        case 'JSON_PARSE':
            await handleJsonParse(request.id, request.filePath, request.isGzipped);
            break;
        case 'METRICS':
            handleMetrics(request.id, request.payload);
            break;
        case 'SHUTDOWN':
            sendResponse({ type: 'SHUTDOWN_ACK' });
            process.exit(0);
            break;
        default:
            sendResponse({
                type: 'ERROR',
                id: (request as any).id || 'unknown',
                error: `Unknown request type: ${(request as any).type}`
            });
    }
});

// Signal that the worker is ready
sendResponse({ type: 'READY' });
