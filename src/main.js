import './fonts/ys-display/fonts.css';
import './style.css';

import { books, loadLibrary, onChange, visitors } from './data/library.js';
import { icons } from './icons.js';
import { mountBooksPage } from './pages/books.js';
import { mountVisitorsPage } from './pages/visitors.js';
import { escapeHtml } from './utils.js';

const DEFAULT_ROUTE = '/books';

const routes = {
  '/books': { title: 'Книги', mount: mountBooksPage },
  '/visitors': { title: 'Посетители', mount: mountVisitorsPage },
};

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="app-header">
    <div class="container app-header__inner">
      <a class="logo" href="#${DEFAULT_ROUTE}">
        <span class="logo__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2Z" />
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19" />
            <path d="M9 7h6" />
          </svg>
        </span>
        <span class="logo__text">Библиотека</span>
      </a>
      <nav class="nav" aria-label="Разделы">
        <a class="nav__link" href="#/books" data-route="/books">
          Книги<span class="nav__count" data-count="books">…</span>
        </a>
        <a class="nav__link" href="#/visitors" data-route="/visitors">
          Посетители<span class="nav__count" data-count="visitors">…</span>
        </a>
      </nav>
    </div>
  </header>
  <main class="container app-main"></main>
`;

const main = app.querySelector('.app-main');
const navLinks = app.querySelectorAll('[data-route]');

let ready = false;
let updateCurrentPage = null;

function parseHash() {
  const [path, search = ''] = location.hash.slice(1).split('?');
  return { path: path || DEFAULT_ROUTE, params: Object.fromEntries(new URLSearchParams(search)) };
}

function showStatus(html) {
  updateCurrentPage = null;
  const view = document.createElement('section');
  view.className = 'view';
  view.innerHTML = html;
  main.replaceChildren(view);
  return view;
}

function render() {
  const { path, params } = parseHash();
  const route = routes[path];

  if (!route) {
    location.replace(`#${DEFAULT_ROUTE}`);
    return;
  }

  navLinks.forEach((link) => {
    const active = link.dataset.route === path;
    link.classList.toggle('is-active', active);
    link.toggleAttribute('aria-current', active);
  });

  document.title = `${route.title} — Библиотека`;

  // Пока данные не загружены, параметры остаются в адресе и применятся после загрузки
  if (!ready) return;

  // Параметр поиска из ссылки применяем один раз и убираем из адреса
  if (Object.keys(params).length) {
    history.replaceState(null, '', `#${path}`);
  }

  // Новый контейнер на каждый переход, чтобы не копить обработчики событий
  const view = document.createElement('section');
  view.className = 'view';
  main.replaceChildren(view);
  updateCurrentPage = route.mount(view, params);
  window.scrollTo(0, 0);
}

onChange(() => {
  app.querySelector('[data-count="books"]').textContent = books.length;
  app.querySelector('[data-count="visitors"]').textContent = visitors.length;
  updateCurrentPage?.();
});

async function start() {
  showStatus(`
    <div class="status">
      <span class="spinner" aria-hidden="true"></span>
      <p class="status__title">Загружаем данные из базы…</p>
    </div>`);

  try {
    await loadLibrary();
    ready = true;
    render();
  } catch (error) {
    const view = showStatus(`
      <div class="status status--error">
        <img class="status__icon" src="${icons.stop}" alt="" />
        <p class="status__title">Не удалось загрузить данные</p>
        <p class="status__text">${escapeHtml(error.message)}</p>
        <button class="btn btn--primary" type="button" data-retry>Повторить</button>
      </div>`);
    view.querySelector('[data-retry]').addEventListener('click', start);
  }
}

window.addEventListener('hashchange', render);
render();
start();
