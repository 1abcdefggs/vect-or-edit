import { STORAGE_KEYS, DEFAULTS } from '../core/constants.js';

export async function fetchAiSuggestions(query, provider) {
  if (!provider) {
    provider = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || DEFAULTS.AI_PROVIDER;
  }

  try {
    if (provider === 'gemini') {
      const model = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
      if (window.engineAPI && window.engineAPI.geminiSemanticSuggest) {
        const prompt = `Analyze this query/phrase and suggest the best matching domain definitions or structured draft:\nQuery: "${query}"`;
        const geminiRes = await window.engineAPI.geminiSemanticSuggest({ prompt, model });
        if (geminiRes && geminiRes.success && geminiRes.text) {
          return {
            id: 'gemini-ai-suggestion',
            name: `Gemini (${model.replace('gemini-', '')}) Suggestion`,
            score: 0.99,
            description: geminiRes.text,
            provider: 'Google Gemini'
          };
        }
      }
    }

    if (provider === 'openai') {
      const apiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY);
      const model = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
      if (window.engineAPI && window.engineAPI.openaiSemanticSuggest && apiKey) {
        const prompt = `Analyze this query/phrase and suggest the best matching domain definitions or structured draft:\nQuery: "${query}"`;
        const openaiRes = await window.engineAPI.openaiSemanticSuggest({ prompt, apiKey, model });
        if (openaiRes && openaiRes.success && openaiRes.text) {
          return {
            id: 'openai-ai-suggestion',
            name: `OpenAI (${model}) Suggestion`,
            score: 0.99,
            description: openaiRes.text,
            provider: 'OpenAI'
          };
        }
      }
    }

    if (provider === 'claude') {
      const apiKey = localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY);
      const model = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
      if (window.engineAPI && window.engineAPI.claudeSemanticSuggest && apiKey) {
        const prompt = `Analyze this query/phrase and suggest the best matching domain definitions or structured draft:\nQuery: "${query}"`;
        const claudeRes = await window.engineAPI.claudeSemanticSuggest({ prompt, apiKey, model });
        if (claudeRes && claudeRes.success && claudeRes.text) {
          return {
            id: 'claude-ai-suggestion',
            name: `Claude (${model.includes('haiku') ? 'Haiku' : 'Sonnet'}) Suggestion`,
            score: 0.99,
            description: claudeRes.text,
            provider: 'Anthropic Claude'
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[searchProviders] Error fetching suggestion from ${provider}:`, err);
  }
  return null;
}
