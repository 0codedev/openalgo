import React from 'react'
import { Send, Bot, Clock, UserCheck, ShieldCheck, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface StrategyBadgeProps {
  strategy?: string | null
  className?: string
  showIcon?: boolean
}

interface ParsedStrategyItem {
  raw: string
  source: 'telegram' | 'algo' | 'system' | 'manual'
  actionTag?: 'SL' | 'TGT' | 'SL / TGT'
  displayName: string
  shortCode: string
  lotTag?: string
}

function getShortCode(name: string): { code: string; lotTag?: string } {
  let lotTag: string | undefined = undefined

  // Extract lot or quantity annotations like (18 lots) or (2340 qty)
  const lotMatch = name.match(/\((\d+)\s*(?:lots?|L)\)/i) || name.match(/\((\d+)\s*(?:qty|shares?|Q)\)/i)
  if (lotMatch) {
    const num = parseInt(lotMatch[1], 10)
    lotTag = `${num}${name.toLowerCase().includes('lot') ? 'L' : 'Q'}`
  }

  const clean = name.replace(/\s*\([^)]*\)/g, '').trim().toUpperCase()

  if (clean.includes('SOVEREIGN CASH CIRCUIT') || clean.includes('CASH CIRCUIT')) {
    return { code: 'SCC', lotTag }
  }
  if (clean.includes('SOVEREIGN_ALPHA') || clean.includes('SOVEREIGN ALPHA')) {
    return { code: 'SOV-ALPHA', lotTag }
  }
  if (clean.includes('TG INDEXSCALP') || clean.includes('TG_INDEXSCALP') || clean.includes('TELEGRAM INDEX')) {
    return { code: 'TG-SCALP', lotTag }
  }
  if (clean.includes('OVERNIGHT BTST') || clean.includes('BTST')) {
    return { code: 'BTST', lotTag }
  }
  if (clean.includes('FNO_SECTORROTATION') || clean.includes('SECTOR ROTATION') || clean.includes('SECTOR_ROT')) {
    return { code: 'SEC-ROT', lotTag }
  }
  if (clean.includes('GOAT_OPTION_SELLER') || clean.includes('GOAT')) {
    return { code: 'GOAT-SELL', lotTag }
  }
  if (clean.includes('AUTO_SQUARE_OFF') || clean.includes('AUTO SQUARE')) {
    return { code: 'AUTO-SQ', lotTag }
  }
  if (clean.includes('UI EXIT') || clean.includes('MANUAL')) {
    return { code: 'MANUAL', lotTag }
  }

  // Generic acronym derivation: Take uppercase first letters or clean snippet
  const words = clean.split(/[\s_]+/).filter(Boolean)
  if (words.length > 1) {
    const acronym = words.map(w => w[0]).join('').slice(0, 5)
    return { code: acronym, lotTag }
  }

  return { code: clean.slice(0, 8), lotTag }
}

function formatDisplayName(name: string): string {
  let cleaned = name
    .replace(/^Telegram_/i, '')
    .replace(/^Cash_Strategy\d*_/i, '')
    .replace(/^FNO_(Headless_)?/i, '')
    .replace(/___/g, ' • ')
    .replace(/__/g, ' ')
    .replace(/group_no_(\d+)/gi, 'Group #$1')
    .replace(/_/g, ' ')
    .trim()

  // Format common acronyms and words
  cleaned = cleaned
    .replace(/\bNism\b/gi, 'NISM')
    .replace(/\bOrb\b/gi, 'ORB')
    .replace(/\bSl\b/gi, 'SL')
    .replace(/\bTgt\b/gi, 'TGT')
    .replace(/\bFno\b/gi, 'F&O')

  return cleaned || name
}

export function parseStrategy(rawStr: string): ParsedStrategyItem[] {
  if (!rawStr || !rawStr.trim()) return []

  const parts = rawStr.split(',').map((s) => s.trim()).filter(Boolean)

  // Compound check: e.g. SL_Telegram_XYZ and TGT_Telegram_XYZ
  if (parts.length === 2) {
    const hasSl = parts.some((p) => p.startsWith('SL_'))
    const hasTgt = parts.some((p) => p.startsWith('TGT_'))
    const cleanNames = parts.map((p) => p.replace(/^(SL_|TGT_)/, ''))
    if (hasSl && hasTgt && cleanNames[0] === cleanNames[1]) {
      const isTg = cleanNames[0].toLowerCase().includes('telegram')
      const { code, lotTag } = getShortCode(cleanNames[0])
      return [
        {
          raw: rawStr,
          source: isTg ? 'telegram' : 'algo',
          actionTag: 'SL / TGT',
          displayName: formatDisplayName(cleanNames[0]),
          shortCode: code,
          lotTag,
        },
      ]
    }
  }

  return parts.map((part) => {
    let source: 'telegram' | 'algo' | 'system' | 'manual' = 'algo'
    let actionTag: 'SL' | 'TGT' | undefined = undefined

    let inner = part
    if (inner.startsWith('SL_')) {
      actionTag = 'SL'
      inner = inner.substring(3)
    } else if (inner.startsWith('TGT_')) {
      actionTag = 'TGT'
      inner = inner.substring(4)
    }

    if (inner.toLowerCase().includes('telegram')) {
      source = 'telegram'
    } else if (
      inner.includes('AUTO_SQUARE_OFF') ||
      inner.includes('EOD_') ||
      inner.includes('SANDBOX_')
    ) {
      source = 'system'
    } else if (inner.includes('UI Exit') || inner.includes('Manual')) {
      source = 'manual'
    }

    const { code, lotTag } = getShortCode(inner)

    return {
      raw: part,
      source,
      actionTag,
      displayName: formatDisplayName(inner),
      shortCode: code,
      lotTag,
    }
  })
}

export const StrategyBadge: React.FC<StrategyBadgeProps> = ({
  strategy,
  className,
  showIcon = true,
}) => {
  if (!strategy || !strategy.trim() || strategy === '-') {
    return <span className="text-muted-foreground text-xs font-mono">-</span>
  }

  const items = parseStrategy(strategy)
  if (items.length === 0) {
    return <span className="text-muted-foreground text-xs font-mono">-</span>
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {items.map((item, idx) => {
        let badgeStyle =
          'bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/15'
        let IconComponent = Bot

        if (item.source === 'telegram') {
          badgeStyle =
            'bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/15'
          IconComponent = Send
        } else if (item.source === 'system') {
          badgeStyle =
            'bg-zinc-500/15 text-zinc-300 border-zinc-500/30 hover:bg-zinc-500/20'
          IconComponent = Clock
        } else if (item.source === 'manual') {
          badgeStyle =
            'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/15'
          IconComponent = UserCheck
        }

        return (
          <Tooltip key={`${item.raw}-${idx}`}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1.5 transition-all shadow-xs cursor-pointer select-none max-w-[140px]',
                  badgeStyle
                )}
              >
                {showIcon && (
                  <IconComponent className="h-3 w-3 shrink-0 opacity-80" />
                )}
                {item.actionTag && (
                  <span
                    className={cn(
                      'text-[9px] font-mono px-1 py-0.2 rounded font-bold uppercase tracking-tight shrink-0',
                      item.actionTag === 'SL'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : item.actionTag === 'TGT'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    )}
                  >
                    {item.actionTag}
                  </span>
                )}
                <span className="font-mono font-bold tracking-tight uppercase truncate">
                  {item.shortCode}
                </span>
                {item.lotTag && (
                  <span className="text-[10px] font-mono font-semibold px-1 py-0 bg-background/50 border border-border/60 rounded text-foreground/80 shrink-0">
                    {item.lotTag}
                  </span>
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs p-2.5 max-w-sm space-y-2 border border-border shadow-lg bg-popover text-popover-foreground">
              <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  {item.source === 'telegram' ? (
                    <>
                      <Send className="h-3.5 w-3.5 text-sky-400" />
                      <span className="text-sky-300">Telegram Community Signal</span>
                    </>
                  ) : item.source === 'system' ? (
                    <>
                      <Clock className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="text-zinc-300">Automated System Sentry</span>
                    </>
                  ) : item.source === 'manual' ? (
                    <>
                      <UserCheck className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-amber-300">Manual User Execution</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-purple-300">Sovereign Algo Engine</span>
                    </>
                  )}
                </div>
                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                  {item.shortCode}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-medium text-foreground">
                  {item.displayName}
                </div>
                {item.lotTag && (
                  <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-400" />
                    <span>Allocated Volume: <strong className="text-foreground">{item.lotTag}</strong></span>
                  </div>
                )}
              </div>

              <div className="pt-1.5 border-t border-border/40 text-[10px] font-mono text-muted-foreground/80 break-all">
                Raw: {item.raw}
              </div>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
