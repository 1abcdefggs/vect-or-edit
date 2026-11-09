import { mainT } from './i18n';
import { getEngine } from './engine/rustEngine';

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
      return { success: false, error: { message: mainT('error_engine_search_unavailable'), code: 'ENGINE_MISSING' } };
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
    const message = err?.message ?? String(err);
    // ADR-0005 Phase4.3: engine rejects queries from another vector space (e.g. LLM / cloud
    // embedder vs. an e5-small KB). Renderer then uses Module 0 (dictionary quickResults).
    if (/dimension mismatch/i.test(message)) {
      return { success: false, error: { message, code: 'DIMENSION_MISMATCH', fallback: 'P.scan' } };
    }
    return { success: false, error: message };
  }
}

export async function handleValidateDocument(payload: any) {
  try {
    const engine = getEngine();
    if (!engine || typeof engine.validate !== 'function') {
      return { is_valid: true, markers: [] };
    }
    const { text } = payload ?? {};
    if (typeof text !== 'string') {
      throw new TypeError('validateDocument requires text string');
    }

    // The async binding runs off the Node main thread, so a long document does not freeze the app.
    // The engine reports line numbers only; the renderer decides the column range from the model.
    const result = await engine.validate(text);

    return {
      is_valid: result.isValid ?? (result as any).is_valid,
      markers: (result.markers || []).map((m: any) => ({
        line: m.line || 1,
        message: m.message,
        severity: m.severity,
      }))
    };
  } catch (err: any) {
    console.error("[Main] Validation error:", err);
    return { is_valid: true, markers: [] };
  }
}
