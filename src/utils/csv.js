function protectFormula(value) {
  const text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  let text = protectFormula(value);
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(columns, rows) {
  const header = columns.map((column) => escapeCsvValue(column.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key])).join(',')
  );
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}

function safeFilename(value) {
  return String(value || 'export.csv')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

function sendCsv(res, filename, csv) {
  const safe = safeFilename(filename);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
}

module.exports = {
  buildCsv,
  sendCsv,
  escapeCsvValue,
  safeFilename
};
