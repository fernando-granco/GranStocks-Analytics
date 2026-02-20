import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Settings, TrendingUp, Cpu, Server, Plus, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Ensure Tailwind is used by importing global css
// import './index.css';

const API_BASE = '/api';

export default function App() {
    const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

    const queryClient = useQueryClient();

    // Polling User Assets (30s)
    const { data: overviews, isLoading } = useQuery({
        queryKey: ['overview'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/overview/today`);
            if (!res.ok) throw new Error('Network error');
            return res.json();
        },
        refetchInterval: 30000 // Poll every 30s as requested
    });

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30">
            <nav className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
                        <TrendingUp className="text-indigo-400" />
                        <span className="font-bold text-lg tracking-tight">GranStocks <span className="text-neutral-500 font-normal">Analytics</span></span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setActiveTab('settings')} className="text-neutral-400 hover:text-white transition-colors">
                            <Settings size={20} />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {activeTab === 'settings' ? (
                    <SettingsPage />
                ) : selectedSymbol ? (
                    <StockDetail symbol={selectedSymbol} onBack={() => setSelectedSymbol(null)} />
                ) : (
                    <Dashboard overviews={overviews || []} onSelect={setSelectedSymbol} isLoading={isLoading} />
                )}
            </main>

            <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-sm text-neutral-600">
                <p>Disclaimer: Educational analysis only — not financial advice.</p>
                <p>Predictions are uncertain and may be wrong. AI-generated commentary may be inaccurate.</p>
            </footer>
        </div>
    );
}

function Dashboard({ overviews, onSelect, isLoading }: any) {
    if (isLoading) return <div className="text-center py-20 text-neutral-500 animate-pulse">Loading market data...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Market Overview</h1>
            </div>

            {overviews.length === 0 ? (
                <div className="p-12 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20">
                    <Server className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-300">No assets tracked</h3>
                    <p className="text-neutral-500 mt-1">Go to settings to add symbols to your portfolio.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {overviews.map((item: any) => (
                        <div
                            key={item.symbol}
                            onClick={() => onSelect(item.symbol)}
                            className="group p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/50 hover:bg-neutral-800/80 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-2xl font-bold">{item.symbol}</h2>
                                {item.prediction?.[0] && (
                                    <span className={cn(
                                        "px-2.5 py-1 text-xs font-medium rounded-full",
                                        item.prediction[0].predictedReturnPct > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                    )}>
                                        {item.prediction[0].predictedReturnPct > 0 ? 'Bullish' : 'Bearish'} Bias
                                    </span>
                                )}
                            </div>

                            {item.indicators ? (() => {
                                const ind = JSON.parse(item.indicators.indicatorsJson);
                                return (
                                    <div className="space-y-4">
                                        <div>
                                            <div className="text-sm text-neutral-500 mb-0.5">Last Price</div>
                                            <div className="text-xl font-mono">${ind.lastPrice.toFixed(2)}</div>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-400">RSI: {ind.rsi14 ? ind.rsi14.toFixed(1) : '-'}</span>
                                            <span className="text-neutral-400">Vol: {ind.vol20 ? (ind.vol20 * 100).toFixed(1) + '%' : '-'}</span>
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="text-sm text-neutral-500">Awaiting chron job...</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function StockDetail({ symbol, onBack }: { symbol: string, onBack: () => void }) {
    // Skeleton for stock detail
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={onBack} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                &larr; Back to Dashboard
            </button>

            <div className="flex justify-between items-end">
                <h1 className="text-4xl font-bold">{symbol} <span className="text-xl font-normal text-neutral-500 ml-2">Detail Analysis</span></h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Deterministic Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="h-96 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex items-center justify-center">
                        <p className="text-neutral-500">Chart rendering implementation goes here (Recharts)</p>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold mb-4 border-b border-neutral-800 pb-2 flex items-center gap-2">
                            <TrendingUp className="text-indigo-400" size={18} /> Deterministic Prediction
                        </h3>
                        <p className="text-neutral-400 text-sm leading-relaxed">
                            The ensemble model predicts a neutral bias over a 20d horizon due to conflicting RSI signals.
                        </p>
                    </div>
                </div>

                {/* AI Panel */}
                <div className="bg-neutral-900/50 border border-indigo-500/20 rounded-2xl p-6 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4 border-b border-indigo-500/20 pb-2 flex items-center gap-2">
                        <Cpu className="text-indigo-400" size={18} /> AI Providers
                    </h3>
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                        <p className="text-sm text-neutral-400">Select multiple configured AI providers to generate side-by-side narrative summaries derived heavily from deterministic data.</p>
                        <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors w-full">
                            Generate Narratives
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SettingsPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold mb-6">Settings</h1>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold mb-4">Tracked Assets</h3>
                    <div className="flex gap-2 mb-6">
                        <input type="text" placeholder="Enter symbol (e.g. AAPL)" className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                        <button className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg flex items-center gap-2 transition-colors">
                            <Plus size={16} /> Add
                        </button>
                    </div>
                    {/* List goes here */}
                </div>
            </div>

            <div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold mb-2">BYOK AI Providers</h3>
                    <p className="text-neutral-500 text-sm mb-6">Securely add your API keys. Keys are AES-256-GCM encrypted on the server. The frontend never sees them.</p>

                    <form className="space-y-4">
                        <input type="text" placeholder="Config Name (e.g. My ChatGPT)" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                        <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500">
                            <option>OPENAI</option>
                            <option>GEMINI</option>
                            <option>DEEPSEEK</option>
                        </select>
                        <input type="password" placeholder="API Key" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />

                        <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 font-medium text-white rounded-lg w-full transition-colors mt-2">
                            Save Provider
                        </button>
                    </form>
                </div>
            </div>

        </div>
    );
}

