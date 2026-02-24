import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Play, Blocks } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PortfolioSummaryWidget } from '../components/PortfolioSummaryWidget';
import { SortableCard } from '../components/SortableCard';

export default function Dashboard({ onSelect }: { onSelect: (symbol: string, assetType: string) => void }) {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [items, setItems] = useState<any[]>([]);

    const { data: overviews, isLoading } = useQuery({
        queryKey: ['overview'],
        queryFn: async () => {
            const res = await fetch('/api/overview/today');
            if (res.status === 401) throw new Error('Unauthorized');
            if (!res.ok) throw new Error('Network error');
            return res.json();
        },
    });

    useEffect(() => {
        if (overviews) {
            setItems(overviews);
        }
    }, [overviews]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const reorderMutation = useMutation({
        mutationFn: async (newOrder: { symbol: string, order: number }[]) => {
            await fetch('/api/tracked-assets/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOrder)
            });
        }
    });

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex(i => i.symbol === active.id);
                const newIndex = items.findIndex(i => i.symbol === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Fire mutation to save to db
                const payload = newItems.map((item, idx) => ({ symbol: item.symbol, order: idx }));
                reorderMutation.mutate(payload);

                return newItems;
            });
        }
    };

    const { data: universes, isLoading: isLoadingUniverses } = useQuery({
        queryKey: ['universes'],
        queryFn: async () => {
            const res = await fetch('/api/universes');
            if (res.status === 401) return [];
            if (!res.ok) throw new Error('Network error');
            return res.json();
        }
    });

    const runJobMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/admin/run-daily', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to start daily job');
        },
        onSuccess: () => {
            alert('Daily Analysis Job started in the background. Check back in a few minutes!');
        }
    });

    const queryClient = useQueryClient();
    const untrackMutation = useMutation({
        mutationFn: async (symbol: string) => {
            const res = await fetch(`/api/tracked-assets/${symbol}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to untrack asset');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['overview'] });
        }
    });

    if (isLoading) return <div className="text-center py-20 text-neutral-500 animate-pulse">Loading market data...</div>;

    return (
        <div className="space-y-6">
            <div className="mb-2">
                <p className="text-neutral-400 font-medium">Welcome, {user?.fullName || user?.email}</p>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">Overview Dashboard</h1>
            </div>

            <PortfolioSummaryWidget />

            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Market Overview</h2>
                {['ADMIN', 'SUPERADMIN'].includes(user?.role || '') && (
                    <button
                        onClick={() => runJobMutation.mutate()}
                        disabled={runJobMutation.isPending}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Play size={16} /> Run Daily Job
                    </button>
                )}
            </div>

            {!items || items.length === 0 ? (
                <div className="p-12 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20">
                    <Server className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-300">No assets tracked</h3>
                    <p className="text-neutral-500 mt-1">Go to Watchlists to add symbols to your portfolio.</p>
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map(i => i.symbol)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item: any) => (
                                <SortableCard
                                    key={item.symbol}
                                    item={item}
                                    onClick={() => onSelect(item.symbol, item.assetType)}
                                    onUntrack={(s: string) => untrackMutation.mutate(s)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* Custom Universes Section */}
            <div className="pt-8 mt-8 border-t border-neutral-800">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold tracking-tight">Your Custom Universes</h2>
                </div>

                {isLoadingUniverses ? (
                    <div className="text-neutral-500 animate-pulse">Loading universes...</div>
                ) : !universes || universes.length === 0 ? (
                    <div className="p-8 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20">
                        <Blocks className="mx-auto h-10 w-10 text-neutral-600 mb-3" />
                        <h3 className="text-base font-medium text-neutral-300">No Custom Universes</h3>
                        <p className="text-sm text-neutral-500 mt-1">Create one in the Universe Builder (Pro Feature).</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {universes.map((u: any) => {
                            const def = JSON.parse(u.definitionJson);
                            return (
                                <div
                                    key={u.id}
                                    onClick={() => navigate(`/app/universe/${u.id}`)}
                                    className="group p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/50 hover:bg-neutral-800/80 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-full"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-xl font-bold text-white">{u.name}</h3>
                                            <span className="text-[10px] uppercase font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                                {u.universeType}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {def.q && <span className="px-2 py-0.5 bg-neutral-800 rounded text-xs text-neutral-300">Name: {def.q}</span>}
                                            {def.sector && <span className="px-2 py-0.5 bg-neutral-800 rounded text-xs text-neutral-300">Sector: {def.sector}</span>}
                                            {def.industry && <span className="px-2 py-0.5 bg-neutral-800 rounded text-xs text-neutral-300">Ind: {def.industry}</span>}
                                            {def.exchange && <span className="px-2 py-0.5 bg-neutral-800 rounded text-xs text-neutral-300">Exch: {def.exchange}</span>}
                                        </div>
                                    </div>
                                    <div className="mt-6 text-sm text-indigo-400 font-medium group-hover:text-indigo-300 transition-colors flex items-center gap-1">
                                        View Group Analysis &rarr;
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
