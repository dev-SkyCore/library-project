import { icons } from '../icons.js';
import { escapeHtml } from '../utils.js';

// Модальное окно с формой. onSubmit получает значения полей;
// если он бросает ошибку, её текст показывается внутри окна.
export function openDialog({ title, content, submitLabel, tone, onSubmit, onOpen }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog';
  dialog.innerHTML = `
    <form class="dialog__form" novalidate>
      <header class="dialog__header">
        <h2 class="dialog__title">${escapeHtml(title)}</h2>
        <button class="icon-btn" type="button" data-close aria-label="Закрыть">
          <img src="${icons.close}" alt="" />
        </button>
      </header>
      <div class="dialog__body">${content}</div>
      <p class="dialog__error" role="alert" hidden></p>
      <footer class="dialog__footer">
        <button class="btn btn--ghost" type="button" data-close>Отмена</button>
        <button class="btn btn--${tone ?? 'primary'}" type="submit">${escapeHtml(submitLabel)}</button>
      </footer>
    </form>`;

  const form = dialog.querySelector('form');
  const error = dialog.querySelector('.dialog__error');
  const submit = form.querySelector('[type="submit"]');

  const showError = (message) => {
    error.textContent = message;
    error.hidden = !message;
  };

  dialog.addEventListener('click', (event) => {
    // Клик по подложке (вне формы) или по кнопке закрытия
    if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    if (!form.checkValidity()) {
      const invalid = form.querySelector(':invalid');
      showError(invalid.dataset.error ?? invalid.validationMessage);
      invalid.focus();
      return;
    }

    submit.disabled = true;
    dialog.classList.add('is-busy');
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
      dialog.close();
    } catch (submitError) {
      showError(submitError.message);
    } finally {
      submit.disabled = false;
      dialog.classList.remove('is-busy');
    }
  });

  document.body.append(dialog);
  onOpen?.(dialog);
  dialog.showModal();
  dialog.querySelector('[autofocus]')?.focus();

  return dialog;
}

export function textField({ name, label, placeholder = '', type = 'text', attrs = '', error }) {
  return `
    <label class="field">
      <span class="field__label">${label}</span>
      <input class="field__input" type="${type}" name="${name}" placeholder="${escapeHtml(placeholder)}"
        ${error ? `data-error="${escapeHtml(error)}"` : ''} ${attrs} />
    </label>`;
}
