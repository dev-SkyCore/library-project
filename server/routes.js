import { Router } from 'express';
import { getCollections, withTransaction } from './db.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const WITHOUT_ID = { projection: { _id: 0 } };

function today() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function requireText(value, field, maxLength = 200) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!text) throw new HttpError(400, `Поле «${field}» обязательно`);
  if (text.length > maxLength) {
    throw new HttpError(400, `Поле «${field}» длиннее ${maxLength} символов`);
  }
  return text;
}

function requireYear(value) {
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1 || year > currentYear) {
    throw new HttpError(400, `Год издания должен быть числом от 1 до ${currentYear}`);
  }
  return year;
}

// Идентификаторы в базе имеют вид book_001 / visitor_001
async function nextId(collection, prefix) {
  const docs = await collection
    .find({ id: { $regex: `^${prefix}_\\d+$` } }, { projection: { _id: 0, id: 1 } })
    .toArray();
  const max = docs.reduce((result, doc) => Math.max(result, Number(doc.id.split('_')[1])), 0);
  return `${prefix}_${String(max + 1).padStart(3, '0')}`;
}

export const router = Router();

router.get('/books', async (req, res) => {
  const { books } = await getCollections();
  res.json(await books.find({}, WITHOUT_ID).sort({ id: 1 }).toArray());
});

router.get('/visitors', async (req, res) => {
  const { visitors } = await getCollections();
  res.json(await visitors.find({}, WITHOUT_ID).sort({ id: 1 }).toArray());
});

router.post('/books', async (req, res) => {
  const { books } = await getCollections();
  const title = requireText(req.body?.title, 'Название');
  const author = requireText(req.body?.author, 'Автор', 120);
  const year = requireYear(req.body?.year);

  const book = {
    id: await nextId(books, 'book'),
    title,
    author,
    publicationDate: `${String(year).padStart(4, '0')}-01-01`,
    addedDate: today(),
    status: 'available',
    readerId: null,
  };

  await books.insertOne({ ...book });
  res.status(201).json(book);
});

router.post('/visitors', async (req, res) => {
  const { visitors } = await getCollections();
  const fullName = requireText(req.body?.fullName, 'ФИО', 120);

  const visitor = { id: await nextId(visitors, 'visitor'), fullName, rentals: [] };

  await visitors.insertOne({ ...visitor });
  res.status(201).json(visitor);
});

// Выдача книги посетителю: книга помечается как выданная и попадает в rentals
router.post('/visitors/:visitorId/rentals', async (req, res) => {
  const { books, visitors } = await getCollections();
  const { visitorId } = req.params;
  const bookId = requireText(req.body?.bookId, 'Книга', 50);
  const rental = { bookId, rentalDate: today() };

  await withTransaction(async (session) => {
    const visitor = await visitors.findOne({ id: visitorId }, { session });
    if (!visitor) throw new HttpError(404, 'Посетитель не найден');

    const { matchedCount } = await books.updateOne(
      { id: bookId, status: 'available' },
      { $set: { status: 'rented', readerId: visitorId } },
      { session },
    );
    if (!matchedCount) {
      const exists = await books.countDocuments({ id: bookId }, { session });
      throw exists
        ? new HttpError(409, 'Эта книга уже выдана другому читателю')
        : new HttpError(404, 'Книга не найдена');
    }

    await visitors.updateOne({ id: visitorId }, { $push: { rentals: rental } }, { session });
  });

  res.status(201).json(rental);
});

// Возврат книги: убираем запись из rentals и освобождаем книгу
router.delete('/visitors/:visitorId/rentals/:bookId', async (req, res) => {
  const { books, visitors } = await getCollections();
  const { visitorId, bookId } = req.params;

  await withTransaction(async (session) => {
    const visitorResult = await visitors.updateOne(
      { id: visitorId, 'rentals.bookId': bookId },
      { $pull: { rentals: { bookId } } },
      { session },
    );
    const bookResult = await books.updateOne(
      { id: bookId, readerId: visitorId },
      { $set: { status: 'available', readerId: null } },
      { session },
    );

    if (!visitorResult.modifiedCount && !bookResult.modifiedCount) {
      throw new HttpError(404, 'Эта книга не числится за посетителем');
    }
  });

  res.status(204).end();
});
