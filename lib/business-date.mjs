export const BUSINESS_TIME_ZONE = "Africa/Addis_Ababa";

export function businessDateKeyFor(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

export function shiftBusinessDate(dateKey, offsetDays) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return businessDateKeyFor(year, month - 1, day + offsetDays);
}