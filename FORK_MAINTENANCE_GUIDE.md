# OpenAlgo Fork Maintenance & Upstream Sync Discipline

> **Target Repository:** `0codedev/openalgo`  
> **Upstream Parent:** `marketcalls/openalgo`  
> **Branch Strategy:** `main` tracking upstream with personal enhancements  
> **Primary Safety Mechanism:** `openalgo_custom_modifications.patch` + automated sync script  

---

## 1. Overview of Fork Architecture

`0codedev/openalgo` is a production fork tailored for the WealthOS v2 multi-engine ecosystem. It introduces custom routing, strategy attribution, and native option contract charting while preserving full upstream compatibility with MarketCalls releases.

### Remote Configuration
- `origin`: `https://github.com/0codedev/openalgo.git` (Your personal fork)
- `upstream`: `https://github.com/marketcalls/openalgo.git` (Official upstream repository)

Verify configured remotes at any time:
```powershell
git remote -v
```

---

## 2. Complete Inventory of Custom Modifications

All modifications in this fork are modular and isolated to prevent upstream merge conflicts:

### A. Phase 1 Enhancements (Order Book, Options & Terminal Hydration)
1. **Order Book Strategy Column (`frontend/src/pages/OrderBook.tsx`, `frontend/src/types/trading.ts`)**:
   - Added `strategy?: string` to `Order` interface.
   - Added stylized Strategy badge column in Order Book table.
   - Included Strategy in CSV export.
2. **Native Option Charting (`OrderBook.tsx`, `Positions.tsx`, `TradeBook.tsx`, `SandboxPnL.tsx`)**:
   - Replaced old regex that stripped strike and expiry for TradingView.
   - Derivative contracts ending in `CE` or `PE` route directly to native canvas terminal at `/trading?symbol=<SYMBOL>&exchange=<EXCHANGE>`.
   - Cash equity symbols open TradingView in a new tab.
3. **URL Parameter Hydration in Native Terminal (`frontend/src/pages/Trading.tsx`, `frontend/src/lib/trading/terminal.ts`)**:
   - Pane `p0` observes `useSearchParams` from React Router and loads incoming symbols on mount or route transition.
   - `TradingTerminal.init()` is guarded to avoid clobbering active URL symbols with the default BHEL fallback.

### B. Phase 2 Enhancements (Positions Strategy Attribution)
1. **Database Schema & Non-Destructive Migration (`database/sandbox_db.py`)**:
   - Added `strategy = Column(String(100), nullable=True)` to `SandboxPositions`.
   - Added `_migrate_add_position_strategy()` that executes `ALTER TABLE sandbox_positions ADD COLUMN strategy VARCHAR(100)` only if missing.
2. **Execution Engine Attribution (`sandbox/execution_engine.py`)**:
   - Sets `position.strategy = order.strategy` on position creation, reopening, and reversal.
   - Appends comma-separated strategy names if multiple strategies add to the same contract.
3. **Position Manager & API Serializers (`sandbox/position_manager.py`, `blueprints/sandbox.py`, `blueprints/orders.py`)**:
   - Serializes `strategy` in `get_open_positions` and `api_my_pnl_data`.
   - Adds Strategy column to position CSV exports.
4. **Positions UI (`frontend/src/pages/Positions.tsx`, `frontend/src/pages/SandboxPnL.tsx`)**:
   - Added Strategy column and badge to Positions table, group headers, and summary footers.
   - Added Strategy column and badge to Sandbox PnL position-wise breakdown.

### C. System & Authentication Routes
1. **Mock Upstox Login (`blueprints/auth.py`, `blueprints/react_app.py`)**:
   - Provides mock authentication for sandbox testing without requiring an active third-party token renewal on local development.

---

## 3. How to Synchronize with Upstream (`sync-upstream.ps1`)

The repository includes an automated synchronization script at `scripts/sync-upstream.ps1`.

### Safe Local Test (Dry-Run / Skip Push)
To fetch, merge upstream, run migrations, rebuild frontend, and update the patch file without pushing to GitHub:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-upstream.ps1 -SkipPush
```

### Full Production Sync & Push
To sync with upstream and push the result to `0codedev/openalgo:main`:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-upstream.ps1
```

### What `sync-upstream.ps1` Does Automatically:
1. **Backs up environment files** (`.env*`) into `db/backups/`.
2. **Fetches upstream** (`git fetch upstream main --no-tags`).
3. **Merges upstream** (`git merge upstream/main --no-edit`).
4. **Syncs Python dependencies** via `uv sync` and runs database migrations.
5. **Builds frontend assets** via `npm run build` in `frontend/`.
6. **Exports the custom patch file** (`openalgo_custom_modifications.patch`).
7. **Pushes to origin** (`git push origin main`), unless `-SkipPush` is passed.

---

## 4. Emergency Recovery via Patch File

If an upstream merge ever introduces conflicts or if you clone a clean copy of MarketCalls OpenAlgo, you can restore all custom modifications with one command:

```powershell
git apply --reject --whitespace=fix .\openalgo_custom_modifications.patch
```

To regenerate or verify the patch at any time:
```powershell
git diff upstream/main frontend/src blueprints database sandbox > openalgo_custom_modifications.patch
```

---

## 5. Verification Checklist After Any Sync

After every upstream synchronization, verify the following:
- [ ] `npm run build` inside `frontend/` succeeds with 0 errors.
- [ ] `uv run python -c "from database.sandbox_db import init_db; init_db()"` succeeds.
- [ ] `/orderbook` displays the Strategy column and badges.
- [ ] `/positions` displays the Strategy column and badges.
- [ ] Clicking any option contract ending in `CE` or `PE` opens `/trading?symbol=...&exchange=...`.
