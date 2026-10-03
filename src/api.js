const SERVER_DOWN = 'Сервер API недоступен. Запустите проект командой npm run dev.';

async function request(method, url, body) {
  let response;
  try {
    response = await fetch(`/api${url}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(SERVER_DOWN);
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Прокси Vite отвечает без JSON, если сервер API не запущен
    throw new Error(data?.error ?? (response.status >= 500 ? SERVER_DOWN : `Ошибка ${response.status}`));
  }
  return data;
}

export const api = {
  getBooks: () => request('GET', '/books'),
  getVisitors: () => request('GET', '/visitors'),
  createBook: (book) => request('POST', '/books', book),
  createVisitor: (visitor) => request('POST', '/visitors', visitor),
  issueBook: (visitorId, bookId) =>
    request('POST', `/visitors/${encodeURIComponent(visitorId)}/rentals`, { bookId }),
  returnBook: (visitorId, bookId) =>
    request(
      'DELETE',
      `/visitors/${encodeURIComponent(visitorId)}/rentals/${encodeURIComponent(bookId)}`,
    ),
};
