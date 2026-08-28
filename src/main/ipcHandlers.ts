import { getEngine } from './engine/rustEngine';
import { monitorEventLoopDelay } from 'node:perf_hooks';

// Helper: timeout wrapper
export function withTimeout<T>(p: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

export function toFloat32Array(input: unknown): Float32Array {
  if (input instanceof Float32Array) return input;
  if (Array.isArray(input)) {
    const arr = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const v = Number((input as any)[i]);
      if (Number.isNaN(v)) throw new TypeError('search vector contains non-numeric value');
      arr[i] = v;
    }
    return arr;
  }
  throw new TypeError('expected numeric array or Float32Array for vector');
}

export async function handleSearchVector(payload: any, opts?: { timeoutMs?: number }) {
  try {
    const engine = getEngine();
    if (!engine || typeof engine.search !== 'function') {
      return { success: false, error: { message: 'Engine.search unavailable', code: 'ENGINE_MISSING' } };
    }
    const { vector, topK } = payload ?? {};
    if (!vector) return { success: false, error: { message: 'missing vector', code: 'INVALID_PAYLOAD' } };
    
    const k = typeof topK === 'number' ? Math.max(0, Math.floor(topK)) : 5;
    const floatVec = toFloat32Array(vector);
    
    const defaultTimeout = parseInt(process.env.IPC_SEARCH_TIMEOUT_MS || '5000', 10);
    const timeoutMs = opts?.timeoutMs || defaultTimeout;
    
    const p = engine.search(floatVec, k);
    const results = await withTimeout(p, timeoutMs);
    
    return { success: true, data: results };
  } catch (err: any) {
    return { success: false, error: err.message ?? String(err) };
  }
}

export async function handleValidateDocument(payload: any) {
  try {
    const engine = getEngine();
    if (!engine || typeof engine.validateSync !== 'function') {
      return { is_valid: true, markers: [] };
    }
    const { text } = payload ?? {};
    if (typeof text !== 'string') {
      throw new TypeError('validateDocument requires text string');
    }
    
    const monitor = monitorEventLoopDelay({ resolution: 10 });
    monitor.enable();
    
    const result = engine.validateSync(text);
    
    monitor.disable();
    // Monitor returns nanoseconds. 200,000,000 ns = 200ms
    if (monitor.mean > 200_000_000) {
      console.warn(`[Main] ALERT: validateSync blocked the event loop for ${Math.round(monitor.mean / 1_000_000)}ms`);
    }
    
    return {
      is_valid: result.isValid ?? (result as any).is_valid,
      markers: (result.markers || []).map((m: any) => ({
        message: m.message,
        severity: m.severity || 'error',
        startLineNumber: m.line || 1,
        startColumn: 1,
        endLineNumber: m.line || 1,
        endColumn: 50,
      }))
    };
  } catch (err: any) {
    console.error("[Main] Validation error:", err);
    return { is_valid: true, markers: [] };
  }
}
