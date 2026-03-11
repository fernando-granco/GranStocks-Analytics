import { BellRing, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Alerts() {
    const { i18n } = useTranslation();
    const tr = (en: string, pt: string) => (i18n.language === 'pt-BR' ? pt : en);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><BellRing className="text-rose-400" /> {tr('Price & RSI Alerts', 'Alertas de Preço e RSI')}</h1>
                    <p className="text-neutral-500">{tr('Set triggers to receive immediate notifications about critical market moves.', 'Configure gatilhos para receber notificações imediatas sobre movimentos críticos do mercado.')}</p>
                </div>
                <button className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                    <Plus size={16} /> {tr('New alert', 'Novo alerta')}
                </button>
            </div>

            <div className="text-center p-16 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/30">
                <BellRing size={48} className="mx-auto text-neutral-600 mb-4" />
                <h3 className="text-xl font-medium text-neutral-300 mb-2">{tr('Alert system under development', 'Sistema de alertas em construção')}</h3>
                <p className="text-neutral-500 max-w-sm mx-auto">
                    {tr('Backend workers are being updated to support webhooks and real-time email notifications. Check back soon.', 'Os workers de backend estão sendo atualizados para suportar webhooks e notificações por e-mail em tempo real. Volte em breve.')}
                </p>
            </div>
        </div>
    );
}
