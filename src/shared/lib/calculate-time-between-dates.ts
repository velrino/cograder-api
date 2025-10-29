import { DateTime } from 'luxon';

export function CalculateTimeBetweenDates(start: DateTime, end: DateTime) {
  const diff = end.diff(start, [
    'years',
    'months',
    'days',
    'hours',
    'minutes',
    'seconds',
  ]);

  return {
    start,
    end,
    years: Math.floor(diff.years),
    months: Math.floor(diff.months),
    days: Math.floor(diff.days),
    hours: Math.floor(diff.hours),
    minutes: Math.floor(diff.minutes),
    seconds: Math.floor(diff.seconds),
  };
}
