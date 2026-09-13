import type { SpotSource } from '@/api/types';

/**
 * Every user-visible string derived from backend data is produced here. Raw backend
 * values -- enum strings, ISO timestamps, metres as floats, the government fee
 * paragraph -- are never rendered directly.
 */

/** Backend enum to consumer label. */
export function sourceLabel(source: SpotSource): string {
  return source === 'photo' ? '社群回報' : '政府資料';
}

/**
 * Taiwan units. Below 100 m the metre reading is more meaningful; above it, a
 * kilometre figure with one decimal reads faster and matches how locals describe
 * short distances.
 */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '';
  if (metres < 10) return '就在附近';
  if (metres < 100) return `${Math.round(metres / 5) * 5} 公尺`;
  return `${(metres / 1000).toFixed(1)} 公里`;
}

/** ~80 m/min is the usual urban walking figure. Rounded up; never shown as 0. */
export function formatWalkingTime(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '';
  return `步行 ${Math.max(1, Math.round(metres / 80))} 分鐘`;
}

function minutesSince(iso: string): number | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 60000);
}

/**
 * Freshness, phrased the way a Taiwanese app would. Returns null for an
 * unparseable timestamp so callers can omit the line rather than print a fallback.
 */
export function formatFreshness(iso: string): string | null {
  const mins = minutesSince(iso);
  if (mins === null) return null;
  if (mins < 1) return '剛剛更新';
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return '超過一個月前';
}

/** Freshness without the trailing verb, for use under a label that supplies it. */
export function formatFreshnessShort(iso: string): string | null {
  const full = formatFreshness(iso);
  return full ? full.replace('更新', '') : null;
}

/** Data this old should read as less authoritative. */
export function isStale(iso: string): boolean {
  const mins = minutesSince(iso);
  return mins !== null && mins >= 60;
}

/**
 * The government fee field is one unpunctuated paragraph covering hourly rates,
 * monthly passes, motorcycles and night bands at once -- up to ~300 characters.
 * We show the first clause, which in practice is the car hourly rate, and let the
 * detail screen expand the rest. No attempt is made to parse a number out of it:
 * the backend does not provide a reliable structured rate.
 */
export function summarisePrice(price: string): { summary: string; hasMore: boolean } {
  const clean = price.trim();
  if (!clean) return { summary: '', hasMore: false };

  const firstSentence = clean.split('。')[0]?.trim() ?? clean;
  const summary = firstSentence.length > 42 ? `${firstSentence.slice(0, 42)}⋯` : firstSentence;
  return { summary, hasMore: clean.length > summary.length };
}

/** 空位 wording. Zero is worth saying plainly rather than showing a bare 0. */
export function availabilityPhrase(count: number): string {
  return count === 0 ? '目前已滿' : `${count} 個空位`;
}

/**
 * A community report has no name, so the row needs something to head it. The
 * reverse-geocoded area is filled in asynchronously; until then this is the
 * honest placeholder.
 */
export function spotTitle(name: string, source: SpotSource): string {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  return source === 'photo' ? '社群回報車位' : '停車場';
}

/** Radius chips. Fixed strings, not derived, so the wording stays exact. */
export const RADIUS_OPTIONS = [
  { metres: 500, label: '500 公尺' },
  { metres: 1000, label: '1 公里' },
  { metres: 2000, label: '2 公里' },
  { metres: 5000, label: '5 公里' },
] as const;
