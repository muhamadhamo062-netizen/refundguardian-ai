document.getElementById('save').addEventListener('click', () => {
  const token = document.getElementById('token').value.trim();
  const status = document.getElementById('status');
  if (!token) {
    status.textContent = 'Enter a token first.';
    status.style.color = '#f87171';
    return;
  }
  chrome.storage.local.set({ accessToken: token }, () => {
    status.textContent = 'Token saved.';
    status.style.color = '#22c55e';
  });
});

chrome.storage.local.get(['accessToken'], (stored) => {
  if (stored.accessToken) {
    document.getElementById('token').placeholder = 'Token saved (paste new one to replace)';
  }
});
