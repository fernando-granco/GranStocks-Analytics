import { useState } from 'react';
import { Users, Ticket, Activity, HardDrive, Play, RefreshCw, AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminUsers from './AdminUsers';
import AdminInvites from './AdminInvites';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
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
            queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
        } catch (e: any) {
            setBackfillStatus(`✗ ${e.message}`);
        }
        setTimeout(() => setBackfillStatus(''), 6000);
    };

    // --- Jobs & Queue Data ---
    const { data: jobsData } = useQuery({
        queryKey: ['admin-jobs'],
        queryFn: async () => {
            const res = await fetch('/api/admin/jobs');
            if (!res.ok) throw new Error('Failed to fetch jobs');
            return res.json();
        },
        enabled: activeTab === 'JOBS',
        refetchInterval: (query: any) => {
            const jobs = query.state.data?.jobs;
            if (jobs && jobs.some((j: any) => j.status === 'RUNNING')) return 5000;
            return false;
        }
    });

    // --- Cache Health Data ---
    const { data: cacheData } = useQuery({
        queryKey: ['admin-cache-health'],
        queryFn: async () => {
            const res = await fetch('/api/admin/cache-health');
            if (!res.ok) throw new Error('Failed to fetch cache health');
            return res.json();
        },
        enabled: activeTab === 'CACHE'
    });

    // --- Trigger Mutations ---
    const runDailyMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/admin/run-daily', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to trigger daily job');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
            toast.success('Daily job triggered');
        }
    });

    const runScreenerMutation = useMutation({
        mutationFn: async (universe: string) => {
            const date = new Date().toISOString().split('T')[0];
            const res = await fetch('/api/admin/screener/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ universe, date })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
            toast.success('Screener job triggered');
        },
        onError: (e: any) => toast.error(e.message)
    });

    if (!['ADMIN', 'SUPERADMIN'].includes(user?.role || '')) {
        return <div className="p-8 text-center text-rose-400">Unauthorized. Admin access required.</div>;
    }

    const statusIcon = (status: string) => {
        switch (status) {
            case 'RUNNING': return <Loader2 size={14} className="text-amber-400 animate-spin" />;
            case 'COMPLETED': return <CheckCircle size={14} className="text-emerald-400" />;
            case 'FAILED': return <AlertTriangle size={14} className="text-rose-400" />;
            default: return <Clock size={14} className="text-neutral-500" />;
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'RUNNING': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'COMPLETED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
            case 'FAILED': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
            default: return 'text-neutral-400 bg-neutral-800/50 border-neutral-700/50';
        }
    };

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

                {/* ═══ JOBS & QUEUE OPERATIONS ═══ */}
                {activeTab === 'JOBS' && (
                    <div className="space-y-6">
                        {/* Quick Actions */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                            <h3 className="text-xl font-semibold mb-4 text-emerald-400">Trigger Jobs</h3>
                            <p className="text-neutral-500 text-sm mb-4">Manually trigger background workers. Jobs run asynchronously.</p>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => runDailyMutation.mutate()}
                                    disabled={runDailyMutation.isPending}
                                    className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-medium text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Play size={14} /> Run Daily Job
                                </button>
                                {(['SP500', 'NASDAQ100', 'TSX60', 'IBOV', 'CRYPTO'] as const).map(u => (
                                    <button
                                        key={u}
                                        onClick={() => runScreenerMutation.mutate(u)}
                                        disabled={runScreenerMutation.isPending}
                                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} /> Screener {u}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* In-Memory Queue Status */}
                        {jobsData?.queue && (
                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                                <h4 className="text-sm font-semibold text-neutral-400 mb-3 flex items-center gap-2">
                                    <Activity size={14} className={jobsData.queue.processing ? 'text-amber-400 animate-pulse' : 'text-neutral-600'} />
                                    History Warm Queue
                                </h4>
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-2xl font-bold text-white">{jobsData.queue.pending}</span>
                                        <span className="text-xs text-neutral-500">Pending</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-sm font-medium ${jobsData.queue.processing ? 'text-amber-400' : 'text-neutral-500'}`}>
                                            {jobsData.queue.processing ? 'Processing...' : 'Idle'}
                                        </span>
                                        <span className="text-xs text-neutral-500">Status</span>
                                    </div>
                                </div>
                                {jobsData.queue.pendingSymbols?.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {jobsData.queue.pendingSymbols.map((s: string, i: number) => (
                                            <span key={i} className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-mono">{s}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Job State Table */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                            <h4 className="text-sm font-semibold text-neutral-400 mb-4">Screener Job History</h4>
                            {(!jobsData?.jobs || jobsData.jobs.length === 0) ? (
                                <p className="text-neutral-600 text-sm text-center py-8">No jobs have been run yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-neutral-500 border-b border-neutral-800">
                                                <th className="text-left py-2 pr-4 font-medium">Universe</th>
                                                <th className="text-left py-2 pr-4 font-medium">Status</th>
                                                <th className="text-left py-2 pr-4 font-medium">Progress</th>
                                                <th className="text-left py-2 pr-4 font-medium">Last Run</th>
                                                <th className="text-left py-2 font-medium">Error</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {jobsData.jobs.map((job: any) => (
                                                <tr key={job.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                                                    <td className="py-3 pr-4">
                                                        <span className="font-medium text-white">{job.universeName}</span>
                                                        <span className="text-xs text-neutral-500 ml-2">{job.universeType}</span>
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${statusColor(job.status)}`}>
                                                            {statusIcon(job.status)}
                                                            {job.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        <div className="flex items-center gap-3 min-w-[140px]">
                                                            <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${job.status === 'FAILED' ? 'bg-rose-500' : job.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                                    style={{ width: `${job.total > 0 ? Math.round((job.cursorIndex / job.total) * 100) : 0}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-neutral-400 font-mono whitespace-nowrap">
                                                                {job.cursorIndex}/{job.total}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 pr-4 text-neutral-400 text-xs whitespace-nowrap">
                                                        {job.updatedAt ? new Date(job.updatedAt).toLocaleString() : '—'}
                                                    </td>
                                                    <td className="py-3 text-rose-400 text-xs font-mono max-w-[250px] truncate" title={job.lastError || ''}>
                                                        {job.lastError || '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ CACHE HEALTH ═══ */}
                {activeTab === 'CACHE' && (
                    <div className="space-y-6">
                        {/* Backfill Controls (existing) */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                            <h3 className="text-xl font-semibold mb-4 text-blue-400">Price History Cache / Backfill</h3>
                            <p className="text-neutral-500 text-sm mb-6">Download up to 3 years of OHLCV for each universe to enable API-free screener predictions and instant analysis.</p>

                            <div className="flex flex-wrap gap-3 mb-4">
                                {(['SP500', 'NASDAQ100', 'TSX60', 'IBOV', 'CRYPTO'] as const).map(u => (
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
                        </div>

                        {/* Cache Health Metrics */}
                        {cacheData && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Symbol Cache Summary */}
                                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                                        <h4 className="text-sm font-semibold text-neutral-400 mb-4">Symbol Cache State</h4>
                                        <div className="grid grid-cols-4 gap-3 mb-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-white">{cacheData.symbols.total}</div>
                                                <div className="text-xs text-neutral-500">Total</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-emerald-400">{cacheData.symbols.ready}</div>
                                                <div className="text-xs text-neutral-500">Ready</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-amber-400">{cacheData.symbols.pending}</div>
                                                <div className="text-xs text-neutral-500">Pending</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-rose-400">{cacheData.symbols.failed}</div>
                                                <div className="text-xs text-neutral-500">Failed</div>
                                            </div>
                                        </div>
                                        {/* Visual bar */}
                                        {cacheData.symbols.total > 0 && (
                                            <div className="flex h-2.5 rounded-full overflow-hidden bg-neutral-800">
                                                <div className="bg-emerald-500 transition-all" style={{ width: `${(cacheData.symbols.ready / cacheData.symbols.total) * 100}%` }} />
                                                <div className="bg-amber-500 transition-all" style={{ width: `${(cacheData.symbols.pending / cacheData.symbols.total) * 100}%` }} />
                                                <div className="bg-rose-500 transition-all" style={{ width: `${(cacheData.symbols.failed / cacheData.symbols.total) * 100}%` }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* API Response Cache Summary */}
                                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                                        <h4 className="text-sm font-semibold text-neutral-400 mb-4">API Response Cache</h4>
                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-white">{cacheData.cachedResponses.total}</div>
                                                <div className="text-xs text-neutral-500">Total Entries</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-emerald-400">{cacheData.cachedResponses.fresh}</div>
                                                <div className="text-xs text-neutral-500">Fresh</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-amber-400">{cacheData.cachedResponses.stale}</div>
                                                <div className="text-xs text-neutral-500">Stale</div>
                                            </div>
                                        </div>
                                        {cacheData.cachedResponses.total > 0 && (
                                            <div className="flex h-2.5 rounded-full overflow-hidden bg-neutral-800">
                                                <div className="bg-emerald-500 transition-all" style={{ width: `${(cacheData.cachedResponses.fresh / cacheData.cachedResponses.total) * 100}%` }} />
                                                <div className="bg-amber-500 transition-all" style={{ width: `${(cacheData.cachedResponses.stale / cacheData.cachedResponses.total) * 100}%` }} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Recent Failures */}
                                {cacheData.recentFailures?.length > 0 && (
                                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                                        <h4 className="text-sm font-semibold text-neutral-400 mb-4 flex items-center gap-2">
                                            <AlertTriangle size={14} className="text-rose-400" />
                                            Recent Cache Failures
                                        </h4>
                                        <div className="space-y-2">
                                            {cacheData.recentFailures.map((f: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between bg-neutral-950/50 px-4 py-2.5 rounded-lg border border-neutral-800/50">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-sm text-white font-medium">{f.symbol}</span>
                                                        <span className="text-xs text-neutral-500">{f.assetType}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs text-rose-400 font-mono max-w-[300px] truncate" title={f.error}>{f.error}</span>
                                                        <span className="text-xs text-neutral-600 whitespace-nowrap">
                                                            {f.lastAttempt ? new Date(f.lastAttempt).toLocaleString() : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {!cacheData && (
                            <div className="text-center p-8 text-neutral-600 font-mono text-sm">
                                Loading cache health metrics...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
