// Shared actions for opening external links and the LLM chat. Context menus and editor shortcuts both use these,
// so the URL format and the event name live in one place.

export function openExternalUrl(url) {
  if (window.engineAPI?.openExternal) window.engineAPI.openExternal(url);
  else window.open(url, '_blank');
}

export function openGoogleSearch(query) {
  openExternalUrl(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`);
}

export function openLlmChat(prompt) {
  window.dispatchEvent(new CustomEvent('app:openLlmChat', { detail: { prompt } }));
}
