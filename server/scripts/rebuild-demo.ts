import { DemoService } from '../src/services/demo';

async function main() {
    await DemoService.rebuildDemoSnapshots();
    process.exit(0);
}

main().catch(console.error);
