import { BellRing, Plus } from 'lucide-react';

export default function Alerts() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><BellRing className="text-rose-400" /> Price & RSI Alerts</h1>
                    <p className="text-neutral-500">Configure triggers for immediate notification on critical market movements.</p>
                </div>
                <button className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                    <Plus size={16} /> New Alert
                </button>
            </div>

            <div className="text-center p-16 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/30">
                <BellRing size={48} className="mx-auto text-neutral-600 mb-4" />
                <h3 className="text-xl font-medium text-neutral-300 mb-2">Alerts system under construction</h3>
                <p className="text-neutral-500 max-w-sm mx-auto">
                    The backend workers are currently being upgraded to support real-time webhooks and email notifications. Check back later.
                </p>
            </div>
        </div>
    );
}
