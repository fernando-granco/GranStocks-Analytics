import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Globe } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';

export default function Settings() {
    const [symbolInput, setSymbolInput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [configName, setConfigName] = useState('');
    const [configProvider, setConfigProvider] = useState('OPENAI');
    const [configApiKey, setConfigApiKey] = useState('');
    const [configModel, setConfigModel] = useState('');
    const [configBaseUrl, setConfigBaseUrl] = useState('');
    const { timezone, setTimezone } = usePreferences();
    const queryClient = useQueryClient();

    // LLM Configs Query
    const { data: configs } = useQuery({
        queryKey: ['llmConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/llm');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const addConfigMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/settings/llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: configName,
                    provider: configProvider,
                    apiKey: configApiKey,
                    model: configModel,
                    baseUrl: configBaseUrl || undefined
                })
            });
            if (!res.ok) throw new Error('Failed to save config');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['llmConfigs'] });
            setConfigName(''); setConfigApiKey(''); setConfigModel(''); setConfigBaseUrl('');
        }
    });

    const deleteConfigMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/settings/llm/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete config');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['llmConfigs'] });
        }
    });

    // Tracked Assets Query
    const { data: assets, isLoading } = useQuery({
        queryKey: ['tracked-assets'],
        queryFn: async () => {
            const res = await fetch('/api/tracked-assets');
            if (!res.ok) throw new Error('Failed to fetch assets');
            return res.json();
        }
    });

    const addAssetMutation = useMutation({
        mutationFn: async (symbol: string) => {
            const res = await fetch('/api/tracked-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add asset');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tracked-assets'] });
            setSymbolInput('');
            setErrorMsg('');
        },
        onError: (err: any) => {
            setErrorMsg(err.message);
        }
    });

    const deleteAssetMutation = useMutation({
        mutationFn: async (symbol: string) => {
            const res = await fetch(`/api/tracked-assets/${symbol}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete asset');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tracked-assets'] });
        }
    });

    const handleAddAsset = (e: React.FormEvent) => {
        e.preventDefault();
        if (!symbolInput.trim()) return;
        addAssetMutation.mutate(symbolInput.trim().toUpperCase());
    };

    return (
        <div className="max-w-2xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold mb-6">Settings</h1>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 mb-8">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2"><Globe size={20} className="text-indigo-400" /> General Settings</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-2">Display Timezone</label>
                            <select
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            >
                                <option value="America/Toronto">Eastern Time (Toronto/New York)</option>
                                <option value="America/Vancouver">Pacific Time (Vancouver/LA)</option>
                                <option value="Europe/London">London (GMT/BST)</option>
                                <option value="UTC">UTC</option>
                            </select>
                            <p className="text-xs text-neutral-500 mt-2">Default is set to Toronto.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold mb-4 text-white">Tracked Assets</h3>

                    <form onSubmit={handleAddAsset} className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Enter symbol (e.g. AAPL)"
                            value={symbolInput}
                            onChange={(e) => setSymbolInput(e.target.value)}
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                            type="submit"
                            disabled={addAssetMutation.isPending}
                            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <Plus size={16} /> Add
                        </button>
                    </form>

                    {errorMsg && <p className="text-rose-400 text-sm mb-4">{errorMsg}</p>}

                    {isLoading ? (
                        <div className="text-neutral-500 text-sm">Loading assets...</div>
                    ) : (
                        <div className="space-y-2">
                            {assets?.length === 0 ? (
                                <p className="text-neutral-500 text-sm">No assets tracked yet.</p>
                            ) : (
                                assets?.map((asset: any) => (
                                    <div key={asset.symbol} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3">
                                        <span className="font-medium text-white">{asset.symbol}</span>
                                        <button
                                            onClick={() => deleteAssetMutation.mutate(asset.symbol)}
                                            className="text-neutral-500 hover:text-rose-400 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold mb-2">BYOK AI Providers</h3>
                    <p className="text-neutral-500 text-sm mb-6">Securely add your API keys. Keys are AES-256-GCM encrypted on the server. The frontend never sees them.</p>

                    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); addConfigMutation.mutate(); }}>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="Config Name (e.g. My ChatGPT)" value={configName} onChange={e => setConfigName(e.target.value)} required className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                            <select value={configProvider} onChange={e => setConfigProvider(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500">
                                <option value="OPENAI">OpenAI</option>
                                <option value="ANTHROPIC">Anthropic</option>
                                <option value="GEMINI">Google Gemini</option>
                                <option value="DEEPSEEK">DeepSeek</option>
                                <option value="GROQ">Groq</option>
                                <option value="TOGETHER">Together AI</option>
                                <option value="OLLAMA">Ollama (Local)</option>
                                <option value="OPENAI_COMPAT">OpenAI Compatible (v1)</option>
                            </select>
                        </div>
                        <input type="password" placeholder="API Key" value={configApiKey} onChange={e => setConfigApiKey(e.target.value)} required={configProvider !== 'OLLAMA'} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder={configProvider === 'ANTHROPIC' ? 'claude-3-5-sonnet-20241022' : configProvider === 'DEEPSEEK' ? 'deepseek-chat' : configProvider === 'GROQ' ? 'llama3-70b-8192' : configProvider === 'GEMINI' ? 'gemini-1.5-flash' : 'Model Name (e.g. gpt-4o)'} value={configModel} onChange={e => setConfigModel(e.target.value)} required className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                            <input type="text" placeholder="Base URL (Optional)" value={configBaseUrl} onChange={e => setConfigBaseUrl(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                        </div>

                        <button type="submit" disabled={addConfigMutation.isPending} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-medium text-white rounded-lg w-full transition-colors mt-2">
                            {addConfigMutation.isPending ? 'Saving...' : 'Save Provider'}
                        </button>
                    </form>

                    <div className="mt-8 space-y-2">
                        {configs?.map((cfg: any) => (
                            <div key={cfg.id} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3">
                                <div>
                                    <div className="font-medium text-white">{cfg.name} <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded ml-2">{cfg.provider}</span></div>
                                    <div className="text-xs text-neutral-500 mt-1">Model: {cfg.model} | Key: ****{cfg.keyLast4}</div>
                                </div>
                                <button
                                    onClick={() => deleteConfigMutation.mutate(cfg.id)}
                                    disabled={deleteConfigMutation.isPending}
                                    className="text-neutral-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                                    title="Delete this provider"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
