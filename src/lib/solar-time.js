export function formatUtcTime(date) {
  if (!isValidDate(date)) return '--:-- UTC';
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function formatLocalSolarTime(date, longitude) {
  if (!isValidDate(date) || !Number.isFinite(longitude)) return '--:--';
  const normalizedLongitude = Math.min(180, Math.max(-180, longitude));
  const solarDate = new Date(date.getTime() + normalizedLongitude * 4 * 60_000);
  return `${pad(solarDate.getUTCHours())}:${pad(solarDate.getUTCMinutes())}`;
}

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function pad(value) {
  return String(value).padStart(2, '0');
}
