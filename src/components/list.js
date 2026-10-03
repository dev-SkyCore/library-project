import { icons } from '../icons.js';
import { escapeHtml } from '../utils.js';

export const PAGE_SIZES = [10, 20, 50];

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

const isEmpty = (value) => value === null || value === undefined || value === '';

// Пустые значения всегда уходят в конец списка, независимо от направления
export function sortItems(items, getValue, dir) {
  const factor = dir === 'desc' ? -1 : 1;

  return [...items].sort((a, b) => {
    const x = getValue(a);
    const y = getValue(b);
    if (isEmpty(x) || isEmpty(y)) return isEmpty(x) - isEmpty(y);

    const result = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(x, y);
    return result * factor;
  });
}

export function paginate(items, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: current,
    totalPages,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
  };
}

// [1, null, 4, 5, 6, null, 10] — null означает пропуск «…»
function pageNumbers(page, totalPages) {
  const visible = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  return visible.flatMap((p, i) => {
    const gap = i > 0 ? p - visible[i - 1] : 1;
    if (gap === 1) return [p];
    return gap === 2 ? [p - 1, p] : [null, p];
  });
}

function pageButton(page, icon, label, disabled) {
  return `
    <button class="icon-btn" type="button" data-page="${page}" aria-label="${label}" title="${label}" ${disabled ? 'disabled' : ''}>
      <img src="${icon}" alt="" />
    </button>`;
}

export function pagination(info, pageSize) {
  const { page, totalPages, total, from, to } = info;

  const numbers = pageNumbers(page, totalPages)
    .map((p) =>
      p === null
        ? '<span class="pagination__gap">…</span>'
        : `<button class="pagination__page${p === page ? ' is-active' : ''}" type="button" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`,
    )
    .join('');

  return `
    <div class="pagination">
      <div class="pagination__info">Показано <b>${from}–${to}</b> из <b>${total}</b></div>
      <nav class="pagination__pages" aria-label="Страницы">
        ${pageButton(1, icons.chevronsLeft, 'Первая страница', page === 1)}
        ${pageButton(page - 1, icons.left, 'Предыдущая страница', page === 1)}
        ${numbers}
        ${pageButton(page + 1, icons.right, 'Следующая страница', page === totalPages)}
        ${pageButton(totalPages, icons.chevronsRight, 'Последняя страница', page === totalPages)}
      </nav>
      <label class="pagination__size">
        На странице
        <select class="select" data-page-size>
          ${PAGE_SIZES.map((size) => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`).join('')}
        </select>
      </label>
    </div>`;
}

export function searchField(placeholder, value) {
  return `
    <div class="search">
      <img class="search__icon" src="${icons.search}" alt="" />
      <input class="search__input" type="search" data-search placeholder="${escapeHtml(placeholder)}"
        value="${escapeHtml(value)}" autocomplete="off" aria-label="${escapeHtml(placeholder)}" />
      <button class="icon-btn search__clear" type="button" data-clear-search aria-label="Очистить поиск" ${value ? '' : 'hidden'}>
        <img src="${icons.close}" alt="" />
      </button>
    </div>`;
}

export function filterGroup(options, value) {
  const items = options
    .map(
      (option) => `
        <button class="segmented__item${option.value === value ? ' is-active' : ''}" type="button"
          data-filter="${option.value}" aria-pressed="${option.value === value}">
          ${option.label}<span class="segmented__count">${option.count}</span>
        </button>`,
    )
    .join('');

  return `
    <div class="segmented" role="group" aria-label="Фильтр">
      <img class="segmented__icon" src="${icons.filter}" alt="" />
      ${items}
    </div>`;
}

export function tableHead(columns, sort) {
  const cells = columns.map((column) => {
    const className = column.className ? ` class="${column.className}"` : '';
    if (!column.sortable) return `<th${className}>${column.label}</th>`;

    const active = sort.key === column.key;
    const icon = active ? (sort.dir === 'asc' ? icons.arrowUp : icons.arrowDown) : icons.sort;
    const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';

    return `
      <th${className} aria-sort="${ariaSort}">
        <button class="th-sort${active ? ' is-active' : ''}" type="button" data-sort="${column.key}">
          ${column.label}<img class="th-sort__icon" src="${icon}" alt="" />
        </button>
      </th>`;
  });

  return `<thead><tr>${cells.join('')}</tr></thead>`;
}

export function emptyState(text) {
  return `
    <div class="empty">
      <img class="empty__icon" src="${icons.stop}" alt="" />
      <p class="empty__title">Ничего не найдено</p>
      <p class="empty__text">${text}</p>
      <button class="btn" type="button" data-reset>
        <img src="${icons.clear}" alt="" />Сбросить фильтры
      </button>
    </div>`;
}

export function pageHeader(title, subtitle, stats) {
  const cards = stats
    .map(
      (stat) => `
        <div class="stat${stat.tone ? ` stat--${stat.tone}` : ''}">
          <span class="stat__value">${stat.value}</span>
          <span class="stat__label">${stat.label}</span>
        </div>`,
    )
    .join('');

  return `
    <header class="page-header">
      <div>
        <h1 class="page-header__title">${title}</h1>
        <p class="page-header__subtitle">${subtitle}</p>
      </div>
      <div class="stats">${cards}</div>
    </header>`;
}

// Общая обработка событий списка: поиск, фильтр, сортировка, пагинация.
// state: { query, filter, sort: { key, dir }, page, pageSize }
export function bindListControls(view, state, columns, update) {
  const input = view.querySelector('[data-search]');

  const apply = (changes, { resetPage = true } = {}) => {
    Object.assign(state, changes, resetPage ? { page: 1 } : {});
    update();
  };

  input.addEventListener('input', () => apply({ query: input.value }));

  view.addEventListener('change', (event) => {
    if (event.target.matches('[data-page-size]')) {
      apply({ pageSize: Number(event.target.value) });
    }
  });

  view.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target || target.disabled) return;

    if (target.matches('[data-clear-search]')) {
      input.value = '';
      input.focus();
      apply({ query: '' });
    } else if (target.matches('[data-reset]')) {
      input.value = '';
      apply({ query: '', filter: 'all' });
    } else if (target.dataset.filter) {
      apply({ filter: target.dataset.filter });
    } else if (target.dataset.sort) {
      const key = target.dataset.sort;
      const column = columns.find((c) => c.key === key);
      const dir =
        state.sort.key === key
          ? state.sort.dir === 'asc'
            ? 'desc'
            : 'asc'
          : (column.defaultDir ?? 'asc');
      apply({ sort: { key, dir } });
    } else if (target.dataset.page) {
      apply({ page: Number(target.dataset.page) }, { resetPage: false });
      view.querySelector('.card')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

export function actionButton(action, label) {
  return `
    <button class="btn btn--primary" type="button" data-action="${action}">
      <span class="btn__plus" aria-hidden="true">+</span>${label}
    </button>`;
}

// Общий каркас страницы-списка
export function listLayout({ searchPlaceholder, query, action }) {
  return `
    <div data-header></div>
    <div class="toolbar">
      ${searchField(searchPlaceholder, query)}
      <div class="toolbar__side">
        <div data-filters></div>
        ${action}
      </div>
    </div>
    <div class="card" data-results></div>`;
}

export function renderList(view, state, { header, filters, content }) {
  view.querySelector('[data-header]').innerHTML = header;
  view.querySelector('[data-filters]').innerHTML = filters;
  view.querySelector('[data-results]').innerHTML = content;
  view.querySelector('[data-clear-search]').hidden = !state.query;
}
