import { prisma } from './cache';
import { MarketData } from './market-data';

export class AlertService {
    /**
     * Called at the end of the day or immediately after historical prices hydrate.
     * Evaluates all active alerts for that specific symbol.
     */
    static async evaluateAlerts(symbol: string, assetType: 'STOCK' | 'CRYPTO', currentPrice: number, currentRsi?: number) {
        const activeAlerts = await prisma.alertRule.findMany({
            where: { symbol, isActive: true },
            include: { user: true }
        });

        if (activeAlerts.length === 0) return;

        for (const alert of activeAlerts) {
            let triggered = false;

            switch (alert.conditionType) {
                case 'PRICE_ABOVE':
                    triggered = currentPrice > alert.thresholdValue;
                    break;
                case 'PRICE_BELOW':
                    triggered = currentPrice < alert.thresholdValue;
                    break;
                case 'RSI_ABOVE':
                    if (currentRsi !== undefined) triggered = currentRsi > alert.thresholdValue;
                    break;
                case 'RSI_BELOW':
                    if (currentRsi !== undefined) triggered = currentRsi < alert.thresholdValue;
                    break;
            }

            if (triggered) {
                // Log and temporarily deactivate or update lastTriggeredAt to avoid spamming
                console.log(`[ALERT TRIGGERED] User ${alert.user.email} | Symbol ${symbol} | Condition ${alert.conditionType} @ ${alert.thresholdValue} | Current Price $${currentPrice}`);

                // Send email (Mock service)
                console.log(`[Email Service Stub] Sending "Alert Trigger: ${symbol}" to ${alert.user.email}`);

                // Mark as triggered recently so it doesn't fire every 5 minutes if prices hover
                await prisma.alertRule.update({
                    where: { id: alert.id },
                    data: { lastTriggeredAt: new Date() }
                });
            }
        }
    }
}
