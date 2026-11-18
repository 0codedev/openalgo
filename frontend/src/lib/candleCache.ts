/**
 * In-memory client-side cache for 1-minute historical candles.
 * Prevents re-fetching past candles when expanding/collapsing positions or switching tabs.
 */

export interface Candle {
  time: number // Unix timestamp in seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CacheEntry {
  candles: Candle[]
  fetchedAt: number
}

const memoryCache = new Map<string, CacheEntry>()
const DEFAULT_TTL_MS = 60_000 // 60 seconds

export function getCandleCacheKey(exchange: string, symbol: string, interval = '1m', date?: string): string {
  const cleanSym = (symbol || '').trim().toUpperCase()
  const cleanExch = (exchange || '').trim().toUpperCase()
  const d = date || new Date().toISOString().slice(0, 10)
  return `${cleanExch}:${cleanSym}:${interval}:${d}`
}

export const candleCache = {
  get(key: string, ttl = DEFAULT_TTL_MS): Candle[] | null {
    const entry = memoryCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > ttl) {
      memoryCache.delete(key)
      return null
    }
    return entry.candles
  },

  set(key: string, candles: Candle[]): void {
    if (!candles || candles.length === 0) return
    memoryCache.set(key, {
      candles,
      fetchedAt: Date.now(),
    })
  },

  stitchLiveLtp(key: string, ltp: number, volume = 0): Candle[] | null {
    const entry = memoryCache.get(key)
    if (!entry || entry.candles.length === 0 || !ltp) return null

    const nowSec = Math.floor(Date.now() / 1000)
    const currentBarTime = Math.floor(nowSec / 60) * 60
    const candles = [...entry.candles]
    const last = candles[candles.length - 1]

    if (last && last.time === currentBarTime) {
      // Update ongoing current bar
      candles[candles.length - 1] = {
        ...last,
        high: Math.max(last.high, ltp),
        low: Math.min(last.low, ltp),
        close: ltp,
        volume: last.volume + volume,
      }
    } else if (last && currentBarTime > last.time) {
      // Append new minute bar
      candles.push({
        time: currentBarTime,
        open: ltp,
        high: ltp,
        low: ltp,
        close: ltp,
        volume,
      })
    }

    entry.candles = candles
    return candles
  },

  invalidate(key?: string): void {
    if (key) {
      memoryCache.delete(key)
    } else {
      memoryCache.clear()
    }
  },
}
