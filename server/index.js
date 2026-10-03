import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoNetworkError, MongoServerSelectionError } from 'mongodb';
import { disconnect, getCollections } from './db.js';
import { HttpError, router } from './routes.js';

const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url));

const app = express();

app.use(express.json({ limit: '10kb' }));
app.use('/api', router);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// В продакшене (после npm run build) сервер сам раздаёт собранный фронтенд
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// Express распознаёт обработчик ошибок по четырём аргументам
app.use((error, req, res, next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof MongoServerSelectionError || error instanceof MongoNetworkError) {
    console.error('MongoDB недоступна:', error.message);
    res.status(503).json({
      error:
        'Нет подключения к базе данных. Проверьте, что ваш IP добавлен в Atlas → Network Access.',
    });
    return;
  }

  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const server = app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}/api`);
});

getCollections().catch((error) => {
  console.error(`MongoDB: не удалось подключиться — ${error.message}`);
  console.error('Подключение будет повторено при следующем запросе.');
});

async function shutdown() {
  server.close();
  await disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
