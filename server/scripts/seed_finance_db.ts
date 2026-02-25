import * as fs from 'fs';
import * as path from 'path';

// This script simulates fetching the large FinanceDatabase (or processing it)
// into a lightweight format suitable for quick regex/exact match filtering on our VPS.
// Real production would fetch from https://github.com/JerBouma/FinanceDatabase

interface FinDBAsset {
    symbol: string;
    name: string;
    exchange: string;
    sector: string;
    industry: string;
    country: string;
}

const dbPath = path.join(__dirname, '..', 'data', 'finance_db.json');

async function seedMockDB() {
    console.log('Seeding lightweight FinanceDatabase mock...');

    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const mockData: FinDBAsset[] = [
        { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Consumer Electronics', country: 'United States' },
        { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology', industry: 'Software—Infrastructure', country: 'United States' },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Banks—Diversified', country: 'United States' },
        { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Credit Services', country: 'United States' },
        { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
        { symbol: 'TSM', name: 'Taiwan Semiconductor', exchange: 'NYSE', sector: 'Technology', industry: 'Semiconductors', country: 'Taiwan' },
        { symbol: 'NVO', name: 'Novo Nordisk', exchange: 'NYSE', sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'Denmark' },
        { symbol: 'SAP', name: 'SAP SE', exchange: 'NYSE', sector: 'Technology', industry: 'Software—Application', country: 'Germany' },
        { symbol: 'RY', name: 'Royal Bank of Canada', exchange: 'NYSE', sector: 'Financial Services', industry: 'Banks—Diversified', country: 'Canada' },
        { symbol: 'BHP', name: 'BHP Group', exchange: 'NYSE', sector: 'Basic Materials', industry: 'Other Industrial Metals', country: 'Australia' },
        { symbol: 'PETR4.SA', name: 'Petróleo Brasileiro S.A. - Petrobras', exchange: 'BVMF', sector: 'Energy', industry: 'Oil & Gas Integrated', country: 'Brazil' },
        { symbol: 'VALE3.SA', name: 'Vale S.A.', exchange: 'BVMF', sector: 'Basic Materials', industry: 'Other Industrial Metals', country: 'Brazil' },
        { symbol: 'ITUB4.SA', name: 'Itaú Unibanco Holding S.A.', exchange: 'BVMF', sector: 'Financial Services', industry: 'Banks—Regional', country: 'Brazil' }
    ];

    fs.writeFileSync(dbPath, JSON.stringify(mockData, null, 2));
    console.log(`Wrote ${mockData.length} mock items to ${dbPath}`);
    console.log('Use this script in production to parse the true 100k+ JSON files.');
}

seedMockDB().catch(console.error);
