const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// Строка 'YYYY-MM-DD' -> локальная дата без сдвига часового пояса
export function parseDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(iso) {
  return dateFormatter.format(parseDate(iso));
}

export function daysSince(iso, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - parseDate(iso)) / DAY_MS));
}

export function plural(count, [one, few, many]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// Регистронезависимое сравнение, «ё» и «е» считаются одной буквой.
// Длина строки не меняется, поэтому индексы совпадают с исходным текстом.
export function normalize(value) {
  return value.toLowerCase().replaceAll('ё', 'е');
}

export function matches(query, ...values) {
  return values.some((value) => value && normalize(value).includes(query));
}

// Экранирует текст и подсвечивает вхождения запроса тегом <mark>
export function highlight(text, query) {
  if (!query) return escapeHtml(text);

  const haystack = normalize(text);
  let result = '';
  let cursor = 0;
  let index = haystack.indexOf(query);

  while (index !== -1) {
    result += escapeHtml(text.slice(cursor, index));
    result += `<mark>${escapeHtml(text.slice(index, index + query.length))}</mark>`;
    cursor = index + query.length;
    index = haystack.indexOf(query, cursor);
  }

  return result + escapeHtml(text.slice(cursor));
}
