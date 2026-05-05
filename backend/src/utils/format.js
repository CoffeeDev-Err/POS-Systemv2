function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDate(value) {
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const d = toDate(value);
  if (!d) return String(value).slice(0, 10);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTime(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 5);
  const d = toDate(value);
  if (!d) return String(value).slice(0, 5);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.replace('T', ' ').slice(0, 16);
  const d = toDate(value);
  if (!d) return String(value).slice(0, 16);
  return `${formatDate(d)} ${formatTime(d)}`;
}

module.exports = { formatDate, formatTime, formatTimestamp };
