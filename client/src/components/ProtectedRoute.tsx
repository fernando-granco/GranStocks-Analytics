import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
    const { user, isLoading, login } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <div className="text-neutral-500 animate-pulse">Checking authentication...</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user.mustChangePassword) {
        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            setError('');
            setLoading(true);
            try {
                if (newPassword.length < 10) throw new Error('New password must be at least 10 characters.');
                const res = await fetch('/api/auth/update-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to update password');

                const meRes = await fetch('/api/auth/me');
                if (meRes.ok) {
                    const meData = await meRes.json();
                    login(meData);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-neutral-900 border border-amber-500/30 rounded-2xl p-8 shadow-2xl shadow-amber-500/10">
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl font-bold text-white mb-2">Update Required</h2>
                        <p className="text-amber-400 text-sm">Your account requires a mandatory password reset before you can proceed.</p>
                    </div>

                    {error && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">{error}</div>}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">New Password (Min 10 chars)</label>
                            <input
                                type="password"
                                required
                                minLength={10}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || newPassword.length < 10}
                            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Updating...' : 'Update Password & Continue'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return <Outlet />;
}
