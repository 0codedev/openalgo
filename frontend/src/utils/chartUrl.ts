/**
 * TradingView Symbol Formatter & Chart Redirection Utility
 *
 * Converts Indian stock market symbols across NSE, BSE, NFO, BFO, and MCX
 * (including equity, futures, and stock/index options) into exact TradingView tickers.
 */

const MONTH_MAP: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
}

/**
 * Calculates the last Thursday of a given 2-digit year and month (1-12)
 * for monthly contract expiry calculation when day is not explicitly given.
 */
function getLastThursday(year: number, month: number): string {
  const fullYear = year < 100 ? 2000 + year : year
  const lastDay = new Date(Date.UTC(fullYear, month, 0)).getUTCDate()
  const date = new Date(Date.UTC(fullYear, month - 1, lastDay))
  const dayOfWeek = date.getUTCDay() // 0 = Sun, 4 = Thu
  const diff = (dayOfWeek - 4 + 7) % 7
  return String(lastDay - diff).padStart(2, '0')
}

/**
 * Formats any Indian equity, index, futures, or options symbol into
 * its corresponding TradingView ticker format.
 *
 * Examples:
 * - DLF28JUL26675CE -> NSE:DLF260728C675
 * - HAVELLS28JUL261210CE -> NSE:HAVELLS260728C1210
 * - SENSEX26NOV2671700CE -> BSE:SENSEX261126C71700
 * - MIDCPNIFTY27OCT2615250CE -> NSE:MIDCPNIFTY261027C15250
 * - NIFTY29DEC2627000CE -> NSE:NIFTY261229C27000
 * - RELIANCE 1170 CE 27 OCT 26 -> NSE:RELIANCE261027C1170
 * - NIFTY24SEP25300CE -> NSE:NIFTY240926C25300
 * - SILVER05JUL27FUT -> MCX:SILVER1!
 * - RELIANCE -> NSE:RELIANCE
 * - TCS (exchange BSE) -> BSE:TCS
 */
export function formatTradingViewSymbol(symbol: string, exchange?: string): string {
  if (!symbol) return ''
  let sym = symbol.trim().toUpperCase()
  let ex = exchange?.trim().toUpperCase() || ''

  // Strip existing exchange prefix if present (e.g. "NSE:SBIN")
  const prefixMatch = sym.match(/^(NSE|BSE|NFO|BFO|MCX|CDS):(.+)$/i)
  if (prefixMatch) {
    if (!ex) ex = prefixMatch[1]
    sym = prefixMatch[2]
  }

  // Resolve target exchange (TradingView uses NSE, BSE, MCX)
  const isBse =
    ex === 'BSE' ||
    ex === 'BFO' ||
    sym.startsWith('SENSEX') ||
    sym.startsWith('BANKEX') ||
    sym.includes('BSE_INDEX')
  const isMcx =
    ex === 'MCX' ||
    sym.startsWith('SILVER') ||
    sym.startsWith('GOLD') ||
    sym.startsWith('CRUDE') ||
    sym.startsWith('NATURALGAS')
  const tvExchange = isBse ? 'BSE' : isMcx ? 'MCX' : 'NSE'

  // Pattern 1: OpenAlgo / Upstox standard option format: RELIANCE27OCT261170CE, DLF28JUL26675CE
  // Format: [UNDERLYING][DD][MMM][YY][STRIKE][CE|PE]
  const stdOptionMatch = sym.match(
    /^([A-Z0-9&_-]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})(\d+(?:\.\d+)?)(CE|PE)$/i
  )
  if (stdOptionMatch) {
    const [, underlying, day, month, year, strike, optType] = stdOptionMatch
    const mm = MONTH_MAP[month.toUpperCase()] || '01'
    const dd = day.padStart(2, '0')
    const ot = optType.toUpperCase() === 'CE' ? 'C' : 'P'
    return `${tvExchange}:${underlying}${year}${mm}${dd}${ot}${strike}`
  }

  // Pattern 2: Upstox space-separated option format: "DLF 675 CE 28 JUL 26" or "RELIANCE 1170 CE 27 OCT 26"
  const spaceOptionMatch = sym.match(
    /^([A-Z0-9&_-]+)\s+(\d+(?:\.\d+)?)\s+(CE|PE)\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{2})$/i
  )
  if (spaceOptionMatch) {
    const [, underlying, strike, optType, day, month, year] = spaceOptionMatch
    const mm = MONTH_MAP[month.toUpperCase()] || '01'
    const dd = day.padStart(2, '0')
    const ot = optType.toUpperCase() === 'CE' ? 'C' : 'P'
    return `${tvExchange}:${underlying}${year}${mm}${dd}${ot}${strike}`
  }

  // Pattern 3: Broker weekly option format with single char month: NIFTY2492625300CE or NIFTY24O0325300CE
  const weeklyMatch = sym.match(
    /^([A-Z0-9&_-]+?)(\d{2})([1-9OND])(\d{2})(\d+(?:\.\d+)?)(CE|PE)$/i
  )
  if (weeklyMatch) {
    const [, underlying, year, monthChar, day, strike, optType] = weeklyMatch
    const monthCharMap: Record<string, string> = {
      '1': '01',
      '2': '02',
      '3': '03',
      '4': '04',
      '5': '05',
      '6': '06',
      '7': '07',
      '8': '08',
      '9': '09',
      O: '10',
      N: '11',
      D: '12',
    }
    const mm = monthCharMap[monthChar.toUpperCase()] || monthChar
    const ot = optType.toUpperCase() === 'CE' ? 'C' : 'P'
    return `${tvExchange}:${underlying}${year}${mm}${day}${ot}${strike}`
  }

  // Pattern 4: Monthly contract without day: NIFTY24SEP25300CE
  const monthlyNoDayMatch = sym.match(
    /^([A-Z0-9&_-]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+(?:\.\d+)?)(CE|PE)$/i
  )
  if (monthlyNoDayMatch) {
    const [, underlying, year, month, strike, optType] = monthlyNoDayMatch
    const mm = MONTH_MAP[month.toUpperCase()] || '01'
    const ot = optType.toUpperCase() === 'CE' ? 'C' : 'P'
    const dd = getLastThursday(parseInt(year, 10), parseInt(mm, 10))
    return `${tvExchange}:${underlying}${year}${mm}${dd}${ot}${strike}`
  }

  // Pattern 5: Futures contract: SILVER05JUL27FUT, NIFTY28NOV24FUT, NIFTYFUT
  const futMatch = sym.match(/^([A-Z0-9&_-]+?)(?:\d{1,2}[A-Z]{3}\d{2})?FUT$/i)
  if (futMatch) {
    const underlying = futMatch[1]
    return `${tvExchange}:${underlying}1!`
  }

  // Pattern 6: Standard Stock or Index
  let cleanStock = sym.replace(/^NSE:|^BSE:|^NFO:|^BFO:|^MCX:/, '')
  if (cleanStock === 'NIFTY 50' || cleanStock === 'NIFTY-50') cleanStock = 'NIFTY'
  if (cleanStock === 'NIFTY BANK') cleanStock = 'BANKNIFTY'

  return `${tvExchange}:${cleanStock}`
}

/**
 * Generates the full TradingView chart URL for a given symbol and optional exchange.
 */
export function getTradingViewUrl(symbol: string, exchange?: string): string {
  const tvSymbol = formatTradingViewSymbol(symbol, exchange)
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`
}

/**
 * Directly opens the TradingView chart in a new browser tab for the exact contract.
 */
export function openChart(symbol: string, exchange?: string): void {
  if (!symbol) return
  const url = getTradingViewUrl(symbol, exchange)
  window.open(url, '_blank')
}
