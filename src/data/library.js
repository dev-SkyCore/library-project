import { api } from '../api.js';
import { daysSince } from '../utils.js';

export const BOOK_STATUS = {
  available: 'В наличии',
  rented: 'Выдана',
};

// Данные из MongoDB, дополненные связями «книга ↔ читатель».
// Экспортируются как live bindings и обновляются после каждой загрузки.
export let books = [];
export let visitors = [];

const listeners = new Set();

export function onChange(listener) {
  listeners.add(listener);
}

function build(rawBooks, rawVisitors) {
  const visitorsById = new Map(rawVisitors.map((visitor) => [visitor.id, visitor]));
  const booksById = new Map(rawBooks.map((book) => [book.id, book]));
  const rentalsByBookId = new Map(
    rawVisitors.flatMap((visitor) =>
      (visitor.rentals ?? []).map((rental) => [rental.bookId, rental]),
    ),
  );

  books = rawBooks.map((book) => {
    const reader = book.readerId ? visitorsById.get(book.readerId) : null;

    return {
      ...book,
      year: Number(book.publicationDate.slice(0, 4)),
      reader: reader ? { id: reader.id, fullName: reader.fullName } : null,
      rentalDate: rentalsByBookId.get(book.id)?.rentalDate ?? null,
    };
  });

  visitors = rawVisitors.map((visitor) => ({
    id: visitor.id,
    fullName: visitor.fullName,
    rentals: (visitor.rentals ?? [])
      .map((rental) => ({
        ...rental,
        book: booksById.get(rental.bookId),
        days: daysSince(rental.rentalDate),
      }))
      .filter((rental) => rental.book)
      .sort((a, b) => a.rentalDate.localeCompare(b.rentalDate)),
  }));
}

export async function loadLibrary() {
  const [rawBooks, rawVisitors] = await Promise.all([api.getBooks(), api.getVisitors()]);
  build(rawBooks, rawVisitors);
  listeners.forEach((listener) => listener());
}

// Каждое изменение перечитывает обе коллекции, чтобы связи всегда совпадали с базой
async function mutate(action) {
  const result = await action();
  await loadLibrary();
  return result;
}

export const addBook = (book) => mutate(() => api.createBook(book));
export const addVisitor = (visitor) => mutate(() => api.createVisitor(visitor));
export const issueBook = (visitorId, bookId) => mutate(() => api.issueBook(visitorId, bookId));
export const returnBook = (visitorId, bookId) => mutate(() => api.returnBook(visitorId, bookId));

export const findBook = (id) => books.find((book) => book.id === id);
export const findVisitor = (id) => visitors.find((visitor) => visitor.id === id);
