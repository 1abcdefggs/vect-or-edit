/**
 * Shared API key input field component.
 * Handles password toggle, visibility icon, and input state display.
 */

export function initApiKeyInput(fieldSelector, inputId, toggleBtnId) {
  const field = document.querySelector(fieldSelector);
  if (!field) return;

  const input = document.getElementById(inputId);
  const toggleBtn = document.getElementById(toggleBtnId);

  if (!input || !toggleBtn) return;

  // Update visibility icon state on toggle
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    const icon = toggleBtn.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.textContent = isPassword ? 'visibility' : 'visibility_off';
    }
  });

  // Optional: Update state indicator when input changes
  input.addEventListener('input', () => {
    updateKeyInputState(field, input);
  });

  // Initialize state on load
  updateKeyInputState(field, input);
}

function updateKeyInputState(field, input) {
  const hasValue = input.value.trim().length > 0;

  // Remove/add a visual indicator if needed
  // This is a hook for future "saved" or "validated" states
  if (hasValue) {
    field.classList.add('api-key-field--has-value');
  } else {
    field.classList.remove('api-key-field--has-value');
  }
}
