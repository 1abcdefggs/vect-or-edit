import { net } from 'electron';

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
  const token = apiKey || process.env.GEMINI_API_KEY;
  if (!token) {
    throw new Error('Gemini API key is not set. Please provide it in settings or GEMINI_API_KEY environment variable.');
  }

  const modelName = model || 'gemini-1.5-flash';
  console.log(`[Main] Calling Gemini API (${modelName})`);

  return new Promise<{ success: boolean; text?: string; error?: string }>((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${token}`;
    const request = net.request({
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' }
    });

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            resolve({ success: true, text });
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse Gemini response' });
          }
        } else {
          resolve({ success: false, error: `Gemini API Error: ${response.statusCode} - ${data}` });
        }
      });
    });

    request.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    request.write(JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    }));
    request.end();
  });
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
