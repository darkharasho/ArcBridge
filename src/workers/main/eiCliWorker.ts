import { parentPort, workerData } from 'worker_threads';
import { loadEiCliJsonForLog, type EiCliLoadResult } from '../../main/eiCli';

type EiCliWorkerRequest =
    | {
        type: 'PARSE_EI';
        id: string;
        payload: {
            filePath: string;
            cacheKey?: string | null;
            settings: {
                enabled: boolean;
                autoSetup: boolean;
                autoUpdate: boolean;
                preferredRuntime: 'auto' | 'dotnet' | 'wine';
            };
            dpsReportToken?: string | null;
        };
    }
    | { type: 'SHUTDOWN' };

type EiCliWorkerResponse =
    | { type: 'EI_RESULT'; id: string; result: EiCliLoadResult }
    | { type: 'ERROR'; id: string; error: string; stack?: string }
    | { type: 'READY' }
    | { type: 'SHUTDOWN_ACK' };

if (!parentPort) {
    throw new Error('This file must be run as a worker thread');
}

if (workerData?.userDataPath) {
    process.env.EI_CLI_USER_DATA = workerData.userDataPath;
}

const sendResponse = (response: EiCliWorkerResponse) => {
    parentPort?.postMessage(response);
};

parentPort.on('message', async (request: EiCliWorkerRequest) => {
    switch (request.type) {
        case 'PARSE_EI':
            try {
                const result = await loadEiCliJsonForLog(request.payload);
                sendResponse({ type: 'EI_RESULT', id: request.id, result });
            } catch (error: any) {
                sendResponse({
                    type: 'ERROR',
                    id: request.id,
                    error: error?.message || String(error),
                    stack: error?.stack
                });
            }
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

sendResponse({ type: 'READY' });
