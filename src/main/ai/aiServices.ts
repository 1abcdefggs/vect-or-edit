import { app, net, safeStorage } from 'electron';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'node:path';

const GEMINI_KEY_FILE = 'gemini-api-key.bin';

async function loadStoredGeminiApiKey(): Promise<string | undefined> {
  if (!safeStorage.isEncryptionAvailable()) return undefined;

  try {
    const encrypted = await fs.readFile(path.join(app.getPath('userData'), GEMINI_KEY_FILE));
    return safeStorage.decryptString(encrypted);
  } catch {
    return undefined;
  }
}

export async function hasStoredGeminiApiKey(): Promise<boolean> {
  return Boolean(await loadStoredGeminiApiKey());
}

export async function saveGeminiApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) return { success: false, error: 'API key is required.' };
  if (!safeStorage.isEncryptionAvailable()) {
    return { success: false, error: 'OS secure storage is unavailable.' };
  }

  try {
    const encrypted = safeStorage.encryptString(trimmedKey);
    await fs.writeFile(path.join(app.getPath('userData'), GEMINI_KEY_FILE), encrypted);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to save Gemini API key.' };
  }
}

export async function listGeminiModels(apiKey?: string) {
  const token = apiKey?.trim() || await loadStoredGeminiApiKey();
  if (!token) throw new Error('Gemini API key is not set.');

  try {
    const ai = new GoogleGenAI({ apiKey: token });
    const models: Array<{ name: string; displayName?: string; description?: string; inputTokenLimit?: number; outputTokenLimit?: number }> = [];
    const modelPager = await ai.models.list();
    for await (const model of modelPager as any) {
      const actions = model.supportedActions || model.supportedGenerationMethods || [];
      const isGenerateContent = Array.isArray(actions) && (actions.includes('generateContent') || actions.includes('generate_content'));
      const cleanName = (model.name || '').replace(/^models\//, '');
      
      // Filter out non-gemini or non-text generation models (like embedding-only or imagen if not applicable)
      if (cleanName.includes('gemini') || isGenerateContent) {
        models.push({
          name: cleanName,
          displayName: model.displayName || cleanName,
          description: model.description || '',
          inputTokenLimit: model.inputTokenLimit,
          outputTokenLimit: model.outputTokenLimit
        });
      }
    }
    if (models.length > 0) return models;
  } catch (sdkError) {
    console.warn('[Gemini] SDK list models failed, falling back to direct REST fetch:', sdkError);
  }

  // Fallback to direct official Google Generative Language API endpoint
  return new Promise((resolve, reject) => {
    const request = net.request(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(token)}`);
    let data = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(parsed.error.message || 'Gemini API Error'));
          }
          const rawModels = parsed.models || [];
          const models = rawModels
            .filter((m: any) => {
              const methods = m.supportedGenerationMethods || m.supportedActions || [];
              return methods.includes('generateContent') && m.name.includes('gemini');
            })
            .map((m: any) => ({
              name: m.name.replace(/^models\//, ''),
              displayName: m.displayName || m.name.replace(/^models\//, ''),
              description: m.description || '',
              inputTokenLimit: m.inputTokenLimit,
              outputTokenLimit: m.outputTokenLimit
            }));
          resolve(models);
        } catch (e: any) {
          reject(new Error(`Failed to parse models response: ${e.message}`));
        }
      });
    });

    request.on('error', (err) => reject(err));
    request.end();
  });
}

export async function fetchClaudeSemanticSuggest(prompt: string, apiKey?: string, model?: string) {
  const token = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!token) {
    throw new Error('Anthropic API key is not set. Please provide it in settings or ANTHROPIC_API_KEY environment variable.');
  }

  const modelName = model || 'claude-3-5-sonnet-20240620';
  console.log(`[Main] Calling Claude API (${modelName})`);

  return new Promise<{ success: boolean; text?: string; error?: string }>((resolve) => {
    const request = net.request({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': token,
        'anthropic-version': '2023-06-01'
      }
    });

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.content?.[0]?.text || '';
            resolve({ success: true, text });
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse Anthropic response' });
          }
        } else {
          resolve({ success: false, error: `Anthropic API Error: ${response.statusCode} - ${data}` });
        }
      });
    });

    request.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    request.write(JSON.stringify({
      model: modelName,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    }));
    request.end();
  });
}

export async function fetchGeminiSemanticSuggest(prompt: string, apiKey?: string, model?: string) {
  const token = apiKey || await loadStoredGeminiApiKey() || process.env.GEMINI_API_KEY;
  if (!token) {
    throw new Error('Gemini API key is not set. Please provide it in settings or GEMINI_API_KEY environment variable.');
  }

  const modelName = model || 'gemini-2.5-flash';
  console.log(`[Main] Calling Gemini API (${modelName})`);
  try {
    const ai = new GoogleGenAI({ apiKey: token });
    // Use proper request format: an array of content objects with role and text parts
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    // Extract text from response, handling possible missing fields
    const text = (response && (response.text || (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0] && response.candidates[0].content.parts[0].text))) || '';
    if (!text) {
      // Return failure if Gemini returned no usable text
      return { success: false, error: 'Gemini returned empty response.' };
    }
    return { success: true, text };
  } catch (error: any) {
    return { success: false, error: error.message || 'Gemini request failed.' };
  }
}

export async function fetchOpenAISemanticSuggest(prompt: string, apiKey?: string, model?: string) {
  const token = apiKey || process.env.OPENAI_API_KEY;
  if (!token) {
    throw new Error('OpenAI API key is not set. Please provide it in settings or OPENAI_API_KEY environment variable.');
  }

  const modelName = model || 'gpt-4o-mini';
  console.log(`[Main] Calling OpenAI API (${modelName})`);

  return new Promise<{ success: boolean; text?: string; error?: string }>((resolve) => {
    const request = net.request({
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.message?.content || '';
            resolve({ success: true, text });
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse OpenAI response' });
          }
        } else {
          resolve({ success: false, error: `OpenAI API Error: ${response.statusCode} - ${data}` });
        }
      });
    });

    request.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    request.write(JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }]
    }));
    request.end();
  });
}

// ---------------------------------------------------------------------------
// LLM-as-Embedding bridge
// ---------------------------------------------------------------------------

/** Resize / pad an array to a target length. */
function resizeVector(raw: number[], size: number): number[] {
  if (raw.length === 0) return new Array(size).fill(0);
  return Array.from({ length: size }, (_, i) => raw[i % raw.length] ?? 0);
}

/** L2-normalise so cosine similarity works correctly. */
function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

/** Parse comma-separated or whitespace-separated floats from an LLM response. */
function parseFloats(text: string): number[] {
  return text
    .replace(/```[^`]*```/gs, '')   // strip markdown fences
    .replace(/[^\d.eE+,-]/g, ' ')   // keep numeric characters
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter(n => !Number.isNaN(n));
}

/**
 * fetchLLMEmbedding
 *
 * Converts text → pseudo-vector by asking an LLM to emit floats.
 * Intentionally exposed so users can compare LLM-produced vectors
 * against a proper embedding model (educational / experimental feature).
 *
 * @param text       - source text
 * @param provider   - 'gemini' | 'claude' | 'openai'
 * @param model      - model name (optional, falls back to stored default)
 * @param apiKey     - API key (optional, falls back to stored key)
 * @param dimensions - output vector length (default 64)
 */
export async function fetchLLMEmbedding(
  text: string,
  provider: 'gemini' | 'claude' | 'openai' = 'gemini',
  model?: string,
  apiKey?: string,
  dimensions = 64
): Promise<{ success: boolean; vector?: number[]; error?: string }> {
  const prompt =
    `Return exactly ${dimensions} comma-separated floating-point numbers between -1 and 1 ` +
    `that semantically represent this text. Reply with numbers only.\n\nText: "${text}"`;

  try {
    let result: { success: boolean; text?: string; error?: string };

    if (provider === 'claude') {
      result = await fetchClaudeSemanticSuggest(prompt, apiKey, model);
    } else if (provider === 'openai') {
      result = await fetchOpenAISemanticSuggest(prompt, apiKey, model);
    } else {
      result = await fetchGeminiSemanticSuggest(prompt, apiKey, model);
    }

    if (!result.success || !result.text) {
      return { success: false, error: result.error ?? 'LLM returned empty response' };
    }

    const raw = parseFloats(result.text);
    if (raw.length === 0) {
      return { success: false, error: 'LLM response contained no parseable numbers' };
    }

    const vector = l2Normalize(resizeVector(raw, dimensions));
    return { success: true, vector };

  } catch (err: any) {
    return { success: false, error: err.message ?? 'fetchLLMEmbedding failed' };
  }
}
