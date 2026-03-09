// Auto-backup system using File System Access API
// Saves to a user-chosen file every hour, loads on startup

const DB_NAME = 'inventory_backup_db';
const STORE_NAME = 'file_handles';
const HANDLE_KEY = 'backup_file_handle';
const LAST_EXPORT_KEY = 'inventory_last_auto_export';
const AUTO_EXPORT_INTERVAL = 60 * 60 * 1000; // 1 hour

// ---- IndexedDB helpers for storing file handles ----

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function clearHandle(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

// ---- File System Access API check ----

export function isFileSystemAccessSupported(): boolean {
  return 'showSaveFilePicker' in window;
}

// ---- Setup: let user pick the backup file location ----

export async function setupAutoBackup(): Promise<boolean> {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'molkom_inventory_backup.json',
      types: [{
        description: 'JSON Backup',
        accept: { 'application/json': ['.json'] },
      }],
    });
    await saveHandle(handle);
    // Do an immediate export
    await exportToHandle(handle);
    return true;
  } catch {
    // User cancelled or error
    return false;
  }
}

// ---- Disable auto-backup ----

export async function disableAutoBackup(): Promise<void> {
  await clearHandle();
  localStorage.removeItem(LAST_EXPORT_KEY);
}

// ---- Check if auto-backup is configured ----

export async function isAutoBackupConfigured(): Promise<boolean> {
  const handle = await loadHandle();
  return handle !== null;
}

// ---- Export data to the saved file handle ----

async function exportToHandle(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    // Verify we still have permission
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const requested = await handle.requestPermission({ mode: 'readwrite' });
      if (requested !== 'granted') return false;
    }

    const data = {
      exportedAt: new Date().toISOString(),
      version: 1,
      projects: JSON.parse(localStorage.getItem('inventory_projects') || '[]'),
      items: JSON.parse(localStorage.getItem('inventory_items') || '[]'),
    };

    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();

    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

// ---- Import data from the saved file handle ----

async function importFromHandle(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    const permission = await handle.queryPermission({ mode: 'read' });
    if (permission !== 'granted') {
      const requested = await handle.requestPermission({ mode: 'read' });
      if (requested !== 'granted') return false;
    }

    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.projects || !data.items) return false;

    // Only import if backup is newer than current data
    const currentProjects = JSON.parse(localStorage.getItem('inventory_projects') || '[]');
    const currentItems = JSON.parse(localStorage.getItem('inventory_items') || '[]');

    // If localStorage is empty but backup has data, import
    if (currentProjects.length === 0 && currentItems.length === 0 && (data.projects.length > 0 || data.items.length > 0)) {
      localStorage.setItem('inventory_projects', JSON.stringify(data.projects));
      localStorage.setItem('inventory_items', JSON.stringify(data.items));
      return true;
    }

    return false; // Don't overwrite existing data automatically
  } catch {
    return false;
  }
}

// ---- Run auto-export if due ----

export async function runAutoExportIfDue(): Promise<{ exported: boolean; lastExport: string | null }> {
  const handle = await loadHandle();
  if (!handle) return { exported: false, lastExport: null };

  const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
  const lastExportTime = lastExport ? new Date(lastExport).getTime() : 0;
  const now = Date.now();

  if (now - lastExportTime >= AUTO_EXPORT_INTERVAL) {
    const success = await exportToHandle(handle);
    return {
      exported: success,
      lastExport: success ? new Date().toISOString() : lastExport,
    };
  }

  return { exported: false, lastExport };
}

// ---- Try to import on startup (only if localStorage is empty) ----

export async function tryAutoImportOnStartup(): Promise<boolean> {
  const handle = await loadHandle();
  if (!handle) return false;
  return importFromHandle(handle);
}

// ---- Start the auto-export interval timer ----

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startAutoExportTimer(): () => void {
  if (intervalId) clearInterval(intervalId);

  // Run immediately on start
  runAutoExportIfDue();

  // Then check every 5 minutes if an export is due
  intervalId = setInterval(() => {
    runAutoExportIfDue();
  }, 5 * 60 * 1000);

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

// ---- Get last export time for display ----

export function getLastExportTime(): string | null {
  return localStorage.getItem(LAST_EXPORT_KEY);
}
