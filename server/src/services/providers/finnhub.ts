import { prisma } from '../cache';
import { z } from 'zod';
import { toDateString } from '../../utils/date-helpers';

export class FinnhubProvider {
    static getApiKey(): string {
        const key = process.env.FINNHUB_API_KEY;
        if (!key) throw new Error("FINNHUB_API_KEY is not configured.");
        return key;
    }

    static async getFundamentals(symbol: string) {
        // Try DB cache first (updated today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cached = await prisma.assetFundamental.findUnique({
            where: { symbol }
        });

        if (cached && cached.updatedAt >= today) {
            return cached;
        }

        const url = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${this.getApiKey()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Finnhub returned ${res.status}`);

        const raw = await res.json();
        if (!raw || !raw.metric) return null;

        const metrics = raw.metric;

        // Save to cache
        const updated = await prisma.assetFundamental.upsert({
            where: { symbol },
            update: {
                peRatio: metrics.peNormalizedAnnual,
                eps: metrics.epsNormalizedAnnual,
                marketCap: metrics.marketCapitalization,
                fiftyTwoWeekHigh: metrics['52WeekHigh'],
                fiftyTwoWeekLow: metrics['52WeekLow'],
                targetPrice: metrics.targetMeanPrice || null,
                updatedAt: new Date()
            },
            create: {
                symbol,
                peRatio: metrics.peNormalizedAnnual,
                eps: metrics.epsNormalizedAnnual,
                marketCap: metrics.marketCapitalization,
                fiftyTwoWeekHigh: metrics['52WeekHigh'],
                fiftyTwoWeekLow: metrics['52WeekLow'],
                targetPrice: metrics.targetMeanPrice || null,
                updatedAt: new Date()
            }
        });

        return updated;
    }

    static async getEarningsCalendar(symbol: string) {
        // Cache in memory for earnings to prevent UI spamming, and sync to DB
        // Search for upcoming earnings (today to +60 days)
        const cache = await prisma.earningsEvent.findMany({
            where: { symbol, date: { gte: toDateString() } },
            orderBy: { date: 'asc' }
        });

        if (cache.length > 0) return cache;

        const start = toDateString();
        const endDay = new Date();
        endDay.setDate(endDay.getDate() + 90);
        const end = toDateString(endDay);

        const url = `https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${start}&to=${end}&token=${this.getApiKey()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Finnhub returned ${res.status}`);

        const raw = await res.json();
        const events = raw.earningsCalendar || [];

        for (const e of events) {
            await prisma.earningsEvent.upsert({
                where: { symbol_date: { symbol: e.symbol, date: e.date } },
                update: {
                    epsEstimate: e.epsEstimate,
                    epsActual: e.epsActual,
                    revenueEstimate: e.revenueEstimate,
                    revenueActual: e.revenueActual
                },
                create: {
                    symbol: e.symbol,
                    date: e.date,
                    epsEstimate: e.epsEstimate,
                    epsActual: e.epsActual,
                    revenueEstimate: e.revenueEstimate,
                    revenueActual: e.revenueActual
                }
            });
        }

        return await prisma.earningsEvent.findMany({
            where: { symbol, date: { gte: start } },
            orderBy: { date: 'asc' }
        });
    }

    static async getNews(symbol: string, from: string, to: string) {
        // Find existing news in DB
        const cachedFiles = await prisma.assetNews.findMany({
            where: { symbol, publishedAt: { gte: new Date(from), lte: new Date(to) } },
            orderBy: { publishedAt: 'desc' }
        });

        // 6-hour refresh staleness logic
        const cacheIsStale = cachedFiles.length === 0 || (Date.now() - new Date(cachedFiles[0].createdAt).getTime() > 6 * 60 * 60 * 1000);

        if (!cacheIsStale) return cachedFiles;

        const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${this.getApiKey()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Finnhub returned ${res.status}`);

        const articles = await res.json();

        const bullishKeywords = ['jump', 'surge', 'beat', 'growth', 'up', 'higher', 'partnership', 'acquire', 'new', 'buy', 'upgrade', 'exceed', 'record', 'profit'];
        const bearishKeywords = ['tumble', 'fall', 'miss', 'decline', 'down', 'lower', 'lawsuit', 'sell', 'downgrade', 'shortfall', 'loss', 'cut'];

        // Add naive sentiment heuristic if LLM isn't hooked in heavily here
        for (const article of articles) {
            const headline = article.headline.toLowerCase();
            const summary = article.summary.toLowerCase();
            const text = `${headline} ${summary}`;

            let score = 0;
            for (const word of bullishKeywords) { if (text.includes(word)) score += 0.5; }
            for (const word of bearishKeywords) { if (text.includes(word)) score -= 0.5; }

            // Clamp score between -1 and 1
            const sentimentScore = Math.max(-1, Math.min(1, score));

            if (!article.url) continue;

            await prisma.assetNews.upsert({
                where: { url: article.url },
                update: {
                    headline: article.headline,
                    summary: article.summary,
                    source: article.source,
                    sentimentScore
                },
                create: {
                    symbol,
                    headline: article.headline,
                    summary: article.summary,
                    source: article.source,
                    url: article.url,
                    publishedAt: new Date(article.datetime * 1000),
                    sentimentScore
                }
            });
        }

        return await prisma.assetNews.findMany({
            where: { symbol, publishedAt: { gte: new Date(from), lte: new Date(to) } },
            orderBy: { publishedAt: 'desc' },
            take: 20
        });
    }
}
