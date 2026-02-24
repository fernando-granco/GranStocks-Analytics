import { useEffect, useState } from 'react';
import { ShieldAlert, UserCheck, UserX, KeyRound, AlertTriangle, Trash2 } from 'lucide-react';

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState('');
    const [activeTab, setActiveTab] = useState<'USERS' | 'AUDIT'>('USERS');
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const fetchUsers = () => {
        fetch('/api/admin/users')
            .then(res => res.json())
            .then(data => setUsers(data || []))
            .catch(err => console.error(err));
    };

    const fetchLogs = () => {
        fetch('/api/admin/audit')
            .then(res => res.json())
            .then(data => setLogs(data || []))
            .catch(err => console.error(err));
    };

    useEffect(() => {
        Promise.all([fetchUsers(), fetchLogs()]).finally(() => setLoading(false));
    }, []);

    const handleAction = async (id: string, action: string, data: any) => {
        if (!confirm(`Are you sure you want to perform: ${action}?`)) return;

        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Action failed');

            setActionMsg(`Success: ${action}`);
            fetchUsers();
            fetchLogs();
            setTimeout(() => setActionMsg(''), 3000);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleForceReset = async (id: string) => {
        if (!confirm('Force password reset on next login?')) return;
        try {
            const res = await fetch(`/api/admin/users/${id}/force-reset`, { method: 'POST' });
            if (!res.ok) throw new Error('Reset failed');
            setActionMsg('Success: Forced Password Reset');
            fetchUsers();
            fetchLogs();
            setTimeout(() => setActionMsg(''), 3000);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('PERMANENTLY DELETE USER? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setActionMsg('Success: User Deleted');
            fetchUsers();
            fetchLogs();
            setTimeout(() => setActionMsg(''), 3000);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const filteredUsers = users.filter(u => {
        if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
        if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
        if (searchQuery && !u.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    if (loading) return <div className="p-8 text-neutral-400 animate-pulse">Loading Admin Panel...</div>;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Superadmin Dashboard</h1>
                    <p className="text-neutral-500">Manage users, adjust roles, and review security audit logs.</p>
                </div>
            </div>

            {actionMsg && (
                <div className="bg-emerald-500/20 text-emerald-400 p-3 rounded-lg mb-6 border border-emerald-500/30 font-medium text-sm">
                    {actionMsg}
                </div>
            )}



            <div className="flex gap-4 mb-6 border-b border-neutral-800 pb-2">
                <button
                    onClick={() => setActiveTab('USERS')}
                    className={`pb-2 px-2 font-medium transition-colors ${activeTab === 'USERS' ? 'text-white border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                    Users
                </button>
                <button
                    onClick={() => setActiveTab('AUDIT')}
                    className={`pb-2 px-2 font-medium transition-colors ${activeTab === 'AUDIT' ? 'text-white border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                    Audit Logs
                </button>
            </div>

            {activeTab === 'USERS' && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
                        <input
                            type="text"
                            placeholder="Search by email..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                        />
                        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500">
                            <option value="ALL">All Roles</option>
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                            <option value="SUPERADMIN">Superadmin</option>
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500">
                            <option value="ALL">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="BANNED">Banned</option>
                        </select>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
                        <table className="w-full text-sm text-left text-neutral-400">
                            <thead className="text-xs uppercase bg-neutral-900/50 border-b border-neutral-800 text-neutral-300">
                                <tr>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Joined / Last Login</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                                            {u.email}
                                            {u.mustChangePassword && <span title="Must change password"><AlertTriangle size={14} className="text-amber-500" /></span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-bold rounded ${u.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-neutral-800 text-neutral-300'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-bold rounded ${u.status === 'BANNED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                                {u.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono">
                                            <div>J: {new Date(u.createdAt).toISOString().split('T')[0]}</div>
                                            <div className="text-neutral-500">L: {u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().split('T')[0] : 'Never'}</div>
                                        </td>
                                        <td className="px-6 py-4 flex gap-2 justify-end">
                                            {u.status === 'ACTIVE' ? (
                                                <button onClick={() => handleAction(u.id, 'Ban User', { status: 'BANNED' })} className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-rose-400 rounded transition-colors" title="Ban User">
                                                    <UserX size={16} />
                                                </button>
                                            ) : (
                                                <button onClick={() => handleAction(u.id, 'Unban User', { status: 'ACTIVE' })} className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 rounded transition-colors" title="Unban User">
                                                    <UserCheck size={16} />
                                                </button>
                                            )}
                                            {u.role === 'USER' ? (
                                                <button onClick={() => handleAction(u.id, 'Promote to Admin', { role: 'ADMIN' })} className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-indigo-400 rounded transition-colors" title="Promote to Admin">
                                                    <ShieldAlert size={16} />
                                                </button>
                                            ) : (
                                                <button onClick={() => handleAction(u.id, 'Demote to User', { role: 'USER' })} className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded transition-colors" title="Demote to User">
                                                    <UserCheck size={16} />
                                                </button>
                                            )}
                                            <button onClick={() => handleForceReset(u.id)} className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded transition-colors" title="Force Password Reset">
                                                <KeyRound size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(u.id)} className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-rose-500 rounded transition-colors" title="Delete User">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'AUDIT' && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto p-4">
                    <div className="space-y-4">
                        {logs.length === 0 ? <p className="text-neutral-500 p-4">No audit logs found.</p> : null}
                        {logs.map(log => (
                            <div key={log.id} className="text-sm border-b border-neutral-800 pb-3">
                                <div className="flex justify-between text-xs text-neutral-500 font-mono mb-1">
                                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                                    <span>Action: {log.action}</span>
                                </div>
                                <div className="text-neutral-300">
                                    <span className="font-medium text-white">{log.actorUser?.email || log.actorUserId}</span> performed <span className="text-indigo-400">{log.action}</span> on target <span className="font-medium text-white">{log.targetUser?.email || log.targetUserId}</span>.
                                </div>
                                <div className="text-xs font-mono mt-1 text-neutral-500 bg-neutral-950 p-2 rounded">
                                    {log.metadataJson}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
