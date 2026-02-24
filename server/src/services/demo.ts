import { prisma } from './cache';
import { MarketData } from './market-data';
import { toDateString } from '../utils/date-helpers';
import { ScreenerService } from './screener';

export class DemoService {
    /**
     * Demo instances are now locked to Jan 1, 2026.
     * Dynamic rebuild is disabled to prevent overwriting the static snapshot.
     */
    static async rebuildDemoSnapshots() {
        console.log('🏗️  Skipping dynamic demo rebuild. Static snapshot (Jan 1, 2026) is active.');
        return;
    }
}
