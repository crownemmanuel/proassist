import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface UpdateResult {
  available: boolean;
  update?: UpdateInfo;
}

/**
 * Check if an update is available
 */
export async function checkForUpdates(): Promise<UpdateResult> {
  try {
    console.log('[Updater] Checking for updates...');
    const update = await check();
    
    if (update) {
      console.log('[Updater] Update available:', {
        version: update.version,
        date: update.date,
        body: update.body,
        currentVersion: update.currentVersion,
      });
      return {
        available: true,
        update: {
          version: update.version,
          date: update.date,
          body: update.body,
        },
      };
    }
    
    console.log('[Updater] No update available - already on latest version');
    return { available: false };
  } catch (error) {
    console.error('[Updater] Failed to check for updates:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('[Updater] Error message:', error.message);
      console.error('[Updater] Error stack:', error.stack);
    }
    return { available: false };
  }
}

/**
 * Download and install an update, then relaunch the app
 */
export async function downloadAndInstallUpdate(
  onProgress?: (progress: number, total: number) => void
): Promise<boolean> {
  try {
    console.log('[Updater] Checking for update before download...');
    const update = await check();
    
    if (!update) {
      console.log('[Updater] No update available for download');
      return false;
    }

    console.log(`[Updater] Downloading update ${update.version}...`);
    
    let downloaded = 0;
    let contentLength = 0;
    
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength || 0;
          console.log(`[Updater] Download started, size: ${contentLength} bytes`);
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          if (onProgress && contentLength > 0) {
            onProgress(downloaded, contentLength);
          }
          const percent = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
          console.log(`[Updater] Download progress: ${downloaded}/${contentLength} bytes (${percent}%)`);
          break;
        case 'Finished':
          console.log('[Updater] Download finished');
          break;
      }
    });

    console.log('[Updater] Update installed successfully, relaunching app...');
    await relaunch();
    return true;
  } catch (error) {
    console.error('[Updater] Failed to download and install update:', error);
    if (error instanceof Error) {
      console.error('[Updater] Error message:', error.message);
      console.error('[Updater] Error stack:', error.stack);
    }
    return false;
  }
}

/**
 * Check for updates on app startup (silent check)
 */
export async function checkForUpdatesOnStartup(): Promise<UpdateResult> {
  // Add a small delay to avoid blocking app startup
  console.log('[Updater] Scheduling startup update check in 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('[Updater] Performing startup update check...');
  return checkForUpdates();
}
