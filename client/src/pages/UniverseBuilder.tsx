import { useState, useEffect } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { Filter, Search, Save, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function UniverseBuilder() {
    const { mode } = usePreferences();

    const [universes, setUniverses] = useState<any[]>([]);
    const [metadataOptions, setMetadataOptions] = useState<any>({ sectors: [], industries: [], exchanges: [] });

    // Form state
    const [name, setName] = useState('');
    const [searchQ, setSearchQ] = useState('');
    const [sector, setSector] = useState('');
    const [industry, setIndustry] = useState('');
    const [exchange, setExchange] = useState('');

    const [previewResults, setPreviewResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (mode !== 'ADVANCED') return;
        fetchUniverses();
        fetch('/api/symbols/metadata-options')
            .then(res => res.json())
            .then(data => setMetadataOptions(data || { sectors: [], industries: [], exchanges: [] }));
    }, [mode]);

    const fetchUniverses = () => {
        fetch('/api/universes')
            .then(res => res.json())
            .then(data => setUniverses(data || []));
    };

    const handleSearch = async () => {
        setIsSearching(true);
        const params = new URLSearchParams();
        if (searchQ) params.append('q', searchQ);
        if (sector) params.append('sector', sector);
        if (industry) params.append('industry', industry);
        if (exchange) params.append('exchange', exchange);

        try {
            const res = await fetch(`/api/symbols/search?${params.toString()}`);
            const data = await res.json();
            setPreviewResults(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSave = async () => {
        if (!name) return alert('Please enter a name for this Universe');

        const criteria = { q: searchQ, sector, industry, exchange };
        try {
            const res = await fetch('/api/universes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    universeType: 'STOCK',
                    definitionJson: JSON.stringify(criteria)
                })
            });
            if (res.ok) {
                setName('');
                fetchUniverses();
                alert('Universe saved successfully');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this universe?')) return;
        await fetch(`/api/universes/${id}`, { method: 'DELETE' });
        fetchUniverses();
    };

    if (mode !== 'ADVANCED') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
                <ShieldAlert className="w-16 h-16 text-neutral-600 mb-6" />
                <h2 className="text-2xl font-bold mb-4">Pro Feature</h2>
                <p className="text-neutral-500 mb-8">
                    The Custom Universe Builder requires Advanced Mode. Toggle the <span className="text-amber-500">Pro</span> switch in the navigation bar to access institutional-grade universe filtering and management.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Universe Builder</h1>
                    <p className="text-neutral-500">Construct custom execution universes for the automated background screener.</p>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Filter className="text-indigo-400" size={20} /> Filter Criteria
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-1">Symbol or Name</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-neutral-500" size={16} />
                                <input
                                    type="text"
                                    value={searchQ}
                                    onChange={(e) => setSearchQ(e.target.value)}
                                    placeholder="e.g. Apple or AAPL"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-neutral-600"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-1">Exchange</label>
                            <select
                                value={exchange}
                                onChange={(e) => setExchange(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white"
                            >
                                <option value="">All Exchanges</option>
                                {metadataOptions.exchanges.map((ex: string) => <option key={ex} value={ex}>{ex}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-1">Sector</label>
                            <select
                                value={sector}
                                onChange={(e) => setSector(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white"
                            >
                                <option value="">All Sectors</option>
                                {metadataOptions.sectors.map((s: string) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-1">Industry</label>
                            <select
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white"
                            >
                                <option value="">All Industries</option>
                                {metadataOptions.industries.map((i: string) => <option key={i} value={i}>{i}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {isSearching ? 'Scanning...' : 'Preview Matches'}
                        </button>
                    </div>
                </div>

                {previewResults.length > 0 && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
                            <h3 className="font-semibold text-sm">Preview ({previewResults.length} matches)</h3>
                        </div>
                        <ul className="divide-y divide-neutral-800 max-h-[300px] overflow-y-auto">
                            {previewResults.map(a => (
                                <li key={a.symbol} className="px-6 py-3 flex items-center justify-between hover:bg-neutral-800/20">
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold text-indigo-400">{a.symbol}</div>
                                        <div className="text-sm font-medium">{a.name}</div>
                                    </div>
                                    <div className="text-xs text-neutral-500 text-right">
                                        <div>{a.sector} &bull; {a.exchange}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Save className="text-emerald-400" size={20} /> Save Universe
                    </h2>
                    <p className="text-xs text-neutral-500 mb-4">
                        Save your current filter criteria as a dynamic universe. The backend screener will automatically resolve these components hourly.
                    </p>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Mega Cap Tech"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-neutral-600 mb-4"
                    />
                    <button
                        onClick={handleSave}
                        disabled={previewResults.length === 0}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                        Save Definition
                    </button>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
                        <h3 className="font-semibold text-sm">Your Saved Universes</h3>
                    </div>
                    {universes.length === 0 ? (
                        <div className="p-6 text-center text-neutral-500 text-sm">No custom universes saved yet.</div>
                    ) : (
                        <div className="divide-y divide-neutral-800">
                            {universes.map(u => (
                                <div key={u.id} className="p-4 hover:bg-neutral-800/30 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="font-bold flex items-center gap-1.5 mb-1 text-sm">
                                                <CheckCircle2 size={14} className="text-emerald-500" />
                                                {u.name}
                                            </div>
                                            <div className="text-[10px] uppercase font-mono text-neutral-500 bg-neutral-950 inline-block px-1.5 py-0.5 rounded border border-neutral-800">
                                                {u.universeType}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="mt-3 text-xs text-neutral-600 font-mono break-all line-clamp-2">
                                        JSON: {u.definitionJson}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
