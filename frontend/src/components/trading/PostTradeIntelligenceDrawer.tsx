import React from 'react'
import type { Position } from '@/types/trading'
import { StrategyBadge } from './StrategyBadge'
import { PostTradeTrajectoryChart } from './PostTradeTrajectoryChart'
import { TrendingUp, CheckCircle2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PostTradeIntelligenceDrawerProps {
  position: Position
}

export const PostTradeIntelligenceDrawer: React.FC<PostTradeIntelligenceDrawerProps> = ({
  position,
}) => {
  const isWinner = (position.pnl || 0) >= 0
  const leftOnTable = position.left_on_table || 0
  const isLeftOnTable = leftOnTable > 0
  const isCapitalPreserved = leftOnTable < 0
  const entryPrice = position.entry_price || position.average_price || 0
  const exitPrice = position.exit_price || 0
  const ltp = position.ltp || exitPrice
  const closedQty = position.closed_qty || Math.abs(position.quantity) || 0
  const realizedReturnPct = position.realized_pnl_percent || 0
  const counterfactualPnl = position.counterfactual_pnl || 0

  // Capital Deployed & Turnover math
  const investedCapital = closedQty * entryPrice
  const grossExitValue = closedQty * exitPrice
  const tradedTurnover = investedCapital + grossExitValue
  const currentValueLtp = closedQty * ltp

  // Format currency helper
  const formatInr = (val: number) => {
    const absVal = Math.abs(val)
    const formatted = absVal.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `${val < 0 ? '-' : ''}₹${formatted}`
  }

  return (
    <div className="p-4 rounded-xl bg-card border border-border/80 shadow-md transition-all space-y-4">
      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* CARD 1: Session Execution Profile */}
        <div className="p-4 rounded-lg bg-content/40 border border-border/60 flex flex-col justify-between hover:border-border transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Session Execution
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-mono font-bold border',
                  isWinner
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                )}
              >
                {isWinner ? 'PROFIT' : 'CONTROLLED LOSS'}
              </span>
            </div>

            <div className="mt-1">
              <div
                className={cn(
                  'text-xl font-bold font-mono tracking-tight',
                  isWinner ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {isWinner ? '+' : ''}
                {formatInr(position.pnl || 0)}
              </div>
              <div
                className={cn(
                  'text-xs font-mono font-semibold mt-0.5',
                  realizedReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {realizedReturnPct >= 0 ? '+' : ''}
                {realizedReturnPct.toFixed(2)}% Realized ROI
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/70 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Entry Price</span>
                <span className="font-semibold text-foreground">₹{entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Exit Price</span>
                <span className="font-semibold text-foreground">₹{exitPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Closed Session Qty</span>
                <span className="font-bold text-foreground">{closedQty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Route</span>
                <span className="font-semibold text-foreground">
                  {position.entry_order_type || position.order_type || 'MARKET'}
                  {position.exit_order_type && position.exit_order_type !== '-' && position.exit_order_type !== (position.entry_order_type || position.order_type) ? ` → ${position.exit_order_type}` : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 text-xs text-muted-foreground flex items-center gap-1.5 font-sans border-t border-border/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Cycle completed and reconciled</span>
          </div>
        </div>

        {/* CARD 2: Capital Deployed & Turnover Telemetry */}
        <div className="p-4 rounded-lg bg-content/40 border border-border/60 flex flex-col justify-between hover:border-border transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Capital &amp; Turnover
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                AUDITED VOLUME
              </span>
            </div>

            <div className="mt-1">
              <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                {formatInr(tradedTurnover)}
              </div>
              <div className="text-xs font-medium text-muted-foreground mt-0.5">
                Total Traded Turnover (Buy + Sell)
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/70 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital Invested</span>
                <span className="font-semibold text-foreground">{formatInr(investedCapital)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Exit Value</span>
                <span className="font-semibold text-foreground">{formatInr(grossExitValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital at Live LTP</span>
                <span className="font-semibold text-foreground">{formatInr(currentValueLtp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Allocated Strategy</span>
                <span className="font-semibold text-foreground">
                  <StrategyBadge strategy={position.strategy} />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 text-xs text-muted-foreground flex items-center gap-1.5 font-sans border-t border-border/30">
            <Wallet className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Exact gross capital exposure</span>
          </div>
        </div>

        {/* CARD 3: Counterfactual Benchmarking */}
        <div className="p-4 rounded-lg bg-content/40 border border-border/60 flex flex-col justify-between hover:border-border transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Counterfactual MTM
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-mono font-bold border',
                  isLeftOnTable
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : isCapitalPreserved
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-muted text-muted-foreground border-border'
                )}
              >
                {isLeftOnTable
                  ? 'LEFTOVER RUN'
                  : isCapitalPreserved
                    ? 'CAPITAL PRESERVED'
                    : 'PEAK LOCKED'}
              </span>
            </div>

            <div className="mt-1">
              <div
                className={cn(
                  'text-xl font-bold font-mono tracking-tight',
                  isLeftOnTable
                    ? 'text-amber-400'
                    : isCapitalPreserved
                      ? 'text-emerald-400'
                      : 'text-muted-foreground'
                )}
              >
                {isLeftOnTable || isCapitalPreserved ? '+' : ''}
                {formatInr(Math.abs(leftOnTable))}
              </div>
              <div className="text-xs font-medium text-muted-foreground mt-0.5">
                {isLeftOnTable
                  ? 'Uncaptured Post-Exit Gain'
                  : isCapitalPreserved
                    ? 'Loss Avoided via Disciplined Exit'
                    : 'Price Stable Near Exit'}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/70 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exit vs Live LTP</span>
                <span className="font-semibold text-foreground">
                  ₹{exitPrice.toFixed(2)} → ₹{ltp.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Drift / Share</span>
                <span
                  className={cn(
                    'font-bold',
                    isLeftOnTable ? 'text-amber-400' : 'text-emerald-400'
                  )}
                >
                  {ltp >= exitPrice ? '+' : ''}₹{(ltp - exitPrice).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">P&L If Still Held</span>
                <span
                  className={cn(
                    'font-bold',
                    counterfactualPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {counterfactualPnl >= 0 ? '+' : ''}
                  {formatInr(counterfactualPnl)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Execution Verdict</span>
                <span className="font-semibold text-foreground font-sans text-right truncate max-w-[150px]">
                  {isWinner ? 'Profit Objective Locked' : 'Capital Preserved on Cut'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 text-xs text-muted-foreground flex items-center gap-1.5 font-sans border-t border-border/30">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Real-time benchmark tracking</span>
          </div>
        </div>

      </div>

      {/* FULL WIDTH: Intraday Trajectory Chart */}
      <PostTradeTrajectoryChart position={position} />
    </div>
  )
}
