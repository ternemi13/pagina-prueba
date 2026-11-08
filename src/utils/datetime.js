const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const config = require('../config');
require('dayjs/locale/es');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('es');

const TZ = config.timezone;
const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado'
];
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function now() {
  return dayjs().tz(TZ);
}

function today() {
  return now().startOf('day');
}

function todayStr() {
  return now().format('YYYY-MM-DD');
}

function parseLocal(dateStr, timeStr = '00:00') {
  return dayjs.tz(`${dateStr} ${timeStr}`, TZ);
}

function parseDb(value) {
  if (dayjs.isDayjs(value)) return value.tz(TZ);
  return dayjs.tz(String(value), TZ);
}

function toDb(value) {
  return dayjs(value).tz(TZ).format('YYYY-MM-DD HH:mm:ss');
}

function toDateStr(value) {
  return dayjs(value).tz(TZ).format('YYYY-MM-DD');
}

function toTimeStr(value) {
  return dayjs(value).tz(TZ).format('HH:mm');
}

function formatDateLong(value) {
  return parseDb(value).format('dddd, D [de] MMMM [de] YYYY');
}

function formatDateShort(value) {
  return parseDb(value).format('ddd, D MMM');
}

function formatDateInput(value) {
  return parseDb(value).format('YYYY-MM-DD');
}

function formatTimeInput(value) {
  return parseDb(value).format('HH:mm');
}

function formatDateTime(value) {
  return parseDb(value).format('ddd, D MMM YYYY · HH:mm');
}

function formatTimeRange(start, end) {
  return `${toTimeStr(start)} – ${toTimeStr(end)}`;
}

function formatCurrency(amount, currency = config.currency) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);
}

function timeToMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(minutes) {
  const safe = ((Number(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = dayjs.tz(value, TZ);
  return parsed.isValid() && parsed.format('YYYY-MM-DD') === value;
}

function isValidTimeString(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidMonthString(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function weekdayOf(dateStr) {
  return dayjs.tz(dateStr, TZ).day();
}

function dayName(weekday, short = false) {
  const names = short ? DAY_NAMES_SHORT : DAY_NAMES;
  return names[Number(weekday)] || '';
}

function overlaps(startA, endA, startB, endB) {
  const aStart = dayjs(startA);
  const aEnd = dayjs(endA);
  const bStart = dayjs(startB);
  const bEnd = dayjs(endB);
  return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
}

function isSameDay(a, b) {
  return toDateStr(a) === toDateStr(b);
}

function isPast(value) {
  return parseDb(value).isBefore(now());
}

function diffMinutes(from, to) {
  return dayjs(to).diff(dayjs(from), 'minute');
}

function startOfWeek(value = now()) {
  const date = dayjs(value).tz(TZ);
  return date.startOf('day').subtract((date.day() + 6) % 7, 'day');
}

function endOfWeek(value = now()) {
  return startOfWeek(value).add(6, 'day').endOf('day');
}

function startOfMonth(value) {
  return parseDb(value).startOf('month');
}

function endOfMonth(value) {
  return parseDb(value).endOf('month');
}

function daysInMonth(value) {
  return parseDb(value).daysInMonth();
}

function addMinutes(value, minutes) {
  return dayjs(value).add(minutes, 'minute');
}

function maxAdvanceDate(maxDays) {
  return today().add(Number(maxDays), 'day').endOf('day');
}

function isWithinAdvanceWindow(dateStr, maxDays) {
  const date = dayjs.tz(dateStr, TZ);
  return !date.isAfter(maxAdvanceDate(maxDays), 'day') && !date.isBefore(today(), 'day');
}

function slotStarts(start, durationMinutes, intervalMinutes) {
  const result = [];
  for (let offset = 0; offset < durationMinutes; offset += intervalMinutes) {
    result.push(dayjs(start).add(offset, 'minute'));
  }
  return result;
}

function dateList(startDate, endDate) {
  const result = [];
  let cursor = parseDb(startDate).startOf('day');
  const last = parseDb(endDate).startOf('day');
  while (!cursor.isAfter(last, 'day')) {
    result.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return result;
}

module.exports = {
  dayjs,
  TZ,
  DAY_NAMES,
  DAY_NAMES_SHORT,
  now,
  today,
  todayStr,
  parseLocal,
  parseDb,
  toDb,
  toDateStr,
  toTimeStr,
  formatDateLong,
  formatDateShort,
  formatDateInput,
  formatTimeInput,
  formatDateTime,
  formatTimeRange,
  formatCurrency,
  timeToMinutes,
  minutesToTime,
  isValidDateString,
  isValidTimeString,
  isValidMonthString,
  weekdayOf,
  dayName,
  overlaps,
  isSameDay,
  isPast,
  diffMinutes,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  daysInMonth,
  addMinutes,
  maxAdvanceDate,
  isWithinAdvanceWindow,
  slotStarts,
  dateList
};
