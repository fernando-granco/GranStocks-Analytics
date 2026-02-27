import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface Portfolio {
    id: string;
    name: string;
    baseCurrency: string;
    createdAt: string;
}

interface PortfolioContextType {
    portfolios: Portfolio[];
    selectedPortfolio: Portfolio | null;
    setSelectedPortfolioId: (id: string) => void;
    refreshPortfolios: () => Promise<void>;
    isLoading: boolean;
}

const PortfolioContext = createContext<PortfolioContextType>({
    portfolios: [],
    selectedPortfolio: null,
    setSelectedPortfolioId: () => { },
    refreshPortfolios: async () => { },
    isLoading: true
});

export const usePortfolios = () => useContext(PortfolioContext);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [selectedPortfolioId, setSelectedPortfolioIdState] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshPortfolios = useCallback(async () => {
        if (!user) return;
        try {
            const res = await fetch('/api/portfolio/list');
            if (res.ok) {
                const data = await res.json();
                setPortfolios(data);
                if (data.length > 0 && !selectedPortfolioId) {
                    // Try to restore from localStorage or default to first
                    const saved = localStorage.getItem('selectedPortfolioId');
                    if (saved && data.find((p: any) => p.id === saved)) {
                        setSelectedPortfolioIdState(saved);
                    } else {
                        setSelectedPortfolioIdState(data[0].id);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch portfolios:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user, selectedPortfolioId]);

    useEffect(() => {
        if (user) {
            refreshPortfolios();
        } else {
            setPortfolios([]);
            setSelectedPortfolioIdState(null);
            setIsLoading(false);
        }
    }, [user, refreshPortfolios]);

    const setSelectedPortfolioId = (id: string) => {
        setSelectedPortfolioIdState(id);
        localStorage.setItem('selectedPortfolioId', id);
    };

    const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId) || (portfolios.length > 0 ? portfolios[0] : null);

    return (
        <PortfolioContext.Provider value={{
            portfolios,
            selectedPortfolio,
            setSelectedPortfolioId,
            refreshPortfolios,
            isLoading
        }}>
            {children}
        </PortfolioContext.Provider>
    );
};
