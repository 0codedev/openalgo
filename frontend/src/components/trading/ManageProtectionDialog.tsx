import { useEffect, useState } from 'react'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { tradingApi } from '@/api/trading'
import { showToast } from '@/utils/toast'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { Position } from '@/types/trading'

interface Props {
  position: Position | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  initialTab?: 'SL' | 'TARGET'
}

export function ManageProtectionDialog({
  position,
  open,
  onOpenChange,
  onSuccess,
  initialTab = 'SL',
}: Props) {
  const { apiKey } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'SL' | 'TARGET'>(initialTab)

  // Form states
  const [slTrigger, setSlTrigger] = useState<string>('')
  const [tgtPrice, setTgtPrice] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!position) return
    setActiveTab(initialTab)
    if (position.stop_loss?.trigger_price) {
      setSlTrigger(String(position.stop_loss.trigger_price))
    } else if (position.ltp) {
      // Sensible initial suggestion: 5% buffer from LTP
      const isLong = (position.quantity || 0) > 0
      const defaultSL = isLong ? position.ltp * 0.95 : position.ltp * 1.05
      setSlTrigger(defaultSL.toFixed(2))
    } else {
      setSlTrigger('')
    }

    if (position.target?.price) {
      setTgtPrice(String(position.target.price))
    } else if (position.ltp) {
      // Sensible initial target suggestion: 10% buffer from LTP
      const isLong = (position.quantity || 0) > 0
      const defaultTgt = isLong ? position.ltp * 1.1 : position.ltp * 0.9
      setTgtPrice(defaultTgt.toFixed(2))
    } else {
      setTgtPrice('')
    }
  }, [position, initialTab, open])

  if (!position) return null

  const isLong = (position.quantity || 0) > 0
  const qty = Math.abs(position.quantity || 0)
  const oppAction = isLong ? 'SELL' : 'BUY'
  const ltp = position.ltp || 0

  // 1. Handle Stop Loss Submit (Create or Modify)
  const handleSaveSL = async () => {
    const triggerNum = parseFloat(slTrigger)
    if (isNaN(triggerNum) || triggerNum <= 0) {
      showToast.error('Please enter a valid Stop Loss trigger price', 'orders')
      return
    }

    setIsSubmitting(true)
    try {
      if (position.stop_loss?.order_id) {
        // Modify existing SL order
        const res = await tradingApi.modifyOrder(position.stop_loss.order_id, {
          symbol: position.symbol,
          exchange: position.exchange,
          action: oppAction,
          product: position.product,
          pricetype: position.stop_loss.price_type || 'SL-M',
          quantity: position.stop_loss.quantity || qty,
          trigger_price: triggerNum,
        })
        if (res.status === 'success') {
          showToast.success(`Stop Loss updated to ₹${triggerNum.toFixed(2)}`, 'orders')
          onSuccess()
          onOpenChange(false)
        } else {
          showToast.error(res.message || 'Failed to modify Stop Loss order', 'orders')
        }
      } else {
        // Place new SL-M order
        if (!apiKey) {
          showToast.error('API key required to place protection order', 'orders')
          return
        }
        const res = await tradingApi.placeOrder({
          apikey: apiKey,
          strategy: position.strategy || 'Manual_Protection',
          exchange: position.exchange,
          symbol: position.symbol,
          action: oppAction,
          quantity: qty,
          pricetype: 'SL-M',
          product: position.product,
          trigger_price: triggerNum,
        })
        if (res.status === 'success') {
          showToast.success(`Stop Loss placed at ₹${triggerNum.toFixed(2)}`, 'orders')
          onSuccess()
          onOpenChange(false)
        } else {
          showToast.error(res.message || 'Failed to place Stop Loss order', 'orders')
        }
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error saving Stop Loss order', 'orders')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. Handle Target Submit (Create or Modify)
  const handleSaveTarget = async () => {
    const priceNum = parseFloat(tgtPrice)
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast.error('Please enter a valid Target price', 'orders')
      return
    }

    setIsSubmitting(true)
    try {
      if (position.target?.order_id) {
        // Modify existing Target order
        const res = await tradingApi.modifyOrder(position.target.order_id, {
          symbol: position.symbol,
          exchange: position.exchange,
          action: oppAction,
          product: position.product,
          pricetype: 'LIMIT',
          quantity: position.target.quantity || qty,
          price: priceNum,
        })
        if (res.status === 'success') {
          showToast.success(`Target updated to ₹${priceNum.toFixed(2)}`, 'orders')
          onSuccess()
          onOpenChange(false)
        } else {
          showToast.error(res.message || 'Failed to modify Target order', 'orders')
        }
      } else {
        // Place new Limit Target order
        if (!apiKey) {
          showToast.error('API key required to place protection order', 'orders')
          return
        }
        const res = await tradingApi.placeOrder({
          apikey: apiKey,
          strategy: position.strategy || 'Manual_Protection',
          exchange: position.exchange,
          symbol: position.symbol,
          action: oppAction,
          quantity: qty,
          pricetype: 'LIMIT',
          product: position.product,
          price: priceNum,
        })
        if (res.status === 'success') {
          showToast.success(`Target placed at ₹${priceNum.toFixed(2)}`, 'orders')
          onSuccess()
          onOpenChange(false)
        } else {
          showToast.error(res.message || 'Failed to place Target order', 'orders')
        }
      }
    } catch (err: any) {
      showToast.error(err.message || 'Error saving Target order', 'orders')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. Handle Order Cancellation
  const handleCancelOrder = async (orderId: string, orderName: string) => {
    if (!confirm(`Are you sure you want to cancel the active ${orderName} order?`)) return
    setIsSubmitting(true)
    try {
      const res = await tradingApi.cancelOrder(orderId)
      if (res.status === 'success') {
        showToast.success(`${orderName} order cancelled`, 'orders')
        onSuccess()
        onOpenChange(false)
      } else {
        showToast.error(res.message || `Failed to cancel ${orderName} order`, 'orders')
      }
    } catch (err: any) {
      showToast.error(err.message || `Error cancelling ${orderName} order`, 'orders')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Shield className="h-5 w-5 text-indigo-500" />
              Manage Protection
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-xs">
                {position.exchange}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {position.product}
              </Badge>
            </div>
          </div>
          <DialogDescription className="font-mono text-sm pt-1 text-foreground">
            {position.symbol}
          </DialogDescription>
        </DialogHeader>

        {/* Position Context Card */}
        <div className="bg-muted/40 rounded-lg p-3.5 border border-border/50 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block">Position Side</span>
            <div className="flex items-center gap-1.5 font-semibold text-sm mt-0.5">
              <Badge
                variant={isLong ? 'default' : 'destructive'}
                className="text-[11px] px-1.5 py-0"
              >
                {isLong ? 'LONG' : 'SHORT'}
              </Badge>
              <span className="font-mono">{qty} Qty</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground block">Average Entry</span>
            <span className="font-mono font-semibold text-sm mt-0.5 block">
              ₹{Number(position.average_price || 0).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Live LTP</span>
            <span className="font-mono font-semibold text-sm mt-0.5 block text-indigo-400">
              ₹{ltp.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Unrealized P&L</span>
            <span
              className={cn(
                'font-mono font-semibold text-sm mt-0.5 flex items-center gap-1',
                (position.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
              )}
            >
              {(position.pnl || 0) >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              ₹{Number(position.pnl || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Tabs for SL and Target */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'SL' | 'TARGET')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="SL" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Stop Loss {position.stop_loss ? '(Active)' : ''}
            </TabsTrigger>
            <TabsTrigger value="TARGET" className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              Target {position.target ? '(Active)' : ''}
            </TabsTrigger>
          </TabsList>

          {/* STOP LOSS TAB */}
          <TabsContent value="SL" className="space-y-4 pt-3">
            {position.stop_loss ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold text-amber-500">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" /> Active Stop Loss Attached
                  </span>
                  <span className="font-mono">ID: {position.stop_loss.order_id}</span>
                </div>
                <div className="text-muted-foreground flex justify-between pt-1">
                  <span>Current Trigger: <strong className="text-foreground font-mono">₹{position.stop_loss.trigger_price.toFixed(2)}</strong></span>
                  <span>Type: <strong className="text-foreground">{position.stop_loss.price_type}</strong></span>
                </div>
              </div>
            ) : (
              <div className="bg-muted/40 border border-border/50 rounded-md p-3 text-xs text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>No active stop loss order set. Capital is currently unprotected.</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sl-input" className="text-xs font-semibold">
                Stop Loss Trigger Price (₹)
              </Label>
              <Input
                id="sl-input"
                type="number"
                step="0.05"
                placeholder="Enter trigger price"
                value={slTrigger}
                onChange={(e) => setSlTrigger(e.target.value)}
                className="font-mono text-sm"
              />
              <span className="text-[11px] text-muted-foreground block">
                {isLong
                  ? `For Long position, trigger price should be below LTP (₹${ltp.toFixed(2)}).`
                  : `For Short position, trigger price should be above LTP (₹${ltp.toFixed(2)}).`}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              {position.stop_loss ? (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="text-red-500 border-red-500/30 hover:bg-red-500/10 gap-1.5 text-xs"
                  onClick={() => handleCancelOrder(position.stop_loss!.order_id, 'Stop Loss')}
                  disabled={isSubmitting}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Cancel SL
                </Button>
              ) : <div />}
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs font-semibold"
                onClick={handleSaveSL}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {position.stop_loss ? 'Update Stop Loss' : 'Set Stop Loss (SL-M)'}
              </Button>
            </div>
          </TabsContent>

          {/* TARGET TAB */}
          <TabsContent value="TARGET" className="space-y-4 pt-3">
            {position.target ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold text-emerald-500">
                  <span className="flex items-center gap-1.5">
                    <Target className="h-4 w-4" /> Active Target Attached
                  </span>
                  <span className="font-mono">ID: {position.target.order_id}</span>
                </div>
                <div className="text-muted-foreground flex justify-between pt-1">
                  <span>Current Target Price: <strong className="text-foreground font-mono">₹{position.target.price.toFixed(2)}</strong></span>
                  <span>Type: <strong className="text-foreground">{position.target.price_type}</strong></span>
                </div>
              </div>
            ) : (
              <div className="bg-muted/40 border border-border/50 rounded-md p-3 text-xs text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>No active target limit order set for this position.</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tgt-input" className="text-xs font-semibold">
                Target Limit Price (₹)
              </Label>
              <Input
                id="tgt-input"
                type="number"
                step="0.05"
                placeholder="Enter target limit price"
                value={tgtPrice}
                onChange={(e) => setTgtPrice(e.target.value)}
                className="font-mono text-sm"
              />
              <span className="text-[11px] text-muted-foreground block">
                {isLong
                  ? `For Long position, target price should be above LTP (₹${ltp.toFixed(2)}).`
                  : `For Short position, target price should be below LTP (₹${ltp.toFixed(2)}).`}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              {position.target ? (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="text-red-500 border-red-500/30 hover:bg-red-500/10 gap-1.5 text-xs"
                  onClick={() => handleCancelOrder(position.target!.order_id, 'Target')}
                  disabled={isSubmitting}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Cancel Target
                </Button>
              ) : <div />}
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold"
                onClick={handleSaveTarget}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {position.target ? 'Update Target' : 'Set Target (LIMIT)'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
