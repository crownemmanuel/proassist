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
    const update = await check();
    
    if (update) {
      return {
        available: true,
        update: {
          version: update.version,
          date: update.date,
          body: update.body,
        },
      };
    }
    
    return { available: false };
  } catch (error) {
    console.error('Failed to check for updates:', error);
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
    const update = await check();
    
    if (!update) {
      console.log('No update available');
      return false;
    }

    console.log(`Downloading update ${update.version}...`);
    
    let downloaded = 0;
    let contentLength = 0;
    
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength || 0;
          console.log(`Download started, size: ${contentLength}`);
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          if (onProgress && contentLength > 0) {
            onProgress(downloaded, contentLength);
          }
          console.log(`Downloaded ${downloaded} of ${contentLength}`);
          break;
        case 'Finished':
          console.log('Download finished');
          break;
      }
    });

    console.log('Update installed, relaunching...');
    await relaunch();
    return true;
  } catch (error) {
    console.error('Failed to download and install update:', error);
    return false;
  }
}

/**
 * Check for updates on app startup (silent check)
 */
export async function checkForUpdatesOnStartup(): Promise<UpdateResult> {
  // Add a small delay to avoid blocking app startup
  await new Promise(resolve => setTimeout(resolve, 2000));
  return checkForUpdates();
}
