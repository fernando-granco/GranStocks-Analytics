# GranStocks Analytics - Developer Changelog

## Epics 4 & 5 Released

### Security & Authentication
- **Admin Verification**: Strict middleware (`requireAdmin`) logic now validates user existence, ban thresholds, and forced-password states before resolving the route.
- **Invite Gated Registration**: New backend APIs and `InviteCode` / `InviteCodeUse` Prisma architecture now supports locking down production registration behind generated multi-use invitation keys.
- **Bring-Your-Own-Key Auditing**: Permanently stripped the unverified `OLLAMA` provider and fortified SSRF filtering mechanism in `validateBaseUrl` to permanently drop internal service hits (e.g., localhost).
- **Prompt Safety & Sizing**: Truncated all `{{EVIDENCE_PACK}}` variables to strictly 25,000 strings before parsing or issuing LLM requests, avoiding runaway inference costs and model collapse.

### Core Data & Technicals
- **Dynamic Price Backfill Cache**: Instituted global shared 3-Year Historical History Cache mechanisms. Administrators can now bulk-download OHLCV ranges manually via the Dashboard, averting cascading hits against upstream APIs for large lists of identical equities.
- **Extensive Technical Suite**: Upended the daily asset computation engine to incorporate native support for determining ADX (trend strength), OBV (volume), MFI (money flow), VWAP, ROC, CCI, and Williams %R.
- **Structured Risk Vectors**: Reworked raw text warnings from the backend into highly-structured `{ category, severity, message }` JSON arrays, powering a color-coded intelligence UI on the frontend.

### Frontend Application Layer
- **Unified Admin Dashboard**: Constructed a single `/app/admin` UI featuring tabulated arrays for comprehensive User Control (Ban, Force Reset, Privilege Scaling), Invite Control (CRUD), Data Jobs, and Server Cache.
- **Composed Candlesticks Graphing**: Dismantled the basic linear graphing and introduced heavily responsive, deterministic `<CustomizedCandlestick>` algorithms mapped to a `<ComposedChart>` to accurately render High/Low wicks scaling to 3m, 6m, 1y, and All-Time window brackets.
- **Standalone Portfolio Hub**: Detached the tracking module from simple watchlists into a comprehensive ledger via `/app/portfolio` allowing specific assignments to Crypto vs Stocks.
- **LLM UI Templates**: Upgraded the settings dashboard to simulate real-time variable substitutions for System Prompts, exposing Dropdown-styled formats for toggling models between Standard Text, Raw JSON, and highly-opinionated structured Markdown.
