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

  const ai = new GoogleGenAI({ apiKey: token });
  const models = [];
  const modelPager = await ai.models.list();
  for await (const model of modelPager) {
    if (model.name && model.supportedActions?.includes('generateContent')) {
      models.push({
        name: model.name.replace(/^models\//, ''),
        displayName: model.displayName,
        description: model.description,
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit
      });
    }
  }
  return models;
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
    const response = await ai.models.generateContent({ model: modelName, contents: prompt });
    return { success: true, text: response.text || '' };
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
