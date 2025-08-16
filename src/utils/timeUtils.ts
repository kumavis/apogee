// relative time between two Date objects, e.g. "in 3 hours", "yesterday", "2 mo. ago"
export const getRelativeTime = (fromTimestamp: number, {
  locale = navigator.language,
  numeric = 'auto' as Intl.RelativeTimeFormatOptions['numeric'],   // 'always' -> "in 1 day"; 'auto' -> "tomorrow"/"yesterday" when available
  style = 'long' as Intl.RelativeTimeFormatOptions['style']      // 'long' | 'short' | 'narrow'
} = {}) => {
  const dateFrom = new Date(fromTimestamp);
  const dateTo = new Date();

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric, style });

  // ms difference; positive means dateFrom is after dateTo (future relative to dateTo)
  let diffMs = dateFrom.getTime() - dateTo.getTime();
  const absMs = Math.abs(diffMs);

  // thresholds (rough, human-friendly)
  const sec = 1000;
  const min = 60 * sec;
  const hour = 60 * min;
  const day = 24 * hour;
  const month = 30 * day;   // coarse but good enough for relative text
  const year = 365 * day;

  // choose best unit
  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;
  if (absMs < 45 * sec)        { value = Math.round(diffMs / sec);  unit = 'second'; }
  else if (absMs < 45 * min)   { value = Math.round(diffMs / min);  unit = 'minute'; }
  else if (absMs < 22 * hour)  { value = Math.round(diffMs / hour); unit = 'hour'; }
  else if (absMs < 26 * day)   { value = Math.round(diffMs / day);  unit = 'day'; }
  else if (absMs < 320 * day)  { value = Math.round(diffMs / month);unit = 'month'; }
  else                         { value = Math.round(diffMs / year); unit = 'year'; }

  return rtf.format(value, unit);
}

/**
 * Gets both relative time and absolute time for display
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Object with relative and absolute time strings
 */
export const getFormattedTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const relative = getRelativeTime(timestamp);
  
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
    return {
      relative: 'Unknown time',
      absolute: 'Unknown date',
      absoluteTime: ''
    };
  }

  const absolute = date.toLocaleDateString();
  const absoluteTime = date.toLocaleTimeString();

  return {
    relative,
    absolute,
    absoluteTime
  };
};
