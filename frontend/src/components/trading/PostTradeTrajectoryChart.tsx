import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { scalpingApi } from '@/api/scalping'
import { candleCache, getCandleCacheKey, type Candle } from '@/lib/candleCache'
import type { Position } from '@/types/trading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PostTradeTrajectoryChartProps {
  position: Position
}

export const PostTradeTrajectoryChart: React.FC<PostTradeTrajectoryChartProps> = ({
  position,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [candleCount, setCandleCount] = useState<number>(0)

  const entryPrice = position.entry_price || position.average_price || 0
  const exitPrice = position.exit_price || 0
  const ltp = position.ltp || exitPrice
  const leftOnTable = position.left_on_table || 0
  const isLeftOnTable = leftOnTable > 0
  const isCapitalPreserved = leftOnTable < 0

  const cacheKey = getCandleCacheKey(position.exchange, position.symbol, '1m')

  const fetchAndRenderCandles = useCallback(async (force = false) => {
    if (!position.symbol || !position.exchange) return

    // 1. Check client-side in-memory cache first (0ms load)
    if (!force) {
      const cached = candleCache.get(cacheKey)
      if (cached && cached.length > 0) {
        if (ltp) {
          candleCache.stitchLiveLtp(cacheKey, ltp)
        }
        applyCandlesToChart(cached)
        setCandleCount(cached.length)
        setLastUpdated('Cached')
        return
      }
    }

    // 2. Fetch fresh 1-minute history if not cached or user clicked refresh
    setLoading(true)
    setError(null)
    try {
      const resp = await scalpingApi.getHistory(position.symbol, position.exchange, '1m')
      if (resp && resp.status === 'success' && Array.isArray(resp.candles) && resp.candles.length > 0) {
        let candles: Candle[] = resp.candles.map(c => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume || 0,
        }))

        // Deduplicate and sort by ascending timestamp
        const timeMap = new Map<number, Candle>()
        for (const c of candles) {
          timeMap.set(c.time, c)
        }
        candles = Array.from(timeMap.values()).sort((a, b) => a.time - b.time)

        candleCache.set(cacheKey, candles)
        if (ltp) {
          candleCache.stitchLiveLtp(cacheKey, ltp)
        }

        applyCandlesToChart(candles)
        setCandleCount(candles.length)
        const now = new Date()
        setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      } else {
        setError('No 1m intraday candles available for this symbol')
      }
    } catch (err: any) {
      console.warn('[PostTradeChart] Failed to load candles:', err)
      setError(err?.message || 'Failed to fetch intraday candles')
    } finally {
      setLoading(false)
    }
  }, [position.symbol, position.exchange, cacheKey, ltp])

  const applyCandlesToChart = (candles: Candle[]) => {
    if (!seriesRef.current || !candles.length) return

    const formattedData = candles.map(c => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    seriesRef.current.setData(formattedData)

    // Clear old price lines if any and re-attach
    if (entryPrice > 0) {
      seriesRef.current.createPriceLine({
        price: entryPrice,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'ENTRY',
      })
    }

    if (exitPrice > 0) {
      seriesRef.current.createPriceLine({
        price: exitPrice,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'EXIT',
      })
    }

    if (ltp > 0 && Math.abs(ltp - exitPrice) >= 0.05) {
      seriesRef.current.createPriceLine({
        price: ltp,
        color: '#38bdf8',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'LIVE LTP',
      })
    }

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }

  // Initialize Lightweight-Charts canvas instance
  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current
    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 255, 255, 0.07)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.07)',
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    seriesRef.current = series

    const handleResize = () => {
      if (container && chart) {
        chart.applyOptions({ width: container.clientWidth })
      }
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    // Load initial cached or remote candles
    fetchAndRenderCandles(false)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [fetchAndRenderCandles])

  return (
    <div className="p-3.5 rounded-lg bg-content/30 border border-border/70 flex flex-col justify-between hover:border-border transition-all">
      {/* Chart Top Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Intraday Price & Post-Exit Trajectory
          </span>
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-border/70 bg-muted/40 text-muted-foreground">
            1m Candles
          </Badge>
          {candleCount > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground/70">
              ({candleCount} bars)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          {/* Post-Exit Trajectory Pill */}
          <div className="flex items-center gap-1.5 mr-1">
            {isLeftOnTable ? (
              <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-400 border-amber-500/30 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Uncaptured Run +₹{Math.abs(leftOnTable).toFixed(2)}
              </Badge>
            ) : isCapitalPreserved ? (
              <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Disaster Cut - Avoided ₹{Math.abs(leftOnTable).toFixed(2)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-muted/40 text-muted-foreground border-border/70">
                Exit at Peak
              </Badge>
            )}
          </div>

          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 hidden sm:inline-flex">
              <Clock className="w-2.5 h-2.5" />
              {lastUpdated}
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchAndRenderCandles(true)}
            disabled={loading}
            className="h-6 px-2 text-xs font-sans text-muted-foreground hover:text-foreground active:scale-95 transition-all"
            title="Refresh intraday 1m candles"
          >
            <RefreshCw className={cn('w-3 h-3 mr-1', loading && 'animate-spin text-indigo-400')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative w-full h-[220px]">
        {loading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Hydrating 1m candles...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground font-mono space-y-1">
            <Activity className="w-6 h-6 text-muted-foreground/40" />
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAndRenderCandles(true)}
              className="mt-2 text-xs h-6 px-2"
            >
              Retry Fetch
            </Button>
          </div>
        ) : (
          <div ref={chartContainerRef} className="w-full h-full" />
        )}
      </div>

      {/* Chart Footer Legend */}
      <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-emerald-500 rounded-full inline-block" />
            <span>Entry: ₹{entryPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-rose-500 rounded-full inline-block" />
            <span>Exit: ₹{exitPrice.toFixed(2)}</span>
          </div>
          {ltp > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-sky-400 rounded-full inline-block" />
              <span>Live LTP: ₹{ltp.toFixed(2)} ({ltp >= exitPrice ? '+' : ''}₹{(ltp - exitPrice).toFixed(2)})</span>
            </div>
          )}
        </div>

        <div className="text-[10px] text-muted-foreground/70 font-sans">
          <span>Continuous MTM benchmark tracking</span>
        </div>
      </div>
    </div>
  )
}
