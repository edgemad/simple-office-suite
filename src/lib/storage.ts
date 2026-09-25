import { autoSaveSnapshotNative, readAutoSaveSnapshotNative } from './tauri';

export interface AutoSavePayload {
  id: string;
  module: string;
  timestamp: string;
  data: unknown;
}

class AutoSaveEngine {
  private timers: Map<string, number> = new Map();

  scheduleAutoSave(module: string, documentId: string, data: unknown, delayMs: number = 1000) {
    const key = `${module}:${documentId}`;
    if (this.timers.has(key)) {
      window.clearTimeout(this.timers.get(key));
    }

    const timer = window.setTimeout(async () => {
      try {
        const payload: AutoSavePayload = {
          id: documentId,
          module,
          timestamp: new Date().toISOString(),
          data,
        };
        await autoSaveSnapshotNative(module, documentId, JSON.stringify(payload));
      } catch (err) {
        console.warn('Autosave snapshot failed:', err);
      } finally {
        this.timers.delete(key);
      }
    }, delayMs);

    this.timers.set(key, timer);
  }

  async recoverLatestSnapshot(module: string, documentId: string): Promise<AutoSavePayload | null> {
    try {
      const raw = await readAutoSaveSnapshotNative(module, documentId);
      if (!raw) return null;
      return JSON.parse(raw) as AutoSavePayload;
    } catch (err) {
      console.warn('Failed to parse autosave snapshot:', err);
      return null;
    }
  }
}

export const autoSaver = new AutoSaveEngine();
