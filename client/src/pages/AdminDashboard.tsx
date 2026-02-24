import { useState } from 'react';
import { Users, Ticket, Activity, HardDrive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AdminUsers from './AdminUsers';
import AdminInvites from './AdminInvites';

export default function AdminDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'USERS' | 'INVITES' | 'JOBS' | 'CACHE'>('USERS');
    const [backfillStatus, setBackfillStatus] = useState('');

    const handleBackfill = async (universe: string) => {
        setBackfillStatus(`Backfilling ${universe}...`);
        try {
            const res = await fetch('/api/admin/price-history/backfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ universe })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Backfill failed');
            setBackfillStatus(`✓ ${universe} backfill started for ${data.total} symbols — check server logs for progress.`);
        } catch (e: any) {
            setBackfillStatus(`✗ ${e.message}`);
        }
        setTimeout(() => setBackfillStatus(''), 6000);
    };

    if (!['ADMIN', 'SUPERADMIN'].includes(user?.role || '')) {
        return <div className="p-8 text-center text-rose-400">Unauthorized. Admin access required.</div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
                <p className="text-neutral-500">Manage users, systems, jobs, and platform health.</p>
            </div>

            <div className="flex border-b border-neutral-800 gap-2 pb-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('USERS')}
                    className={`px-4 py-2 font-medium flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'USERS' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 border border-transparent'}`}
                >
                    <Users size={16} /> Users
                </button>
                <button
                    onClick={() => setActiveTab('INVITES')}
                    className={`px-4 py-2 font-medium flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'INVITES' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 border border-transparent'}`}
                >
                    <Ticket size={16} /> Invites
                </button>
                <button
                    onClick={() => setActiveTab('JOBS')}
                    className={`px-4 py-2 font-medium flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'JOBS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 border border-transparent'}`}
                >
                    <Activity size={16} /> Jobs & Queues
                </button>
                <button
                    onClick={() => setActiveTab('CACHE')}
                    className={`px-4 py-2 font-medium flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'CACHE' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 border border-transparent'}`}
                >
                    <HardDrive size={16} /> Cache Health
                </button>
            </div>

            <div className="mt-8">
                {activeTab === 'USERS' && <AdminUsers />}
                {activeTab === 'INVITES' && <AdminInvites />}
                {activeTab === 'JOBS' && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h3 className="text-xl font-semibold mb-4 text-emerald-400">Jobs & Queue Operations</h3>
                        <p className="text-neutral-500 text-sm mb-6">Monitor background workers and manually trigger system tasks.</p>
                        <div className="text-center p-12 border border-dashed border-neutral-800 rounded-xl text-neutral-600 font-mono text-sm">
                            [WIP] Job queue API integration pending...
                        </div>
                    </div>
                )}
                {activeTab === 'CACHE' && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h3 className="text-xl font-semibold mb-4 text-blue-400">Price History Cache / Backfill</h3>
                        <p className="text-neutral-500 text-sm mb-6">Download up to 3 years of OHLCV for each universe to enable API-free screener predictions and instant analysis.</p>

                        <div className="flex flex-wrap gap-3 mb-4">
                            {(['SP500', 'NASDAQ100', 'CRYPTO'] as const).map(u => (
                                <button
                                    key={u}
                                    onClick={() => handleBackfill(u)}
                                    className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-medium text-sm rounded-lg transition-colors"
                                >
                                    ↓ Backfill {u}
                                </button>
                            ))}
                        </div>
                        {backfillStatus && (
                            <p className="text-sm font-mono text-neutral-300 bg-neutral-950 p-3 rounded border border-neutral-800">
                                {backfillStatus}
                            </p>
                        )}

                        <hr className="my-6 border-neutral-800" />
                        <h4 className="text-sm font-semibold text-neutral-400 mb-2">Cache Health Metrics</h4>
                        <div className="text-center p-8 border border-dashed border-neutral-800 rounded-xl text-neutral-600 font-mono text-sm inline-block w-full">
                            [WIP] SymbolCacheState Analytics pending...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
