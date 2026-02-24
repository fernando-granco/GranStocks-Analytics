import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Copy, Info } from 'lucide-react';
import { AccountProfile } from '../components/AccountProfile';

export const RISK_PROFILES: Record<string, { name: string, description: string, req: string, screener: any, predict: any }> = {
    CONSERVATIVE: {
        name: 'Conservative Profile',
        description: 'Capital Preservation Focus',
        req: 'CONSERVATIVE',
        screener: { volatilityThreshold: 20, drawdownThreshold: 10, volatilityPenalty: 25, drawdownPenalty: 30, trendStrengthReward: 2, trendStrengthPenalty: 10 },
        predict: { rsiOverbought: 65, rsiOversold: 35, highVolatilityThreshold: 30, severeDrawdownThreshold: 0.15 }
    },
    MODERATELY_CONSERVATIVE: {
        name: 'Moderately Conservative Profile',
        description: 'Low Risk',
        req: 'MODERATELY_CONSERVATIVE',
        screener: { volatilityThreshold: 30, drawdownThreshold: 15, volatilityPenalty: 20, drawdownPenalty: 25, trendStrengthReward: 4, trendStrengthPenalty: 8 },
        predict: { rsiOverbought: 70, rsiOversold: 30, highVolatilityThreshold: 40, severeDrawdownThreshold: 0.20 }
    },
    MODERATE: {
        name: 'Moderate Profile',
        description: 'Balanced',
        req: 'MODERATE',
        screener: { volatilityThreshold: 40, drawdownThreshold: 20, volatilityPenalty: 15, drawdownPenalty: 20, trendStrengthReward: 6, trendStrengthPenalty: 6 },
        predict: { rsiOverbought: 70, rsiOversold: 30, highVolatilityThreshold: 50, severeDrawdownThreshold: 0.25 }
    },
    MODERATELY_AGGRESSIVE: {
        name: 'Moderately Aggressive Profile',
        description: 'Growth Focus',
        req: 'MODERATELY_AGGRESSIVE',
        screener: { volatilityThreshold: 55, drawdownThreshold: 28, volatilityPenalty: 10, drawdownPenalty: 12, trendStrengthReward: 8, trendStrengthPenalty: 4 },
        predict: { rsiOverbought: 75, rsiOversold: 25, highVolatilityThreshold: 60, severeDrawdownThreshold: 0.35 }
    },
    AGGRESSIVE: {
        name: 'Aggressive Profile',
        description: 'High Volatility Tolerance',
        req: 'AGGRESSIVE',
        screener: { volatilityThreshold: 70, drawdownThreshold: 35, volatilityPenalty: 5, drawdownPenalty: 5, trendStrengthReward: 10, trendStrengthPenalty: 2 },
        predict: { rsiOverbought: 80, rsiOversold: 20, highVolatilityThreshold: 75, severeDrawdownThreshold: 0.45 }
    },
    SPECULATIVE: {
        name: 'Speculative Profile',
        description: 'Maximum Risk Tolerance',
        req: 'SPECULATIVE',
        screener: { volatilityThreshold: 100, drawdownThreshold: 60, volatilityPenalty: 0, drawdownPenalty: 0, trendStrengthReward: 15, trendStrengthPenalty: 0 },
        predict: { rsiOverbought: 90, rsiOversold: 15, highVolatilityThreshold: 90, severeDrawdownThreshold: 0.60 }
    }
};

export default function Settings() {
    const [configName, setConfigName] = useState('');
    const [configProvider, setConfigProvider] = useState('OPENAI');
    const [configApiKey, setConfigApiKey] = useState('');
    const [configModel, setConfigModel] = useState('');
    const [configBaseUrl, setConfigBaseUrl] = useState('');
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<'ACCOUNT' | 'ANALYSIS' | 'PROVIDERS'>('ACCOUNT');

    const [analysisMode, setAnalysisMode] = useState<'BASIC' | 'ADVANCED'>('BASIC');
    const [selectedRiskProfile, setSelectedRiskProfile] = useState('CONSERVATIVE');
    const [analysisConfigJson, setAnalysisConfigJson] = useState(JSON.stringify({
        screener: { volatilityThreshold: 20, drawdownThreshold: 10, volatilityPenalty: 25, drawdownPenalty: 30, trendStrengthReward: 2, trendStrengthPenalty: 10 },
        predict: { rsiOverbought: 65, rsiOversold: 35, highVolatilityThreshold: 30, severeDrawdownThreshold: 0.15 }
    }, null, 2));

    const [promptRole, setPromptRole] = useState('CONSENSUS');
    const [promptText, setPromptText] = useState('Please review this deterministic market data for {{ASSET_SYMBOL}} on {{DATE}}:\n\n{{EVIDENCE_PACK}}\n\nProvide a short, 2-3 sentence financial analysis.');
    const [promptOutputMode, setPromptOutputMode] = useState('TEXT_ONLY');

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

    const { data: analysisConfigs } = useQuery({
        queryKey: ['analysisConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/analysis');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const saveAnalysisMutation = useMutation({
        mutationFn: async () => {
            let finalizedJson = analysisConfigJson;
            let name = 'Custom Advanced';
            if (analysisMode === 'BASIC') {
                const profile = RISK_PROFILES[selectedRiskProfile];
                if (profile) {
                    name = profile.name;
                    finalizedJson = JSON.stringify({ screener: profile.screener, predict: profile.predict });
                }
            }

            const res = await fetch('/api/settings/analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    assetTypeScope: 'BOTH',
                    configJson: finalizedJson,
                    isActive: true
                })
            });
            if (!res.ok) throw new Error('Failed to save analysis config');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analysisConfigs'] });
            alert('Analysis Configuration Saved Successfully!');
        }
    });

    const { data: promptConfigs } = useQuery({
        queryKey: ['promptConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/prompts');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const savePromptMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/settings/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: promptRole,
                    templateText: promptText,
                    outputMode: promptOutputMode,
                    enabled: true
                })
            });
            if (!res.ok) throw new Error('Failed to save prompt config');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promptConfigs'] });
            alert('Prompt Template Saved Successfully!');
        }
    });

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold mb-6">Settings</h1>
            </div>

            <div className="flex border-b border-neutral-800 mb-6 gap-2">
                <button
                    onClick={() => setActiveTab('ACCOUNT')}
                    className={`px-4 py-2 font-medium ${activeTab === 'ACCOUNT' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300 transition-colors'}`}
                >
                    Account Profile
                </button>
                <button
                    onClick={() => setActiveTab('ANALYSIS')}
                    className={`px-4 py-2 font-medium ${activeTab === 'ANALYSIS' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300 transition-colors'}`}
                >
                    Analysis / Prompts
                </button>
                <button
                    onClick={() => setActiveTab('PROVIDERS')}
                    className={`px-4 py-2 font-medium ${activeTab === 'PROVIDERS' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300 transition-colors'}`}
                >
                    AI Providers
                </button>
            </div>

            {activeTab === 'ACCOUNT' && (
                <AccountProfile />
            )}

            {activeTab === 'PROVIDERS' && (
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
                                <option value="XAI">xAI (Grok)</option>
                                <option value="DEEPSEEK">DeepSeek</option>
                                <option value="GROQ">Groq</option>
                                <option value="TOGETHER">Together AI</option>
                                <option value="OPENAI_COMPAT">OpenAI Compatible (v1)</option>
                            </select>
                        </div>
                        {configProvider === 'OPENAI_COMPAT' && (
                            <p className="text-xs text-indigo-400 mt-1">
                                Use this to connect to any other API that uses the OpenAI format (e.g., LM Studio, vLLM, custom clusters). Provide your custom endpoint in the "Base URL" field.
                            </p>
                        )}
                        <input type="password" placeholder="API Key" value={configApiKey} onChange={e => setConfigApiKey(e.target.value)} required className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                        <div className="grid grid-cols-2 gap-4">
                            <input list="model-options" type="text" placeholder={configProvider === 'ANTHROPIC' ? 'claude-3-5-sonnet-20241022' : configProvider === 'DEEPSEEK' ? 'deepseek-chat' : configProvider === 'GROQ' ? 'llama3-70b-8192' : configProvider === 'GEMINI' ? 'gemini-1.5-flash' : configProvider === 'XAI' ? 'grok-beta' : 'Model Name (e.g. gpt-4o)'} value={configModel} onChange={e => setConfigModel(e.target.value)} required className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                            <datalist id="model-options">
                                {configProvider === 'OPENAI' && <><option value="gpt-4o" /><option value="gpt-4o-mini" /><option value="o1-preview" /></>}
                                {configProvider === 'ANTHROPIC' && <><option value="claude-3-5-sonnet-20241022" /><option value="claude-3-5-haiku-20241022" /><option value="claude-3-opus-20240229" /></>}
                                {configProvider === 'GEMINI' && <><option value="gemini-1.5-flash" /><option value="gemini-1.5-pro" /><option value="gemini-2.0-flash-exp" /></>}
                                {configProvider === 'XAI' && <><option value="grok-beta" /><option value="grok-vision-beta" /><option value="grok-2" /></>}
                                {configProvider === 'DEEPSEEK' && <><option value="deepseek-chat" /><option value="deepseek-reasoner" /></>}
                                {configProvider === 'GROQ' && <><option value="llama3-70b-8192" /><option value="llama3-8b-8192" /><option value="mixtral-8x7b-32768" /></>}
                                {configProvider === 'TOGETHER' && <><option value="meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" /><option value="mistralai/Mixtral-8x7B-Instruct-v0.1" /></>}
                            </datalist>
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
            )}

            {activeTab === 'ANALYSIS' && (
                <div className="space-y-8">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h3 className="text-xl font-semibold mb-4">Analysis Settings</h3>
                        <p className="text-neutral-500 text-sm mb-6">Customize the deterministic algorithms for the Screener and the AI Evidence Packs.</p>

                        <div className="flex border-b border-neutral-800 mb-6">
                            <button onClick={() => setAnalysisMode('BASIC')} className={`px-4 py-2 font-medium ${analysisMode === 'BASIC' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300'}`}>Basic</button>
                            <button onClick={() => setAnalysisMode('ADVANCED')} className={`px-4 py-2 font-medium ${analysisMode === 'ADVANCED' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300'}`}>Advanced</button>
                        </div>

                        {analysisMode === 'BASIC' ? (
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Select a predefined Risk Profile:</label>
                                <select value={selectedRiskProfile} onChange={e => setSelectedRiskProfile(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500">
                                    {Object.entries(RISK_PROFILES).map(([key, p]) => (
                                        <option key={key} value={key}>{p.name.replace(' Profile', '')} ({p.description})</option>
                                    ))}
                                </select>
                                <p className="text-xs text-neutral-500">This modifies backend weights for RSI thresholds, Moving Averages, and Volatility penalties.</p>

                                {selectedRiskProfile && RISK_PROFILES[selectedRiskProfile] && (
                                    <div className="mt-4 bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                        <div className="flex justify-between items-start mb-4">
                                            <h4 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                                                <Info className="w-4 h-4" /> Active Preset Weights
                                            </h4>
                                            <button
                                                onClick={() => {
                                                    const p = RISK_PROFILES[selectedRiskProfile];
                                                    setAnalysisConfigJson(JSON.stringify({ screener: p.screener, predict: p.predict }, null, 2));
                                                    setAnalysisMode('ADVANCED');
                                                }}
                                                className="text-xs flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-1 rounded transition-colors"
                                            >
                                                <Copy className="w-3 h-3" /> Copy to Custom
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-xs font-mono text-neutral-300">
                                            <div>
                                                <span className="text-neutral-500 block mb-1">=== Screener ===</span>
                                                {Object.entries(RISK_PROFILES[selectedRiskProfile].screener).map(([k, v]) => (
                                                    <div key={k} className="flex justify-between"><span className="text-neutral-400">{k}:</span> <span className="text-white">{String(v)}</span></div>
                                                ))}
                                            </div>
                                            <div>
                                                <span className="text-neutral-500 block mb-1">=== Predict ===</span>
                                                {Object.entries(RISK_PROFILES[selectedRiskProfile].predict).map(([k, v]) => (
                                                    <div key={k} className="flex justify-between"><span className="text-neutral-400">{k}:</span> <span className="text-white">{String(v)}</span></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Raw JSON Configuration:</label>
                                <textarea
                                    value={analysisConfigJson}
                                    onChange={e => setAnalysisConfigJson(e.target.value)}
                                    className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 resize-none"
                                    placeholder="Enter valid JSON for weights..."
                                />
                                <p className="text-xs text-neutral-500">Available keys: screener (volatilityThreshold, drawdownThreshold, etc), predict (rsiOverbought, rsiOversold, etc).</p>
                            </div>
                        )}

                        <button
                            onClick={() => saveAnalysisMutation.mutate()}
                            disabled={saveAnalysisMutation.isPending}
                            className="mt-6 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-medium text-white rounded-lg w-full transition-colors"
                        >
                            {saveAnalysisMutation.isPending ? 'Applying...' : 'Apply Analysis Config'}
                        </button>

                        {analysisConfigs && analysisConfigs.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-neutral-800">
                                <h4 className="text-sm font-medium text-neutral-400 mb-3">Active Profile:</h4>
                                {analysisConfigs.filter((c: any) => c.isActive).map((c: any) => (
                                    <div key={c.id} className="bg-neutral-950/50 p-3 rounded border border-indigo-500/30">
                                        <span className="text-indigo-400 text-sm font-medium">{c.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h3 className="text-xl font-semibold mb-4">AI Prompts <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded ml-2 uppercase">Advanced</span></h3>
                        <p className="text-neutral-500 text-sm mb-6">Override the default LLM prompts. Use <code>{`{{EVIDENCE_PACK}}`}</code> or <code>{`{{ASSET_SYMBOL}}`}</code> to inject data.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Target Role / Context:</label>
                                <select value={promptRole} onChange={e => setPromptRole(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500">
                                    <option value="CONSENSUS">Consensus / Daily Snapshot</option>
                                    <option value="SCREENER">Screener Narrative</option>
                                    <option value="RISK">Risk Assessment</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Prompt Template:</label>
                                <textarea
                                    value={promptText}
                                    onChange={e => setPromptText(e.target.value)}
                                    className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 resize-none"
                                />
                                {promptText.includes('{{') && (
                                    <div className="mt-2 p-3 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-400 font-mono whitespace-pre-wrap">
                                        <div className="font-bold text-neutral-300 mb-1 uppercase tracking-wider text-[10px]">Live Preview</div>
                                        {promptText
                                            .replace(/{{ASSET_SYMBOL}}/g, 'AAPL')
                                            .replace(/{{DATE}}/g, new Date().toISOString().split('T')[0])
                                            .replace(/{{EVIDENCE_PACK}}/g, '{"vol": 0.2, "rsi": 45, "trend": "BULLISH"}')
                                            .replace(/{{EVIDENCE_PACK_JSON}}/g, '{"vol": 0.2, "rsi": 45, "trend": "BULLISH"}')}
                                    </div>
                                )}
                            </div>

                            <div className="bg-neutral-950 p-4 border border-neutral-800 rounded-lg space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-2">Output Format:</label>
                                    <select value={promptOutputMode} onChange={e => setPromptOutputMode(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                                        <option value="TEXT_ONLY">Standard Text</option>
                                        <option value="MARKDOWN">Markdown</option>
                                        <option value="JSON">Raw JSON</option>
                                        <option value="ACTION_LABELS">JSON + Action Labels (BUY/WAIT/SELL)</option>
                                    </select>
                                </div>
                                {promptOutputMode === 'ACTION_LABELS' && (
                                    <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded border border-rose-500/20">
                                        <b>Disclaimer:</b> If enabled, the LLM will be forced to output simulated trading signals. This is STRICTLY for educational/demonstrational purposes and is NOT financial advice. Use at your own risk.
                                    </p>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => savePromptMutation.mutate()}
                            disabled={savePromptMutation.isPending}
                            className="mt-6 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-medium text-white rounded-lg w-full transition-colors"
                        >
                            {savePromptMutation.isPending ? 'Saving...' : 'Save Prompt Template'}
                        </button>

                        {promptConfigs && promptConfigs.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-neutral-800">
                                <h4 className="text-sm font-medium text-neutral-400 mb-3">Active Prompts:</h4>
                                {promptConfigs.filter((c: any) => c.enabled).map((c: any) => (
                                    <div key={c.id} className="bg-neutral-950/50 p-3 rounded border border-indigo-500/30 flex justify-between items-center mb-2">
                                        <div>
                                            <span className="text-indigo-400 text-sm font-medium block">{c.role}</span>
                                            <span className="text-xs text-neutral-500 font-mono inline-block truncate max-w-[200px]">{c.templateText}</span>
                                        </div>
                                        {c.outputMode === 'ACTION_LABELS' && (
                                            <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded uppercase">Action Labels ON</span>
                                        )}
                                        {c.outputMode === 'MARKDOWN' && (
                                            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase">Markdown</span>
                                        )}
                                        {c.outputMode === 'JSON' && (
                                            <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase">JSON</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
