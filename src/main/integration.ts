import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';

export class DesktopIntegrator {
    private appName: string;
    private appImage: string | undefined;

    constructor() {
        this.appName = app.name || 'gw2-arc-log-uploader';
        this.appImage = process.env.APPIMAGE;
    }

    public async integrate() {
        // Only run if we are in an AppImage
        if (!this.appImage) {
            console.log('[Integration] Not running as AppImage.');
            return;
        }

        // Check platform (Linux only)
        if (process.platform !== 'linux') {
            return;
        }

        const desktopFile = path.join(os.homedir(), '.local', 'share', 'applications', `appimagekit-${this.appName}.desktop`);

        let needsIntegration = true;
        // Check if we need to update the integration (e.g. AppImage moved or new version)
        if (fs.existsSync(desktopFile)) {
            try {
                const content = fs.readFileSync(desktopFile, 'utf-8');
                // Check if the Exec line points to the current AppImage
                if (content.includes(`Exec="${this.appImage}"`)) {
                    console.log('[Integration] Already integrated correctly.');
                    needsIntegration = false;
                } else {
                    console.log('[Integration] Desktop file exists but points to different location/version. Updating.');
                }
            } catch (e) {
                console.error('[Integration] Error reading existing desktop file', e);
            }
        }

        if (!needsIntegration) return;

        const response = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Yes', 'No'],
            defaultId: 0,
            title: 'Desktop Integration',
            message: 'Do you want to add this application to your applications menu?',
            detail: 'This will allow you to search for it in your launcher and pin it to your taskbar.'
        });

        if (response.response === 0) {
            try {
                this.createDesktopFile(desktopFile);
                this.installIcon();

                // Refresh desktop database and icon cache
                // We run this asynchronously and don't block
                const shareDir = path.join(os.homedir(), '.local', 'share');
                exec(`update-desktop-database "${path.join(shareDir, 'applications')}"`, (error) => {
                    if (error) console.error('[Integration] Failed to update desktop database:', error);
                    else console.log('[Integration] Desktop database updated.');
                });

                await dialog.showMessageBox({
                    type: 'info',
                    title: 'Integration Successful',
                    message: 'Application has been added to your menu. You may need to wait a moment or logout/login for it to appear.'
                });
            } catch (err: any) {
                console.error('[Integration] Failed to integrate:', err);
                await dialog.showMessageBox({
                    type: 'error',
                    title: 'Integration Failed',
                    message: 'Could not create desktop shortcut: ' + err.message
                });
            }
        }
    }

    private createDesktopFile(destPath: string) {
        // Ensure directory exists
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const desktopContent = `[Desktop Entry]
Name=GW2 Arc Log Uploader
Exec="${this.appImage}" %U
Terminal=false
Type=Application
Icon=appimagekit-${this.appName}
StartupWMClass=${this.appName}
X-AppImage-Version=${app.getVersion()}
Comment=Guild Wars 2 arcDPS Log Uploader
Categories=Utility;
TryExec=${this.appImage}
`;

        fs.writeFileSync(destPath, desktopContent, { mode: 0o755 });
        console.log(`[Integration] Created desktop file at ${destPath}`);
    }

    private installIcon() {
        // Try to extract icon from resources or use the one in the source if possible?
        // In a packaged Electron app, typically the icon is in process.resourcesPath or we can use the one from the AppImage mount.
        // process.env.APPDIR contains the mount point of the AppImage

        const appDir = process.env.APPDIR;
        if (!appDir) return;

        // Try to find the icon in the AppDir
        // Usually at $APPDIR/.DirIcon or $APPDIR/usr/share/icons/...

        let iconPath = path.join(appDir, '.DirIcon'); // Standard AppImage icon

        if (!fs.existsSync(iconPath)) {
            // Fallback to searching
            iconPath = path.join(appDir, 'usr/share/icons/hicolor/512x512/apps/gw2-arc-log-uploader.png'); // Example path
        }

        // If we can't find it easily, we might skip or try to use a bundled asset
        // Let's assume .DirIcon exists as per AppImage spec

        if (fs.existsSync(iconPath)) {
            const iconDestDir = path.join(os.homedir(), '.local', 'share', 'icons', 'hicolor', '512x512', 'apps');
            // We could resize or just copy to hicolor/512x512 assuming it's high res, or check resolution.
            // For safety/simplicity let's put it in ~/.local/share/icons

            const destDir = path.join(os.homedir(), '.local', 'share', 'icons');
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

            const destIconPath = path.join(destDir, `appimagekit-${this.appName}.png`);
            fs.copyFileSync(iconPath, destIconPath);
            console.log(`[Integration] Icon copied to ${destIconPath}`);
        } else {
            console.log('[Integration] Could not find icon in AppImage mount.');
        }
    }
}
