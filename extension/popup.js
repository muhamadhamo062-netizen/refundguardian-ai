/**
 * RefundGuardian AI — Popup (chrome.storage.local)
 */

function setStatus(el, message, kind) {
  const status = el;
  if (!status) return;
  status.textContent = message || '';
  status.classList.remove('ok', 'err');
  if (kind === 'ok') status.classList.add('ok');
  if (kind === 'err') status.classList.add('err');
}

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save');
  const tokenInput = document.getElementById('token');
  const statusEl = document.getElementById('status');

  if (!saveBtn || !tokenInput || !statusEl) {
    setStatus(statusEl, 'Popup DOM error.', 'err');
    return;
  }

  saveBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (!token) {
      setStatus(statusEl, 'Enter a token first.', 'err');
      return;
    }

    chrome.storage.local.set({ accessToken: token }, () => {
      if (chrome.runtime.lastError) {
        setStatus(statusEl, chrome.runtime.lastError.message, 'err');
        return;
      }
      setStatus(statusEl, 'Token saved.', 'ok');
      tokenInput.value = '';
      tokenInput.placeholder = 'Token saved (paste new one to replace)';
    });
  });

  chrome.storage.local.get(['accessToken'], (stored) => {
    if (chrome.runtime.lastError) {
      setStatus(statusEl, chrome.runtime.lastError.message, 'err');
      return;
    }
    if (stored.accessToken) {
      tokenInput.placeholder = 'Token saved (paste new one to replace)';
      setStatus(statusEl, 'Token loaded from storage.', 'ok');
    }
  });
});
