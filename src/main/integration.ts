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

        const safeDir = path.join(os.homedir(), 'Applications');
        const currentDir = path.dirname(this.appImage);
        let targetAppImage = this.appImage;

        // Check if we are already in the safe directory
        // We normalize paths to be safe
        if (path.resolve(currentDir) !== path.resolve(safeDir)) {
            const response = await dialog.showMessageBox({
                type: 'question',
                buttons: ['Yes, Install', 'No, Run Portable'],
                defaultId: 0,
                title: 'Install Application',
                message: 'Do you want to install this application to your ~/Applications folder?',
                detail: 'Installing ensures the application remains available even if you clear your downloads. It will also add it to your application menu.'
            });

            if (response.response === 0) {
                try {
                    // Create ~/Applications if it doesn't exist
                    if (!fs.existsSync(safeDir)) {
                        fs.mkdirSync(safeDir, { recursive: true });
                    }

                    // We use a fixed name for the installed AppImage to avoid multiple versions cluttering the directory
                    // and to ensure the desktop shortcut always points to the latest installed version.
                    const fileName = `${this.appName}.AppImage`;
                    const destPath = path.join(safeDir, fileName);

                    console.log(`[Integration] Copying ${this.appImage} to ${destPath}`);

                    // Remove existing file if it exists to ensure clean replacement (though copyFileSync overwrites)
                    if (fs.existsSync(destPath)) {
                        try {
                            fs.unlinkSync(destPath);
                        } catch (e) {
                            console.error('[Integration] Failed to remove existing AppImage before update:', e);
                        }
                    }

                    fs.copyFileSync(this.appImage, destPath);
                    fs.chmodSync(destPath, 0o755); // Make executable

                    targetAppImage = destPath;

                    await dialog.showMessageBox({
                        type: 'info',
                        title: 'Installation Complete',
                        message: `The application has been copied to ${safeDir}. \n\nThe next time you launch it from your menu, it will use the installed version.`
                    });

                } catch (err: any) {
                    console.error('[Integration] Failed to copy AppImage:', err);
                    await dialog.showMessageBox({
                        type: 'error',
                        title: 'Installation Failed',
                        message: 'Could not copy application to install folder: ' + err.message
                    });
                    // Fallback to pointing to the current location so at least it runs
                }
            }
        }

        // Now proceed with desktop integration pointing to 'targetAppImage'
        const desktopFile = path.join(os.homedir(), '.local', 'share', 'applications', `appimagekit-${this.appName}.desktop`);
        let needsIntegration = true;

        if (fs.existsSync(desktopFile)) {
            try {
                const content = fs.readFileSync(desktopFile, 'utf-8');
                if (content.includes(`Exec="${targetAppImage}"`)) {
                    console.log('[Integration] Already integrated correctly.');
                    needsIntegration = false;
                }
            } catch (e) {
                console.error('[Integration] Error reading existing desktop file', e);
            }
        }

        if (needsIntegration) {
            // If we just installed it, we definitely want to integrate it (create menu item)
            // If we didn't install (portable), we might ask user if they want a menu item?
            // But simpler to just do it if we installed, or if user explicitly wants it.

            // If we moved it, we definitely do it. Use 'targetAppImage'
            if (targetAppImage !== this.appImage) {
                // Implicitly integrate if we moved it
                this.performIntegration(desktopFile, targetAppImage);
            } else {
                // We didn't move it. Ask if they want a menu shortcut anyway.
                const response = await dialog.showMessageBox({
                    type: 'question',
                    buttons: ['Yes', 'No'],
                    defaultId: 0,
                    title: 'Desktop Integration',
                    message: 'Do you want to add this application to your applications menu?',
                    detail: 'This will allow you to search for it in your launcher.'
                });

                if (response.response === 0) {
                    this.performIntegration(desktopFile, targetAppImage);
                }
            }
        }
    }

    private async performIntegration(desktopFile: string, targetAppImage: string) {
        try {
            this.createDesktopFile(desktopFile, targetAppImage);
            this.installIcon();

            const shareDir = path.join(os.homedir(), '.local', 'share');
            exec(`update-desktop-database "${path.join(shareDir, 'applications')}"`, (error) => {
                if (error) console.error('[Integration] Failed to update desktop database:', error);
            });

            // Only show success message if we didn't just show an installation success message? 
            // Or maybe just show it.
            // Let's keep it simple and silent unless error, or maybe a small notification if possible?
            // The previous code showed a dialog.

            // If we blindly moved code here, we might lose the dialog.
            // Let's show a dialog only if we didn't just show the "Installation Complete" dialog?
            // Actually, "Installation Complete" implies it. 
            // But let's verify.

            console.log('[Integration] Desktop integration updated.');

        } catch (err: any) {
            console.error('[Integration] Failed to integrate:', err);
            await dialog.showMessageBox({
                type: 'error',
                title: 'Integration Failed',
                message: 'Could not create desktop shortcut: ' + err.message
            });
        }
    }

    private createDesktopFile(destPath: string, appPath: string) {
        // Ensure directory exists
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const desktopContent = `[Desktop Entry]
Name=GW2 Arc Log Uploader
Exec="${appPath}" %U
Terminal=false
Type=Application
Icon=appimagekit-${this.appName}
StartupWMClass=${this.appName}
X-AppImage-Version=${app.getVersion()}
Comment=Guild Wars 2 arcDPS Log Uploader
Categories=Utility;
TryExec=${appPath}
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
