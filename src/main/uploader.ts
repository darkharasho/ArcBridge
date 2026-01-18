import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

export interface UploadResult {
    id: string;
    permalink: string;
    userToken: string;
    uploadTime?: number;
    encounterDuration?: string;
    fightName?: string;
    error?: string;
}

export class Uploader {
    private static API_URL = 'https://dps.report/uploadContent';

    async upload(filePath: string): Promise<UploadResult> {
        try {
            const formData = new FormData();
            formData.append('json', '1');
            formData.append('generator', 'ei');
            formData.append('detailedwvw', 'true'); // Enable detailed WvW stats
            formData.append('file', fs.createReadStream(filePath));

            // Optional: User Token support can be added here

            console.log(`Uploading ${filePath} to dps.report...`);

            const response = await axios.post(Uploader.API_URL, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity // Allow large files
            });

            const data = response.data;

            return {
                id: data.id,
                permalink: data.permalink,
                userToken: data.userToken,
                uploadTime: data.uploadTime || Math.floor(Date.now() / 1000),
                encounterDuration: data.encounter?.duration,
                fightName: data.encounter?.boss
            };

        } catch (error: any) {
            console.error('Upload failed:', error);
            return {
                id: '',
                permalink: '',
                userToken: '',
                error: error.message || 'Unknown error'
            };
        }
    }

    async fetchDetailedJson(permalink: string): Promise<any | null> {
        try {
            // Permalinks are usually https://dps.report/xxxx-yyyy
            // The JSON endpoint is https://dps.report/getJson?permalink=xxxx-yyyy
            const id = permalink.split('/').pop();
            const jsonUrl = `https://dps.report/getJson?permalink=${id}`;
            console.log(`[Uploader] Fetching detailed JSON from: ${jsonUrl} for ID: ${id}`);

            const response = await axios.get(jsonUrl);
            if (response.data) {
                console.log(`[Uploader] JSON fetched successfully. Keys: ${Object.keys(response.data).join(',')}`);
                if (response.data.error) {
                    console.warn(`[Uploader] JSON returned error: ${response.data.error}`);
                }
            } else {
                console.warn('[Uploader] JSON response was empty.');
            }
            return response.data;
        } catch (error: any) {
            console.error('[Uploader] Failed to fetch detailed JSON:', error.message);
            if (error.response) {
                console.error('[Uploader] Response status:', error.response.status);
                console.error('[Uploader] Response data:', JSON.stringify(error.response.data));
            }
            return null;
        }
    }
}
