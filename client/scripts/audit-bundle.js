import fs from 'fs';
import path from 'path';

// NON-NEGOTIABLE SECURITY RULES VALIDATOR
// Scans the client bundle for severe security violations like leaked backend APIs

const BUNDLE_DIR = path.join(process.cwd(), 'dist', 'assets');
const FORBIDDEN_STRINGS = [
    'finnhub.io',
    'api.openai',
    'openai.com',
    'generativelanguage.googleapis.com',
    'deepseek',
    'authorization bearer', // Case insensitive later
    'x-api-key',
    'FINNHUB_API_KEY',
    'sk-'
];

if (!fs.existsSync(BUNDLE_DIR)) {
    console.warn("No dist/assets dir found. Did build run?");
    process.exit(0);
}

const files = fs.readdirSync(BUNDLE_DIR);
let failed = false;

for (const file of files) {
    if (file.endsWith('.js') || file.endsWith('.css')) {
        const content = fs.readFileSync(path.join(BUNDLE_DIR, file), 'utf8').toLowerCase();
        for (const forbidden of FORBIDDEN_STRINGS) {
            if (content.includes(forbidden.toLowerCase())) {
                console.error(`\u001b[31m[SECURITY AUDIT FAILED]\u001b[0m File ${file} contains forbidden string: "${forbidden}"`);
                failed = true;
            }
        }
    }
}

if (failed) {
    console.error("The bundled client code contains sensitive keywords implying direct API calls or leaked keys. BUILD REJECTED.");
    process.exit(1);
}

console.log("\u001b[32m[SECURITY AUDIT PASSED]\u001b[0m No forbidden strings found in client bundle.");
process.exit(0);
