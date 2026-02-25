import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Key, Users, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminInvites() {
    const { user } = useAuth();
    const [invites, setInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [newCode, setNewCode] = useState('');
    const [maxUses, setMaxUses] = useState(1);
    const [expiresDays, setExpiresDays] = useState(7);

    useEffect(() => {
        if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
            fetchInvites();
        }
    }, [user]);

    const fetchInvites = async () => {
        try {
            const res = await fetch('/api/admin/invites');
            if (!res.ok) throw new Error('Failed to fetch invites');
            setInvites(await res.json());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: newCode || undefined,
                    maxUses,
                    expiresDays: expiresDays > 0 ? expiresDays : null
                })
            });
            if (!res.ok) throw new Error('Failed to create invite code');
            setNewCode('');
            setMaxUses(1);
            setExpiresDays(7);
            fetchInvites();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this code?')) return;
        try {
            const res = await fetch(`/api/admin/invites/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete invite code');
            fetchInvites();
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (!['ADMIN', 'SUPERADMIN'].includes(user?.role || '')) {
        return <div className="p-8 text-neutral-400">Unauthorized. Admin access required.</div>;
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Invite Codes</h1>
                    <p className="text-neutral-400">Manage registration beta codes and usage limits</p>
                </div>
            </div>

            {error && <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">{error}</div>}

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 mb-8">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Key className="w-5 h-5 text-indigo-400" /> Generate New Code
                </h2>
                <form onSubmit={handleCreate} className="flex gap-4 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm text-neutral-400 mb-1">Custom Code (Optional)</label>
                        <input type="text" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="Leave blank for random" className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder:text-neutral-700 focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div className="w-32">
                        <label className="block text-sm text-neutral-400 mb-1">Max Uses</label>
                        <input type="number" min="0" value={maxUses} onChange={e => setMaxUses(parseInt(e.target.value))} className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" title="0 = Unlimited" />
                    </div>
                    <div className="w-40">
                        <label className="block text-sm text-neutral-400 mb-1">Expires In (Days)</label>
                        <input type="number" min="0" value={expiresDays} onChange={e => setExpiresDays(parseInt(e.target.value))} className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="0 = Never" />
                    </div>
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 h-[42px]">
                        <Plus className="w-4 h-4" /> Create
                    </button>
                </form>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-black/50 border-b border-neutral-800 text-sm">
                            <th className="p-4 text-neutral-400 font-medium tracking-wide">Code</th>
                            <th className="p-4 text-neutral-400 font-medium tracking-wide">Usage</th>
                            <th className="p-4 text-neutral-400 font-medium tracking-wide">Expiration</th>
                            <th className="p-4 text-neutral-400 font-medium tracking-wide">Created By</th>
                            <th className="p-4 text-neutral-400 font-medium tracking-wide text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-neutral-500">Loading initial codes...</td></tr>
                        ) : invites.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-neutral-500">No invite codes generated yet.</td></tr>
                        ) : (
                            invites.map((code) => {
                                const isExpired = code.expiresAt && new Date(code.expiresAt) < new Date();
                                const isExhausted = code._count.uses >= code.maxUses;

                                return (
                                    <tr key={code.id} className="hover:bg-neutral-800/20 transition-colors">
                                        <td className="p-4 font-mono font-medium text-white flex items-center gap-2">
                                            {code.code}
                                            <span className={`w-2 h-2 rounded-full ${isExhausted ? 'bg-amber-500' : isExpired ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-sm text-neutral-300">
                                                <Users className="w-4 h-4 text-neutral-500" />
                                                <span className={isExhausted ? 'text-amber-400 font-medium' : ''}>{code._count.uses}</span> / {code.maxUses}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-sm text-neutral-400">
                                                <Calendar className="w-4 h-4" />
                                                {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'Never'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-neutral-500">{code.createdBy}</td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => handleDelete(code.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-colors" title="Revoke Code">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
