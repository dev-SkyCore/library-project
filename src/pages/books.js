import { addBook, BOOK_STATUS, books } from '../data/library.js';
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
import { formatDate, highlight, matches, normalize, plural } from '../utils.js';

const state = {
  query: '',
  filter: 'all',
  sort: { key: 'title', dir: 'asc' },
  page: 1,
  pageSize: 10,
  // Книга, которую нужно показать и подсветить после добавления
  revealId: null,
};

const columns = [
  { key: 'title', label: 'Название', sortable: true, get: (book) => book.title },
  { key: 'author', label: 'Автор', sortable: true, get: (book) => book.author },
  {
    key: 'year',
    label: 'Год издания',
    sortable: true,
    className: 'cell-num',
    get: (book) => book.year,
  },
  {
    key: 'addedDate',
    label: 'Поступила',
    sortable: true,
    defaultDir: 'desc',
    get: (book) => book.addedDate,
  },
  { key: 'status', label: 'Статус', sortable: true, get: (book) => book.status },
  { key: 'reader', label: 'Читатель', sortable: true, get: (book) => book.reader?.fullName },
];

function header() {
  const rentedCount = books.filter((book) => book.status === 'rented').length;
  const authorsCount = new Set(books.map((book) => book.author)).size;

  return pageHeader('Книги', 'Фонд библиотеки: наличие и выданные экземпляры', [
    { value: books.length, label: plural(books.length, ['книга', 'книги', 'книг']) },
    { value: books.length - rentedCount, label: 'в наличии', tone: 'success' },
    {
      value: rentedCount,
      label: plural(rentedCount, ['выдана', 'выданы', 'выдано']),
      tone: 'warning',
    },
    { value: authorsCount, label: plural(authorsCount, ['автор', 'автора', 'авторов']) },
  ]);
}

function readerCell(book, query) {
  if (!book.reader) return '<span class="muted">—</span>';

  return `
    <a class="reader" href="#/visitors?q=${encodeURIComponent(book.reader.fullName)}">
      <img class="reader__avatar" src="${icons.avatar}" alt="" />
      <span>
        <span class="reader__name">${highlight(book.reader.fullName, query)}</span>
        ${book.rentalDate ? `<span class="reader__meta">с ${formatDate(book.rentalDate)}</span>` : ''}
      </span>
    </a>`;
}

function bookRow(book, query) {
  return `
    <tr${book.id === state.revealId ? ' class="is-new"' : ''}>
      <td><span class="book-title">${highlight(book.title, query)}</span></td>
      <td>${highlight(book.author, query)}</td>
      <td class="cell-num">${book.year}</td>
      <td class="nowrap">${formatDate(book.addedDate)}</td>
      <td><span class="badge badge--${book.status}">${BOOK_STATUS[book.status]}</span></td>
      <td>${readerCell(book, query)}</td>
    </tr>`;
}

function update(view) {
  const query = normalize(state.query.trim());
  const found = query
    ? books.filter((book) => matches(query, book.title, book.author, book.reader?.fullName))
    : books;
  const filtered =
    state.filter === 'all' ? found : found.filter((book) => book.status === state.filter);

  const column = columns.find((c) => c.key === state.sort.key);
  const sorted = sortItems(filtered, column.get, state.sort.dir);

  const revealIndex = sorted.findIndex((book) => book.id === state.revealId);
  if (revealIndex !== -1) state.page = Math.floor(revealIndex / state.pageSize) + 1;

  const info = paginate(sorted, state.page, state.pageSize);
  state.page = info.page;

  const countBy = (status) => found.filter((book) => book.status === status).length;
  const filters = filterGroup(
    [
      { value: 'all', label: 'Все', count: found.length },
      { value: 'available', label: 'В наличии', count: countBy('available') },
      { value: 'rented', label: 'Выданы', count: countBy('rented') },
    ],
    state.filter,
  );

  const content = info.total
    ? `
      <div class="table-wrap">
        <table class="table">
          ${tableHead(columns, state.sort)}
          <tbody>${info.items.map((book) => bookRow(book, query)).join('')}</tbody>
        </table>
      </div>
      ${pagination(info, state.pageSize)}`
    : emptyState(
        books.length
          ? 'Попробуйте изменить поисковый запрос или фильтр по статусу.'
          : 'В базе пока нет книг — добавьте первую.',
      );

  renderList(view, state, { header: header(), filters, content });
  state.revealId = null;
}

function openAddBookDialog(view) {
  const currentYear = new Date().getFullYear();

  openDialog({
    title: 'Новая книга',
    submitLabel: 'Добавить книгу',
    content: `
      ${textField({
        name: 'title',
        label: 'Название',
        placeholder: 'Мастер и Маргарита',
        attrs: 'required maxlength="200" autofocus',
        error: 'Укажите название книги',
      })}
      <div class="field-row">
        ${textField({
          name: 'author',
          label: 'Автор',
          placeholder: 'Михаил Булгаков',
          attrs: 'required maxlength="120"',
          error: 'Укажите автора',
        })}
        ${textField({
          name: 'year',
          label: 'Год издания',
          type: 'number',
          placeholder: '1967',
          attrs: `required min="1" max="${currentYear}" step="1" inputmode="numeric"`,
          error: `Год издания — число от 1 до ${currentYear}`,
        })}
      </div>
      <p class="dialog__hint">Книга появится в фонде со статусом «В наличии» и сегодняшней датой поступления.</p>`,
    onSubmit: async (values) => {
      const book = await addBook({ ...values, year: Number(values.year) });
      view.querySelector('[data-search]').value = '';
      Object.assign(state, { query: '', filter: 'all', revealId: book.id });
      update(view);
      showToast(`Книга «${book.title}» добавлена`);
    },
  });
}

export function mountBooksPage(view, params) {
  if (params.q !== undefined) {
    Object.assign(state, { query: params.q, filter: 'all', page: 1 });
  }

  view.innerHTML = listLayout({
    searchPlaceholder: 'Поиск по названию, автору или читателю',
    query: state.query,
    action: actionButton('add-book', 'Добавить книгу'),
  });

  bindListControls(view, state, columns, () => update(view));
  view.querySelector('[data-action="add-book"]').addEventListener('click', () => {
    openAddBookDialog(view);
  });

  update(view);
  return () => update(view);
}
