import { PortfolioTracker } from '../components/PortfolioTracker';
import { Package } from 'lucide-react';

export default function Portfolio() {
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Package className="text-indigo-500" /> Asset Portfolio</h1>
                <p className="text-neutral-500">Detailed view of your actively tracked positions, cost basis accounting, and unrealized returns.</p>
            </div>

            <div className="mt-8">
                <PortfolioTracker />
            </div>
        </div>
    );
}
