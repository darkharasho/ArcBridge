import https from 'node:https';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Referer': 'https://wiki.guildwars2.com/'
};

export const fetchImageBuffer = (url: string, redirectCount = 0): Promise<{ buffer: Buffer; contentType: string }> => {
    if (redirectCount > 5) {
        return Promise.reject(new Error('Too many redirects'));
    }
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: IMAGE_REQUEST_HEADERS }, (res) => {
            const statusCode = res.statusCode || 0;
            if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
                const nextUrl = new URL(res.headers.location, url).toString();
                res.resume();
                fetchImageBuffer(nextUrl, redirectCount + 1).then(resolve).catch(reject);
                return;
            }
            if (statusCode >= 400) {
                res.resume();
                reject(new Error(`Request failed with status ${statusCode}`));
                return;
            }
            const chunks: Buffer[] = [];
            let total = 0;
            res.on('data', (chunk: Buffer) => {
                total += chunk.length;
                if (total > MAX_IMAGE_BYTES) {
                    req.destroy();
                    reject(new Error('Image too large'));
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', () => {
                const contentType = typeof res.headers['content-type'] === 'string'
                    ? res.headers['content-type']
                    : 'application/octet-stream';
                resolve({ buffer: Buffer.concat(chunks), contentType });
            });
        });
        req.on('error', (err) => reject(err));
    });
};
