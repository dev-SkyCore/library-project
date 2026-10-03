import {
  addVisitor,
  books,
  findBook,
  findVisitor,
  issueBook,
  returnBook,
  visitors,
} from '../data/library.js';
import { icons } from '../icons.js';
import { openDialog, textField } from '../components/dialog.js';
import { showToast } from '../components/toast.js';
import {
  actionButton,
  bindListControls,
  emptyState,
  filterGroup,
  listLayout,
  pageHeader,
  paginate,
  pagination,
  renderList,
  sortItems,
  tableHead,
} from '../components/list.js';
import { escapeHtml, formatDate, highlight, matches, normalize, plural } from '../utils.js';

const DAYS = ['день', 'дня', 'дней'];

const state = {
  query: '',
  filter: 'all',
  sort: { key: 'name', dir: 'asc' },
  page: 1,
  pageSize: 10,
  // Посетитель, строку которого нужно показать и подсветить после изменения
  revealId: null,
};

const columns = [
  { key: 'name', label: 'Посетитель', sortable: true, get: (visitor) => visitor.fullName },
  {
    key: 'count',
    label: 'На руках',
    sortable: true,
    defaultDir: 'desc',
    className: 'cell-num',
    get: (visitor) => visitor.rentals.length,
  },
  { key: 'books', label: 'Книги в пользовании', className: 'cell-wide' },
  {
    key: 'longest',
    label: 'Дольше всего',
    sortable: true,
    defaultDir: 'desc',
    className: 'cell-num',
    get: (visitor) => (visitor.rentals.length ? visitor.rentals[0].days : null),
  },
];

function header() {
  const readers = visitors.filter((visitor) => visitor.rentals.length);
  const rentedCount = readers.reduce((sum, visitor) => sum + visitor.rentals.length, 0);

  return pageHeader(
    'Посетители',
    'Читатели библиотеки и книги, которые сейчас у них на руках',
    [
      {
        value: visitors.length,
        label: plural(visitors.length, ['посетитель', 'посетителя', 'посетителей']),
      },
      { value: readers.length, label: 'читают сейчас', tone: 'success' },
      { value: rentedCount, label: 'книг на руках', tone: 'warning' },
      { value: visitors.length - readers.length, label: 'без книг' },
    ],
  );
}

function rentalItem(visitor, rental, query) {
  const { book } = rental;

  return `
    <li class="rental">
      <img class="rental__icon" src="${icons.check}" alt="" />
      <div class="rental__body">
        <a class="rental__title" href="#/books?q=${encodeURIComponent(book.title)}">${highlight(book.title, query)}</a>
        <span class="rental__author">${highlight(book.author, query)}</span>
      </div>
      <span class="rental__date" title="Дата выдачи">с ${formatDate(rental.rentalDate)}</span>
      <span class="rental__days">${rental.days} ${plural(rental.days, DAYS)}</span>
      <button class="icon-btn rental__return" type="button" data-return="${book.id}" data-visitor="${visitor.id}"
        title="Принять возврат" aria-label="Принять возврат книги «${escapeHtml(book.title)}»">
        <img src="${icons.close}" alt="" />
      </button>
    </li>`;
}

function visitorRow(visitor, query) {
  const count = visitor.rentals.length;
  const longest = count ? visitor.rentals[0].days : null;

  return `
    <tr${visitor.id === state.revealId ? ' class="is-new"' : ''}>
      <td>
        <div class="person">
          <img class="person__avatar" src="${icons.avatar}" alt="" />
          <div>
            <div class="person__name">${highlight(visitor.fullName, query)}</div>
            <div class="person__id">${visitor.id.replace('visitor_', 'Билет № ')}</div>
          </div>
        </div>
      </td>
      <td class="cell-num"><span class="counter${count ? ' is-active' : ''}">${count}</span></td>
      <td class="cell-wide">
        ${
          count
            ? `<ul class="rentals">${visitor.rentals.map((rental) => rentalItem(visitor, rental, query)).join('')}</ul>`
            : '<span class="rentals__empty muted">Нет книг на руках</span>'
        }
        <button class="link-btn" type="button" data-issue="${visitor.id}">+ Выдать книгу</button>
      </td>
      <td class="cell-num nowrap">${longest === null ? '<span class="muted">—</span>' : `${longest} ${plural(longest, DAYS)}`}</td>
    </tr>`;
}

function update(view) {
  const query = normalize(state.query.trim());
  const found = query
    ? visitors.filter(
        (visitor) =>
          matches(query, visitor.fullName) ||
          visitor.rentals.some((rental) => matches(query, rental.book.title, rental.book.author)),
      )
    : visitors;

  const withBooks = found.filter((visitor) => visitor.rentals.length);
  const filtered = {
    all: found,
    reading: withBooks,
    idle: found.filter((visitor) => !visitor.rentals.length),
  }[state.filter];

  const column = columns.find((c) => c.key === state.sort.key);
  const sorted = sortItems(filtered, column.get, state.sort.dir);

  const revealIndex = sorted.findIndex((visitor) => visitor.id === state.revealId);
  if (revealIndex !== -1) state.page = Math.floor(revealIndex / state.pageSize) + 1;

  const info = paginate(sorted, state.page, state.pageSize);
  state.page = info.page;

  const filters = filterGroup(
    [
      { value: 'all', label: 'Все', count: found.length },
      { value: 'reading', label: 'С книгами', count: withBooks.length },
      { value: 'idle', label: 'Без книг', count: found.length - withBooks.length },
    ],
    state.filter,
  );

  const content = info.total
    ? `
      <div class="table-wrap">
        <table class="table table--visitors">
          ${tableHead(columns, state.sort)}
          <tbody>${info.items.map((visitor) => visitorRow(visitor, query)).join('')}</tbody>
        </table>
      </div>
      ${pagination(info, state.pageSize)}`
    : emptyState(
        visitors.length
          ? 'Попробуйте изменить запрос: поиск идёт по ФИО, названию книги и автору.'
          : 'В базе пока нет посетителей — добавьте первого.',
      );

  renderList(view, state, { header: header(), filters, content });
  state.revealId = null;
}

function openAddVisitorDialog(view) {
  openDialog({
    title: 'Новый посетитель',
    submitLabel: 'Добавить посетителя',
    content: `
      ${textField({
        name: 'fullName',
        label: 'ФИО',
        placeholder: 'Иванов Иван Иванович',
        attrs: 'required maxlength="120" autocomplete="off" autofocus',
        error: 'Укажите ФИО посетителя',
      })}
      <p class="dialog__hint">Номер читательского билета будет присвоен автоматически.</p>`,
    onSubmit: async (values) => {
      const visitor = await addVisitor(values);
      view.querySelector('[data-search]').value = '';
      Object.assign(state, { query: '', filter: 'all', revealId: visitor.id });
      update(view);
      showToast(`Посетитель ${visitor.fullName} добавлен`);
    },
  });
}

function bookOption(book) {
  return `
    <li data-search-text="${escapeHtml(normalize(`${book.title} ${book.author}`))}">
      <label class="book-option">
        <input type="radio" name="bookId" value="${book.id}" required data-error="Выберите книгу из списка" />
        <span class="book-option__body">
          <span class="book-option__title">${escapeHtml(book.title)}</span>
          <span class="book-option__meta">${escapeHtml(book.author)} · ${book.year}</span>
        </span>
      </label>
    </li>`;
}

function openIssueDialog(view, visitorId) {
  const visitor = findVisitor(visitorId);
  const count = visitor.rentals.length;
  const available = sortItems(
    books.filter((book) => book.status === 'available'),
    (book) => book.title,
    'asc',
  );

  const picker = available.length
    ? `
      <div class="search search--compact">
        <img class="search__icon" src="${icons.search}" alt="" />
        <input class="search__input" type="search" data-picker-search placeholder="Найти книгу" autocomplete="off" autofocus />
      </div>
      <ul class="book-picker">${available.map(bookOption).join('')}</ul>
      <p class="book-picker__empty muted" hidden>Среди свободных книг ничего не найдено</p>`
    : '<p class="muted">Свободных книг сейчас нет — все экземпляры на руках.</p>';

  openDialog({
    title: 'Выдать книгу',
    submitLabel: 'Выдать',
    content: `
      <p class="dialog__lead">Читатель: <b>${escapeHtml(visitor.fullName)}</b>
        <span class="muted">· ${count} ${plural(count, ['книга', 'книги', 'книг'])} на руках</span>
      </p>
      ${picker}`,
    onOpen: (dialog) => {
      if (!available.length) {
        dialog.querySelector('[type="submit"]').disabled = true;
        return;
      }

      const items = dialog.querySelectorAll('.book-picker li');
      const empty = dialog.querySelector('.book-picker__empty');
      dialog.querySelector('[data-picker-search]').addEventListener('input', (event) => {
        const query = normalize(event.target.value.trim());
        let visible = 0;
        items.forEach((item) => {
          item.hidden = !item.dataset.searchText.includes(query);
          visible += item.hidden ? 0 : 1;
        });
        empty.hidden = visible > 0;
      });
    },
    onSubmit: async ({ bookId }) => {
      await issueBook(visitorId, bookId);
      state.revealId = visitorId;
      update(view);
      showToast(`«${findBook(bookId).title}» выдана: ${visitor.fullName}`);
    },
  });
}

function openReturnDialog(view, visitorId, bookId) {
  const visitor = findVisitor(visitorId);
  const rental = visitor.rentals.find((item) => item.bookId === bookId);

  openDialog({
    title: 'Возврат книги',
    submitLabel: 'Принять возврат',
    content: `
      <p class="dialog__lead">
        <b>${escapeHtml(visitor.fullName)}</b> возвращает книгу
        «${escapeHtml(rental.book.title)}» (${escapeHtml(rental.book.author)}).
      </p>
      <p class="dialog__hint">Книга была выдана ${formatDate(rental.rentalDate)} — ${rental.days} ${plural(rental.days, DAYS)} назад. После возврата она снова будет в наличии.</p>`,
    onSubmit: async () => {
      await returnBook(visitorId, bookId);
      state.revealId = visitorId;
      update(view);
      showToast(`«${rental.book.title}» возвращена в фонд`);
    },
  });
}

export function mountVisitorsPage(view, params) {
  if (params.q !== undefined) {
    Object.assign(state, { query: params.q, filter: 'all', page: 1 });
  }

  view.innerHTML = listLayout({
    searchPlaceholder: 'Поиск по ФИО, книге или автору',
    query: state.query,
    action: actionButton('add-visitor', 'Добавить посетителя'),
  });

  bindListControls(view, state, columns, () => update(view));

  view.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.action === 'add-visitor') {
      openAddVisitorDialog(view);
    } else if (button.dataset.issue) {
      openIssueDialog(view, button.dataset.issue);
    } else if (button.dataset.return) {
      openReturnDialog(view, button.dataset.visitor, button.dataset.return);
    }
  });

  update(view);
  return () => update(view);
}
