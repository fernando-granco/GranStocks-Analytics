# Developer Notes: Global History Caching

As of Epic 2, GranStocks Analytics implements a global, server-side historical caching layer (`SymbolCacheState` and `HistoryWarmQueue`).

## Core Concepts
1. **Cache-First Strategy**: The orchestrator (`MarketData.getCandles`) always hits the local `PriceHistory` SQL table first.
2. **Offline Fallback**: If the local DB has fewer candles than the requested trading range, but the external provider fails (API cap, offline), the cache returns whatever it has with `isStale: true` and `lowDataQuality: true`.
3. **Lazy Hydration**: Resolving a Universe, viewing Asset Details, running Screeners, and Tracking an Asset immediately pushes a "cache warming" token to `HistoryWarmQueue`.
4. **Rate Limited Warmup**: `HistoryWarmQueue` deduplicates requests and pulls 3 years of daily history down asynchronously so that the HTTP response doesn't hang. Backfills are separated from real-time client traffic.

## Data Constraints
- Price history rows are locked to `@@unique([assetType, symbol, date])` to prevent collisions between stocks and cryptos with the same ticker symbol.
