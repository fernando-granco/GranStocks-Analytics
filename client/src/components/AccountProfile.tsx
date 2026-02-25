import { useState, useEffect } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { User, Lock, Save, EyeOff } from 'lucide-react';
import Select from 'react-select';
import { usePreferences } from '../context/PreferencesContext';
import { useTranslation } from 'react-i18next';

// Generate native IANA timezone list
const TIMEZONES = (Intl as any).supportedValuesOf('timeZone').map((tz: string) => ({ value: tz, label: tz.replace(/_/g, ' ') }));

export function AccountProfile() {
    const queryClient = useQueryClient();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [timezone, setTimezone] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const { hideEmptyMarketOverview, hideEmptyCustomUniverses, hideEmptyPortfolio, updatePreferences } = usePreferences();
    const { t } = useTranslation();

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
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Screen Name</label>
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Display Name" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Display Timezone</label>
                        <Select
                            options={TIMEZONES}
                            value={TIMEZONES.find((t: any) => t.value === timezone)}
                            onChange={(val: any) => setTimezone(val.value)}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            styles={{
                                control: (base) => ({
                                    ...base,
                                    backgroundColor: 'black',
                                    borderColor: '#262626', // neutral-800
                                    minHeight: '42px',
                                }),
                                menu: (base) => ({
                                    ...base,
                                    backgroundColor: '#171717', // neutral-900
                                    zIndex: 50
                                }),
                                option: (base, state) => ({
                                    ...base,
                                    backgroundColor: state.isFocused ? '#262626' : 'transparent',
                                    color: 'white',
                                    cursor: 'pointer'
                                }),
                                singleValue: (base) => ({ ...base, color: 'white' }),
                                input: (base) => ({ ...base, color: 'white' }),
                            }}
                        />
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

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2"><EyeOff size={20} className="text-emerald-400" /> {t('settings.display.title', 'Display Preferences')}</h3>
                <div className="space-y-4 max-w-xl">
                    <label className="flex items-center justify-between cursor-pointer p-3 bg-black border border-neutral-800 rounded-lg hover:border-neutral-700 transition-colors">
                        <span className="text-sm font-medium text-neutral-300">{t('settings.display.hide_market', 'Hide Market Overview if empty')}</span>
                        <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${hideEmptyMarketOverview ? 'bg-indigo-500' : 'bg-neutral-700'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${hideEmptyMarketOverview ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        <input type="checkbox" className="hidden" checked={hideEmptyMarketOverview} onChange={(e) => updatePreferences({ hideEmptyMarketOverview: e.target.checked })} />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer p-3 bg-black border border-neutral-800 rounded-lg hover:border-neutral-700 transition-colors">
                        <span className="text-sm font-medium text-neutral-300">{t('settings.display.hide_universes', 'Hide Custom Universes if empty')}</span>
                        <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${hideEmptyCustomUniverses ? 'bg-indigo-500' : 'bg-neutral-700'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${hideEmptyCustomUniverses ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        <input type="checkbox" className="hidden" checked={hideEmptyCustomUniverses} onChange={(e) => updatePreferences({ hideEmptyCustomUniverses: e.target.checked })} />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer p-3 bg-black border border-neutral-800 rounded-lg hover:border-neutral-700 transition-colors">
                        <span className="text-sm font-medium text-neutral-300">{t('settings.display.hide_portfolio', 'Hide Portfolio if empty')}</span>
                        <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${hideEmptyPortfolio ? 'bg-indigo-500' : 'bg-neutral-700'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${hideEmptyPortfolio ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        <input type="checkbox" className="hidden" checked={hideEmptyPortfolio} onChange={(e) => updatePreferences({ hideEmptyPortfolio: e.target.checked })} />
                    </label>
                </div>
            </div>
        </div>
    );
}
