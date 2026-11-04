import { backupFileName } from '../../domain/backup';
import { platform } from '../../platform';
import { appStore } from '../../store';

/** Saves a backup of this device (before signing out, deleting, or replacing data with the account's). */
export async function downloadBackup(): Promise<void> {
  const backup = await appStore.getState().exportBackup();
  await platform.files.save(backupFileName(backup), JSON.stringify(backup), 'application/json');
}
