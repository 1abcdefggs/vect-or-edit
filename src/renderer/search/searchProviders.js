import { STORAGE_KEYS, DEFAULTS } from '../core/constants.js';
import { isApiKeyConfigured } from '../core/apiKeyStore.js';
import { canUseLlm } from '../core/aiAccess.js';
import { t } from '../core/i18n.js';

export async function fetchAiSuggestions(query, provider) {
  // The LLM switch is the power for every cloud call (ADR-11): off means no request leaves the app
  if (!canUseLlm()) return null;
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
            insertText: geminiRes.text,
            provider: 'Google Gemini'
          };
        }
      }
    }

    if (provider === 'openai') {
      const model = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
      if (window.engineAPI && window.engineAPI.openaiSemanticSuggest && isApiKeyConfigured('openai')) {
        const prompt = `Analyze this query/phrase and suggest the best matching domain definitions or structured draft:\nQuery: "${query}"`;
        const openaiRes = await window.engineAPI.openaiSemanticSuggest({ prompt, model });
        if (openaiRes && openaiRes.success && openaiRes.text) {
          return {
            id: 'openai-ai-suggestion',
            name: `OpenAI (${model}) Suggestion`,
            score: 0.99,
            description: openaiRes.text,
            insertText: openaiRes.text,
            provider: 'OpenAI'
          };
        }
      }
    }

    if (provider === 'claude') {
      const model = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
      if (window.engineAPI && window.engineAPI.claudeSemanticSuggest && isApiKeyConfigured('claude')) {
        const prompt = `Analyze this query/phrase and suggest the best matching domain definitions or structured draft:\nQuery: "${query}"`;
        const claudeRes = await window.engineAPI.claudeSemanticSuggest({ prompt, model });
        if (claudeRes && claudeRes.success && claudeRes.text) {
          return {
            id: 'claude-ai-suggestion',
            name: `Claude (${model.includes('haiku') ? 'Haiku' : 'Sonnet'}) Suggestion`,
            score: 0.99,
            description: claudeRes.text,
            insertText: claudeRes.text,
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

export async function queryLlmChat(prompt, userProvider = null) {
  if (!canUseLlm()) return { error: t('llm_off_hint') };
  const provider = userProvider || localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || 'gemini';
  try {
    // Keys stay in the main process; each request uses the stored key of its provider.
    if (provider === 'gemini') {
      const model = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
      if (window.engineAPI?.geminiSemanticSuggest) {
        const res = await window.engineAPI.geminiSemanticSuggest({ prompt, model });
        if (res && res.success && res.text) return { text: res.text, model: `Gemini (${model})` };
        if (res && res.error) throw new Error(res.error);
      }
    } else if (provider === 'openai') {
      const model = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
      if (window.engineAPI?.openaiSemanticSuggest) {
        const res = await window.engineAPI.openaiSemanticSuggest({ prompt, model });
        if (res && res.success && res.text) return { text: res.text, model: `OpenAI (${model})` };
        if (res && res.error) throw new Error(res.error);
      }
    } else if (provider === 'claude') {
      const model = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
      if (window.engineAPI?.claudeSemanticSuggest) {
        const res = await window.engineAPI.claudeSemanticSuggest({ prompt, model });
        if (res && res.success && res.text) return { text: res.text, model: `Claude (${model})` };
        if (res && res.error) throw new Error(res.error);
      }
    }
  } catch (e) {
    return { error: e.message || 'Failed to query LLM provider' };
  }
  return { error: 'No active LLM provider configured. Please check API Key in Settings.' };
}
