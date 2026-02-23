import { useState, useEffect } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { User, Lock, Save } from 'lucide-react';

export function AccountProfile() {
    const queryClient = useQueryClient();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [timezone, setTimezone] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const { data: profile } = useQuery({
        queryKey: ['userProfile'],
        queryFn: async () => {
            const res = await fetch('/api/user/profile');
            if (!res.ok) throw new Error('Failed to load profile');
            return res.json();
        }
    });

    useEffect(() => {
        if (profile) {
            setFullName(profile.fullName || '');
            setEmail(profile.email || '');
            setTimezone(profile.timezone || 'America/Toronto');
        }
    }, [profile]);

    const updateProfile = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, email, timezone, currentPassword })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update profile');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
            window.location.reload(); // Quick refresh to update global states (context)
        },
        onError: (err: Error) => { alert(err.message); }
    });

    const updatePassword = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update password');
            }
        },
        onSuccess: () => {
            alert('Password successfully changed');
            setNewPassword('');
            setCurrentPassword('');
        },
        onError: (err: Error) => { alert(err.message); }
    });

    return (
        <div className="space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2"><User size={20} className="text-indigo-400" /> Account Profile</h3>

                <div className="grid gap-6 md:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Full Name</label>
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Display Name" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Display Timezone</label>
                        <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500">
                            <option value="America/Toronto">Eastern Time (ET)</option>
                            <option value="America/Chicago">Central Time (CT)</option>
                            <option value="America/Denver">Mountain Time (MT)</option>
                            <option value="America/Los_Angeles">Pacific Time (PT)</option>
                            <option value="UTC">UTC</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Email Address</label>
                        <div className="flex gap-4">
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Confirm current password to change email" className="flex-1 bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg text-sm font-medium transition flex-shrink-0">
                        <Save size={16} /> Save Profile
                    </button>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2"><Lock size={20} className="text-orange-400" /> Change Password</h3>
                <div className="grid gap-6 md:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Current Password</label>
                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">New Password</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={() => updatePassword.mutate()} disabled={updatePassword.isPending} className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-4 py-2 rounded-lg text-sm font-medium transition flex-shrink-0">
                        <Save size={16} /> Update Password
                    </button>
                </div>
            </div>
        </div>
    );
}
