import type { FileFilter, SystemMetrics } from '../types';

// Check if running inside Tauri webview
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Safe invoke wrapper
async function invokeCommand<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  throw new Error(`Tauri environment not detected for command: ${cmd}`);
}

export async function readTextFileNative(path: string): Promise<string> {
  if (isTauri()) {
    return invokeCommand<string>('read_text_file', { path });
  }
  // Browser fallback: simulated local storage or memory
  const stored = localStorage.getItem(`sos_file_${path}`);
  if (stored !== null) return stored;
  throw new Error(`File not found: ${path}`);
}

export async function writeTextFileNative(
  path: string,
  contents: string
): Promise<{ success: boolean; path: string; timestamp: string }> {
  if (isTauri()) {
    return invokeCommand('write_text_file', { path, contents });
  }
  // Browser fallback
  localStorage.setItem(`sos_file_${path}`, contents);
  return {
    success: true,
    path,
    timestamp: new Date().toISOString(),
  };
}

export async function openFileDialogNative(
  title?: string,
  filters: FileFilter[] = []
): Promise<string | null> {
  if (isTauri()) {
    return invokeCommand<string | null>('open_native_file_dialog', { title, filters });
  }
  // Browser fallback using input[type=file]
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    const exts = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    if (exts) input.accept = exts;

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const fakePath = `/virtual/${file.name}`;
          localStorage.setItem(`sos_file_${fakePath}`, reader.result as string);
          resolve(fakePath);
        };
        reader.readAsText(file);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

export async function saveFileDialogNative(
  title?: string,
  defaultName?: string,
  filters: FileFilter[] = []
): Promise<string | null> {
  if (isTauri()) {
    return invokeCommand<string | null>('save_native_file_dialog', {
      title,
      defaultName,
      filters,
    });
  }
  // Browser fallback
  const chosenName = prompt('Enter filename to save:', defaultName || 'document.json');
  return chosenName ? `/virtual/${chosenName}` : null;
}

export async function autoSaveSnapshotNative(
  module: string,
  documentId: string,
  payload: string
): Promise<string> {
  if (isTauri()) {
    return invokeCommand<string>('auto_save_snapshot', {
      module,
      documentId,
      payload,
    });
  }
  // Browser fallback
  const key = `sos_autosave_${module}_${documentId}`;
  localStorage.setItem(key, payload);
  return key;
}

export async function readAutoSaveSnapshotNative(
  module: string,
  documentId: string
): Promise<string | null> {
  if (isTauri()) {
    return invokeCommand<string | null>('read_auto_save_snapshot', {
      module,
      documentId,
    });
  }
  return localStorage.getItem(`sos_autosave_${module}_${documentId}`);
}

export async function getSystemMetricsNative(): Promise<SystemMetrics> {
  if (isTauri()) {
    try {
      return await invokeCommand<SystemMetrics>('get_system_metrics');
    } catch {
      // fallback
    }
  }

  // Simulated metrics for browser testing
  return {
    platform: navigator.platform.includes('Mac') ? 'macOS' : 'Linux/Windows',
    arch: 'arm64/x64',
    memory_used_mb: 48.6,
    total_memory_mb: 16384.0,
    cpu_count: navigator.hardwareConcurrency || 8,
    is_offline: !navigator.onLine || true,
  };
}

export async function openDetachedCommunicatorNative(): Promise<void> {
  if (isTauri()) {
    try {
      await invokeCommand('open_detached_communicator');
      return;
    } catch (err) {
      console.warn('Native detached window error, opening web popup:', err);
    }
  }
  if (typeof window !== 'undefined') {
    window.open('index.html?mode=communicator', '_blank', 'width=1050,height=720');
  }
}
