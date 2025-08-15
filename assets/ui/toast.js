export function showToast(title, message, actions = []) {
  const container = document.getElementById('toast-container');
  if (!container) return () => {};

  const toast = document.createElement('div');
  toast.className = 'toast';

  const titleEl = document.createElement('div');
  titleEl.className = 'toast-title';
  titleEl.textContent = title;
  toast.appendChild(titleEl);

  if (message) {
    const msgEl = document.createElement('div');
    msgEl.textContent = message;
    toast.appendChild(msgEl);
  }

  if (actions.length) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'toast-actions';
    actions.forEach(({ label, onClick, variant }) => {
      const btn = document.createElement('button');
      btn.className = `btn ${variant === 'secondary' ? 'btn-secondary' : ''}`.trim();
      btn.textContent = label;
      btn.addEventListener('click', () => { try { onClick?.(); } finally { dismiss(); } });
      actionsEl.appendChild(btn);
    });
    toast.appendChild(actionsEl);
  }

  container.appendChild(toast);

  let timer = null;
  if (!actions.length) {
    timer = setTimeout(() => dismiss(), 4000);
  }

  function dismiss() {
    if (timer) clearTimeout(timer);
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }

  return dismiss;
}