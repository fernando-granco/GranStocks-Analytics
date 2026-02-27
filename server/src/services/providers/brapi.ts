const BRAPI_API_KEY = process.env.BRAPI_API_KEY || '';
const BRAPI_BASE_URL = 'https://brapi.dev/api';

export class BrapiProvider {
    /**
     * Strips the .SA suffix for brapi requests
     */
    static normalizeSymbol(symbol: string): string {
        return symbol.replace(/\.SA$/i, '');
    }

    static async getQuote(symbol: string) {
        if (!BRAPI_API_KEY) throw new Error('BRAPI_API_KEY not configured');
        const ticker = this.normalizeSymbol(symbol);

        try {
            const res = await fetch(`${BRAPI_BASE_URL}/quote/${ticker}?token=${BRAPI_API_KEY}`);
            if (!res.ok) throw new Error(`Brapi Quote Error: ${res.status}`);

            const data = await res.json();
            if (!data.results || data.results.length === 0) {
                throw new Error('No quote data from Brapi');
            }

            const quote = data.results[0];

            return {
                symbol, // Keep original .SA symbol for the app
                assetType: 'STOCK',
                price: quote.regularMarketPrice,
                changeAbs: quote.regularMarketChange || 0,
                changePct: quote.regularMarketChangePercent || 0,
                ts: new Date(quote.regularMarketTime).getTime() || Date.now(),
                source: 'BRAPI',
                isStale: false
            };
        } catch (e) {
            console.error(`[BrapiProvider] getQuote failed for ${symbol}:`, e);
            throw e;
        }
    }

    static async getCandles(symbol: string, rangeStr: string) {
        if (!BRAPI_API_KEY) throw new Error('BRAPI_API_KEY not configured');
        const ticker = this.normalizeSymbol(symbol);

        // Map app range strings to Brapi range strings
        // Brapi supports: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
        const mapRange: Record<string, string> = {
            '1d': '1d',
            '1w': '5d',
            '1m': '1mo',
            '3m': '3mo',
            '6m': '6mo',
            '1y': '1y',
            '2y': '2y',
            '3y': '5y', // Brapi doesn't have 3y, step up to 5y and we'll slice later or just return it
            '5y': '5y',
            'all': 'max'
        };

        const range = mapRange[rangeStr] || '6mo';
        const interval = ['1d', '1w'].includes(rangeStr) ? '1h' : '1d';

        try {
            const res = await fetch(`${BRAPI_BASE_URL}/quote/${ticker}?range=${range}&interval=${interval}&token=${BRAPI_API_KEY}`);
            if (!res.ok) throw new Error(`Brapi Candle Error: ${res.status}`);

            const data = await res.json();
            if (!data.results || data.results.length === 0 || !data.results[0].historicalDataPrice) {
                throw new Error('Invalid candle data from Brapi');
            }

            const history = data.results[0].historicalDataPrice;

            // Normalize to {s: 'ok', t: [], o: [], h: [], l: [], c: [], v: []}
            return {
                s: 'ok',
                t: history.map((k: any) => k.date), // Brapi returns unix timestamps in `date`
                o: history.map((k: any) => k.open),
                h: history.map((k: any) => k.high),
                l: history.map((k: any) => k.low),
                c: history.map((k: any) => k.close),
                v: history.map((k: any) => k.volume),
                source: 'BRAPI'
            };
        } catch (e) {
            console.error(`[BrapiProvider] getCandles failed for ${symbol}:`, e);
            throw e;
        }
    }
}
