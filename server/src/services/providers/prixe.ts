import { z } from 'zod';

const PRIXE_API_KEY = process.env.PRIXE_API_KEY || '';
const PRIXE_BASE_URL = 'https://api.prixe.io/api';

export class PrixeProvider {
    static async getQuote(symbol: string) {
        if (!PRIXE_API_KEY) throw new Error('PRIXE_API_KEY not configured');

        try {
            const res = await fetch(`${PRIXE_BASE_URL}/last_sold`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PRIXE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ticker: symbol })
            });

            if (!res.ok) throw new Error(`Prixe Quote Error: ${res.status}`);
            const data = await res.json();

            // Expected response: { lastSalePrice: "$58.79", lastTradeTimestamp: "...", ticker: "..." }
            if (!data.lastSalePrice) throw new Error('No quote data from Prixe');

            const price = parseFloat(data.lastSalePrice.replace(/[^0-9.]/g, ''));

            return {
                symbol,
                assetType: 'STOCK',
                price,
                changeAbs: 0, // Prixe last_sold doesn't seem to provide change directly
                changePct: 0,
                ts: data.lastTradeTimestamp ? new Date(data.lastTradeTimestamp).getTime() : Date.now(),
                source: 'PRIXE',
                isStale: false
            };
        } catch (e) {
            console.error(`[PrixeProvider] getQuote failed for ${symbol}:`, e);
            throw e;
        }
    }

    static async getCandles(symbol: string, start_date: string, end_date: string, interval: string = '1d') {
        if (!PRIXE_API_KEY) throw new Error('PRIXE_API_KEY not configured');

        try {
            const res = await fetch(`${PRIXE_BASE_URL}/price`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PRIXE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ticker: symbol,
                    start_date,
                    end_date,
                    interval
                })
            });

            if (!res.ok) throw new Error(`Prixe Candle Error: ${res.status}`);
            const json = await res.json();

            if (!json.success || !json.data || !json.data.close) {
                throw new Error('Invalid candle data from Prixe');
            }

            const d = json.data;
            return {
                s: 'ok',
                t: d.timestamp,
                o: d.open,
                h: d.high,
                l: d.low,
                c: d.close,
                v: d.volume,
                source: 'PRIXE'
            };
        } catch (e) {
            console.error(`[PrixeProvider] getCandles failed for ${symbol}:`, e);
            throw e;
        }
    }

    static async getNews(symbol: string) {
        if (!PRIXE_API_KEY) throw new Error('PRIXE_API_KEY not configured');

        try {
            const res = await fetch(`${PRIXE_BASE_URL}/news`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PRIXE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ticker: symbol, ai_summary: true })
            });

            if (!res.ok) throw new Error(`Prixe News Error: ${res.status}`);
            const json = await res.json();

            // Response structure based on docs: { news_data: { data: [...] }, success: true }
            const news = json.news_data?.data || [];

            return news.map((n: any) => ({
                headline: n.title,
                summary: n.description || n.summary || '',
                url: n.url || n.link,
                source: n.source || 'Prixe',
                datetime: Math.floor(new Date(n.published_at || n.date || Date.now()).getTime() / 1000)
            }));
        } catch (e) {
            console.error(`[PrixeProvider] getNews failed for ${symbol}:`, e);
            throw e;
        }
    }
}
