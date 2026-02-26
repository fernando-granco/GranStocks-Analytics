import { ScreenerService } from '../src/services/screener';

async function main() {
    const universe = (process.argv[2] as 'SP500' | 'NASDAQ100' | 'CRYPTO' | 'TSX60' | 'IBOV') || 'TSX60';
    console.log(`Starting manual force run for ${universe}`);
    await ScreenerService.runScreenerJob(universe, new Date().toISOString().split('T')[0]);
    console.log("Done");
}

main().catch(console.error);
