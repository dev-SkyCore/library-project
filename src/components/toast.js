import { icons } from '../icons.js';
import { escapeHtml } from '../utils.js';

const TOAST_DURATION = 3500;

let container;

export function showToast(message) {
  container ??= document.body.appendChild(
    Object.assign(document.createElement('div'), { className: 'toasts' }),
  );

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<img src="${icons.check}" alt="" /><span>${escapeHtml(message)}</span>`;
  container.append(toast);

  setTimeout(() => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, TOAST_DURATION);
}
