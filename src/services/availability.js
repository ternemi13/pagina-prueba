const {
  dayjs,
  TZ,
  now: currentNow,
  parseDb,
  timeToMinutes,
  isValidDateString,
  overlaps
} = require('../utils/datetime');

function normalizeInterval(value) {
  const interval = Number.parseInt(value, 10);
  return Number.isInteger(interval) && interval > 0 ? interval : 30;
}

function normalizeDuration(value) {
  const duration = Number.parseInt(value, 10);
  return Number.isInteger(duration) && duration > 0 ? duration : 0;
}

function getAvailableStartTimes({
  date,
  serviceDuration,
  intervalMinutes,
  businessHours,
  workingHours,
  blocks = [],
  appointments = [],
  now = currentNow(),
  minAdvanceMinutes = 0,
  maxAdvanceDays = 30
}) {
  if (!isValidDateString(date)) return [];

  const reference = parseDb(now);
  const day = dayjs.tz(date, TZ).startOf('day');
  const today = reference.startOf('day');

  if (day.isBefore(today, 'day')) return [];
  if (day.isAfter(today.add(Number(maxAdvanceDays), 'day'), 'day')) return [];

  if (!businessHours || businessHours.closed) return [];
  if (!workingHours) return [];

  const businessStart = timeToMinutes(businessHours.start);
  const businessEnd = timeToMinutes(businessHours.end);
  const workingStart = timeToMinutes(workingHours.start);
  const workingEnd = timeToMinutes(workingHours.end);

  if (
    businessStart === null ||
    businessEnd === null ||
    workingStart === null ||
    workingEnd === null
  ) {
    return [];
  }

  const startMinute = Math.max(businessStart, workingStart);
  const endMinute = Math.min(businessEnd, workingEnd);
  if (startMinute >= endMinute) return [];

  const interval = normalizeInterval(intervalMinutes);
  const duration = normalizeDuration(serviceDuration);
  if (duration === 0 || duration % interval !== 0) return [];

  const breakStartMinute =
    workingHours.break_start !== null && workingHours.break_start !== undefined
      ? timeToMinutes(workingHours.break_start)
      : null;
  const breakEndMinute =
    workingHours.break_end !== null && workingHours.break_end !== undefined
      ? timeToMinutes(workingHours.break_end)
      : null;

  const minimumStart = reference.add(Number(minAdvanceMinutes) || 0, 'minute');
  const blockRanges = blocks.map((block) => ({
    start: parseDb(block.start),
    end: parseDb(block.end)
  }));
  const appointmentRanges = appointments.map((appointment) => ({
    start: parseDb(appointment.start),
    end: parseDb(appointment.end)
  }));

  const result = [];

  for (
    let minute = startMinute;
    minute + duration <= endMinute;
    minute += interval
  ) {
    const start = day.add(minute, 'minute');
    const end = start.add(duration, 'minute');

    if (start.isBefore(minimumStart)) continue;

    if (
      breakStartMinute !== null &&
      breakEndMinute !== null &&
      breakStartMinute < breakEndMinute
    ) {
      const breakStart = day.add(breakStartMinute, 'minute');
      const breakEnd = day.add(breakEndMinute, 'minute');
      if (overlaps(start, end, breakStart, breakEnd)) continue;
    }

    if (
      blockRanges.some((range) => overlaps(start, end, range.start, range.end))
    ) {
      continue;
    }

    if (
      appointmentRanges.some((range) =>
        overlaps(start, end, range.start, range.end)
      )
    ) {
      continue;
    }

    result.push(start.format('HH:mm'));
  }

  return result;
}

function isStartTimeAvailable(params) {
  const times = getAvailableStartTimes(params);
  return times.includes(params.time);
}

function getAvailableDays({
  dates,
  serviceDuration,
  intervalMinutes,
  businessHoursByWeekday,
  workingHoursByWeekday,
  blocksByDate,
  appointmentsByDate,
  now,
  minAdvanceMinutes,
  maxAdvanceDays
}) {
  return dates.map((date) => {
    const weekday = dayjs.tz(date, TZ).day();
    const times = getAvailableStartTimes({
      date,
      serviceDuration,
      intervalMinutes,
      businessHours: businessHoursByWeekday[weekday],
      workingHours: workingHoursByWeekday[weekday],
      blocks: blocksByDate[date] || [],
      appointments: appointmentsByDate[date] || [],
      now,
      minAdvanceMinutes,
      maxAdvanceDays
    });
    return { date, available: times.length > 0, count: times.length };
  });
}

module.exports = {
  getAvailableStartTimes,
  isStartTimeAvailable,
  getAvailableDays
};
