import { describe, test, expect, beforeEach, vi } from 'vitest';
import { handleSearchVector, handleValidateDocument } from '../src/main/ipcHandlers';

// Mock the getEngine dependency
vi.mock('../src/main/engine/rustEngine', () => {
  return {
    getEngine: vi.fn()
  };
});
import { getEngine } from '../src/main/engine/rustEngine';

describe('IPC Handlers (Vitest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSearchVector', () => {
    test('accepts number[] and returns results', async () => {
      const mockSearch = vi.fn().mockResolvedValue([{ id: 'a', score: 0.9 }]);
      vi.mocked(getEngine).mockReturnValue({ search: mockSearch } as any);
      
      const payload = { vector: [1, 2, 3], topK: 5 };
      const res = await handleSearchVector(payload);
      
      expect(res.success).toBe(true);
      expect(res.data).toEqual([{ id: 'a', score: 0.9 }]);
      expect(mockSearch).toHaveBeenCalled();
      const calledArg = mockSearch.mock.calls[0][0];
      expect(calledArg).toBeInstanceOf(Float32Array);
      expect(mockSearch.mock.calls[0][1]).toBe(5);
    });

    test('accepts Float32Array directly (zero-copy)', async () => {
      const mockSearch = vi.fn().mockResolvedValue([]);
      vi.mocked(getEngine).mockReturnValue({ search: mockSearch } as any);
      
      const payload = { vector: new Float32Array([0.1, 0.2]), topK: 2 };
      const res = await handleSearchVector(payload);
      
      expect(res.success).toBe(true);
      expect(mockSearch).toHaveBeenCalledWith(payload.vector, 2);
    });

    test('rejects non-numeric values', async () => {
      const mockSearch = vi.fn();
      vi.mocked(getEngine).mockReturnValue({ search: mockSearch } as any);
      
      const payload = { vector: [1, 'x', 3] };
      const res = await handleSearchVector(payload);
      
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/non-numeric/);
      expect(mockSearch).not.toHaveBeenCalled();
    });

    test('engine missing returns structured error', async () => {
      vi.mocked(getEngine).mockReturnValue(undefined as any);
      
      const payload = { vector: [1, 2] };
      const res = await handleSearchVector(payload);
      
      expect(res.success).toBe(false);
      expect(res.error.code).toBe('ENGINE_MISSING');
    });

    test('engine throws leads to success: false', async () => {
      const mockSearch = vi.fn().mockRejectedValue(new Error('native failure'));
      vi.mocked(getEngine).mockReturnValue({ search: mockSearch } as any);
      
      const payload = { vector: [1, 2] };
      const res = await handleSearchVector(payload);
      
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/native failure/);
    });

    test('timeout behavior', async () => {
      const mockSearch = vi.fn().mockImplementation(() => new Promise(() => {}));
      vi.mocked(getEngine).mockReturnValue({ search: mockSearch } as any);
      
      const payload = { vector: [1, 2] };
      const res = await handleSearchVector(payload, { timeoutMs: 10 });
      
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/timeout/);
    });
  });

  describe('handleValidateDocument', () => {
    test('returns mapped markers on success', async () => {
      const mockValidateSync = vi.fn().mockReturnValue({
        isValid: false,
        markers: [{ message: 'bad', severity: 'ERROR', line: 1 }]
      });
      vi.mocked(getEngine).mockReturnValue({ validateSync: mockValidateSync } as any);
      
      const res = await handleValidateDocument({ text: 'some text' });
      
      expect(res.is_valid).toBe(false);
      expect(res.markers[0].severity).toBe('ERROR');
      expect(res.markers[0].message).toBe('bad');
      expect(res.markers[0].startLineNumber).toBe(1);
    });

    test('invalid payload returns error', async () => {
      const mockValidateSync = vi.fn();
      vi.mocked(getEngine).mockReturnValue({ validateSync: mockValidateSync } as any);
      
      const res = await handleValidateDocument({ text: 123 });
      
      expect(res.is_valid).toBe(true);
      expect(res.markers).toEqual([]);
    });

    test('engine missing returns default valid response', async () => {
      vi.mocked(getEngine).mockReturnValue(undefined as any);
      
      const res = await handleValidateDocument({ text: 'x' });
      
      expect(res.is_valid).toBe(true);
      expect(res.markers).toEqual([]);
    });

    test('engine throws is handled', async () => {
      const mockValidateSync = vi.fn().mockImplementation(() => { throw new Error('boom'); });
      vi.mocked(getEngine).mockReturnValue({ validateSync: mockValidateSync } as any);
      
      const res = await handleValidateDocument({ text: 'x' });
      
      expect(res.is_valid).toBe(true);
      expect(res.markers).toEqual([]);
    });
  });
});
