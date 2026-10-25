/**
 * Log time: the stored value is ISO 8601 (UTC) and never depends on the OS locale.
 * Only the display is formatted, with the format and the time zone the user chose in the settings.
 */
export type LogTimeFormat = 'h24' | 'h12' | 'os' | 'iso';
export type LogTimeZone = 'local' | 'utc';

export const LOG_TIME_FORMATS: readonly LogTimeFormat[] = ['h24', 'h12', 'os', 'iso'];
export const LOG_TIME_ZONES: readonly LogTimeZone[] = ['local', 'utc'];
export const DEFAULT_LOG_TIME_FORMAT: LogTimeFormat = 'h24';
export const DEFAULT_LOG_TIME_ZONE: LogTimeZone = 'local';

export function formatLogTime(
  value: string,
  format: LogTimeFormat = DEFAULT_LOG_TIME_FORMAT,
  zone: LogTimeZone = DEFAULT_LOG_TIME_ZONE,
): string {
  const date = new Date(value);
  // Entries from before this format (a locale string) cannot be parsed; show them as they are
  if (Number.isNaN(date.getTime())) return String(value);
  // ISO 8601 is always UTC, so the zone does not apply to it
  if (format === 'iso') return date.toISOString();
  const utc = zone === 'utc';
  if (format === 'os') return date.toLocaleTimeString(undefined, utc ? { timeZone: 'UTC' } : {});
  if (format === 'h12') {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', ...(utc ? { timeZone: 'UTC' } : {}),
    });
  }
  // 24 hours, HH:MM:SS, in UTC or local time
  return utc ? date.toISOString().slice(11, 19) : date.toTimeString().slice(0, 8);
}
