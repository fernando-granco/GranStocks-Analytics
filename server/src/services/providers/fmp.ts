const FMP_API_KEY = process.env.FMP_API_KEY || '';
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

export class FMPProvider {
    static async getQuote(symbol: string) {
        if (!FMP_API_KEY) throw new Error('FMP_API_KEY not configured');

        try {
            // Stable endpoint for 2026
            const res = await fetch(`${FMP_BASE_URL}/quote?symbol=${symbol}&apikey=${FMP_API_KEY}`);
            if (!res.ok) throw new Error(`FMP Quote Error: ${res.status}`);

            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No quote data from FMP');
            }

            const quote = data[0];

            return {
                symbol,
                assetType: 'STOCK',
                price: quote.price,
                changeAbs: quote.change || 0,
                changePct: quote.changePercentage || 0, // In stable it is changePercentage
                ts: quote.timestamp * 1000 || Date.now(),
                source: 'FMP',
                isStale: false
            };
        } catch (e) {
            console.error(`[FMPProvider] getQuote failed for ${symbol}:`, e);
            throw e;
        }
    }

    static async getCandles(symbol: string) {
        if (!FMP_API_KEY) throw new Error('FMP_API_KEY not configured');

        try {
            // Stable historical endpoint for 2026
            const res = await fetch(`${FMP_BASE_URL}/historical-price-eod/full?symbol=${symbol}&apikey=${FMP_API_KEY}`);
            if (!res.ok) throw new Error(`FMP Candle Error: ${res.status}`);

            const data = await res.json();
            if (!Array.isArray(data)) {
                throw new Error('Invalid candle data from FMP (expected array)');
            }

            // FMP stable historical returns newest first
            const history = [...data].reverse();

            return {
                s: 'ok',
                t: history.map((k: any) => Math.floor(new Date(k.date).getTime() / 1000)),
                o: history.map((k: any) => k.open),
                h: history.map((k: any) => k.high),
                l: history.map((k: any) => k.low),
                c: history.map((k: any) => k.close),
                v: history.map((k: any) => k.volume),
                source: 'FMP'
            };
        } catch (e) {
            console.error(`[FMPProvider] getCandles failed for ${symbol}:`, e);
            throw e;
        }
    }
}
