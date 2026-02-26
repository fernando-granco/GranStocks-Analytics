import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, Loader2 } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [mustChange, setMustChange] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login, user, isLoading } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mustChange) {
                if (newPassword.length < 10) throw new Error('New password must be at least 10 characters.');
                const res = await fetch('/api/auth/update-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to update password');

                // Fetch me again or just navigate, since cookie is already set
                const meRes = await fetch('/api/auth/me');
                if (meRes.ok) {
                    const meData = await meRes.json();
                    login(meData);
                }
                navigate('/app');
                return;
            }

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to login');

            if (data.mustChangePassword) {
                setMustChange(true);
                return;
            }

            login(data);
            navigate('/app');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isLoading && user) {
            navigate('/app');
        }
    }, [user, isLoading, navigate]);

    if (isLoading || user) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
            <Link to="/" className="mb-8 flex items-center gap-2 hover:opacity-80 transition-opacity">
                <TrendingUp className="text-indigo-500 w-8 h-8" />
                <h1 className="text-2xl font-bold text-white tracking-tight">GranStocks <span className="font-normal text-neutral-500">Analytics</span></h1>
            </Link>

            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
                <h2 className="text-xl font-semibold text-white mb-6 text-center">Sign in to your account</h2>

                {error && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            disabled={mustChange}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                        />
                    </div>
                    {!mustChange ? (
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                    ) : (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg">
                            <label className="block text-sm font-medium text-amber-500 mb-2">Update Required by Admin: New Password</label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                minLength={10}
                                placeholder="Min 10 characters"
                                className="w-full bg-neutral-950 border border-amber-500/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors mb-1"
                            />
                            <p className="text-xs text-neutral-500">Please choose a new strong password to securely access your account.</p>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors mt-2"
                    >
                        {loading ? 'Processing...' : mustChange ? 'Update Password & Continue' : 'Sign In'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-neutral-500">
                    Don't have an account? <Link to="/register" className="text-indigo-400 hover:text-indigo-300">Create one</Link>
                </p>
            </div>
        </div>
    );
}
