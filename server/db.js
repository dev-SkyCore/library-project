import dns from 'node:dns';
import { MongoClient } from 'mongodb';

const DB_NAME = 'library-data';
const FALLBACK_DNS = ['1.1.1.1', '8.8.8.8'];

const { MONGODB_URI, MONGODB_USERNAME, MONGODB_PASSWORD } = process.env;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI не задан. Запускайте сервер с --env-file=atlas-credentials.env');
}

// На Windows Node иногда не может выполнить SRV-запрос через системный резолвер
// (querySrv ECONNREFUSED). В этом случае переключаемся на публичные DNS.
async function ensureSrvResolvable(uri) {
  if (!uri.startsWith('mongodb+srv://')) return;

  const host = new URL(uri).hostname;
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch (error) {
    console.warn(`DNS: ${error.code} при запросе SRV, используем ${FALLBACK_DNS.join(', ')}`);
    dns.setServers(FALLBACK_DNS);
  }
}

const client = new MongoClient(MONGODB_URI, {
  auth: MONGODB_USERNAME ? { username: MONGODB_USERNAME, password: MONGODB_PASSWORD } : undefined,
  serverSelectionTimeoutMS: 10_000,
});

async function connect() {
  await ensureSrvResolvable(MONGODB_URI);
  await client.connect();

  const db = client.db(DB_NAME);
  await db.command({ ping: 1 });
  console.log(`MongoDB: подключено к базе «${DB_NAME}»`);

  return { books: db.collection('books'), visitors: db.collection('visitors') };
}

let connection = null;

// Подключаемся при первом запросе; при неудаче следующий запрос попробует снова
export function getCollections() {
  connection ??= connect().catch((error) => {
    connection = null;
    throw error;
  });
  return connection;
}

export function withTransaction(callback) {
  return client.withSession((session) => session.withTransaction(() => callback(session)));
}

export function disconnect() {
  return client.close();
}
