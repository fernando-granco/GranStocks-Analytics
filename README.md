# GranStocks Analytics

GranStocks is a sophisticated, lightweight stock and crypto analysis platform designed for traders who want deterministic technical insights and AI-driven narrative synthesis. It combines real-time data from financial markets with advanced technical indicators and multi-provider LLM integration.

## Key Features

- **Multi-Asset Tracking**: Track both US Stocks and Cryptocurrencies in a unified dashboard leveraging a multi-source data engine with fallback capabilities.
- **Custom Universes**: Group assets into self-defined "Universes" to analyze sectors, themes, or personal watchlists collectively.
- **Deterministic Technicals**: Every asset is automatically analyzed at the end of the day or upon tracking, calculating RSI14, Trend (SMA20/50), and Volatility (20-day).
- **Group AI Analysis**: Use your own language models to generate macro narratives for an entire group of stocks at once.
- **Draggable UI**: Fully customizable card layouts on the Dashboard and Universe pages—drag and drop your most important assets to the top.
- **Historical Relative Performance**: Visualize how every asset in a universe performed over the last 90 days with normalized comparison charts.
- **Zero-Storage Privacy**: Sensitive API keys for AI providers are AES-256-GCM encrypted at rest in the local SQLite database.

## How It Works

### 1. Data Aggregation
The platform interfaces with a robust multi-source market data engine for equities and a dedicated crypto exchange data feed for digital assets. It pulls deep historical daily candles to ensure technical indicators are statistically significant.

### 2. The Indicator Pipeline
A specialized background service runs daily to process every tracked asset. It doesn't just store prices; it calculates technical sentiment based on moving average crossovers and relative strength. This deterministic data is what fuels the AI.

### 3. Bring-Your-Own-Key (BYOK) LLM Integration
Instead of paying for expensive monthly AI subscriptions, users plug in their own API keys via a bring-your-own-key LLM integration. The "Narrative Engine" sends the *technical indicators* (not just prices) to the AI to get a reasoned analysis of the asset's current state.

### 4. Custom Universes & Multi-Asset Charting
The "Universe Builder" allows you to create dynamic buckets of stocks. The platform then normalizes their historical prices to a common starting point (100%), allowing you to see exactly which stock in a group is leading or lagging in a single "Spaghetti Chart" view.

---

*Disclaimer: Educational analysis only — not financial advice. Predictions are uncertain and may be wrong. AI-generated commentary may be inaccurate.*
