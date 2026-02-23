import { prisma } from './cache';
import { PriceHistoryService } from './price-history';

export class HistoryWarmQueue {
    private static isProcessing = false;
    private static pendingQueue: { assetType: 'STOCK' | 'CRYPTO', symbol: string }[] = [];

    /**
     * Enqueues a symbol to have its 3-year history cached.
     * Deduplicates in-memory to prevent spamming.
     */
    static async enqueue(symbol: string, assetType: 'STOCK' | 'CRYPTO', reason: string) {
        // In-memory dedup
        if (this.pendingQueue.some(item => item.symbol === symbol && item.assetType === assetType)) {
            return;
        }

        try {
            // Check status in DB
            const existing = await prisma.symbolCacheState.findUnique({
                where: { assetType_symbol: { assetType, symbol } }
            });

            if (existing) {
                if (existing.status === 'READY') return;
                if (existing.status === 'FAILED' && existing.lastAttemptAt) {
                    // Backoff 1 hour on failure
                    if (Date.now() - existing.lastAttemptAt.getTime() < 3600000) return;
                }
            }

            await prisma.symbolCacheState.upsert({
                where: { assetType_symbol: { assetType, symbol } },
                update: { status: 'PENDING' },
                create: {
                    assetType,
                    symbol,
                    status: 'PENDING'
                }
            });

            this.pendingQueue.push({ assetType, symbol });
            this.processQueue();
            console.log(`[HistoryQueue] Enqueued ${symbol} (${assetType}) via ${reason}`);
        } catch (e) {
            console.error(`[HistoryQueue] Failed to enqueue ${symbol}:`, e);
        }
    }

    private static async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.pendingQueue.length > 0) {
            const item = this.pendingQueue.shift();
            if (!item) continue;

            await prisma.symbolCacheState.update({
                where: { assetType_symbol: { assetType: item.assetType, symbol: item.symbol } },
                data: { lastAttemptAt: new Date() }
            });

            try {
                // Rate limit (2s between requests)
                await new Promise(r => setTimeout(r, 2000));

                await PriceHistoryService.backfillSymbol(item.symbol, item.assetType);

                await prisma.symbolCacheState.update({
                    where: { assetType_symbol: { assetType: item.assetType, symbol: item.symbol } },
                    data: { status: 'READY', lastSuccessAt: new Date() }
                });
            } catch (e: any) {
                await prisma.symbolCacheState.update({
                    where: { assetType_symbol: { assetType: item.assetType, symbol: item.symbol } },
                    data: { status: 'FAILED', lastError: e.message }
                });
            }
        }

        this.isProcessing = false;
    }
}
