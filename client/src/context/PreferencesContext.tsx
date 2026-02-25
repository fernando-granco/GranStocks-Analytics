import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface PreferencesContextType {
    mode: 'ADVANCED';
    timezone: string;
    hideEmptyMarketOverview: boolean;
    hideEmptyCustomUniverses: boolean;
    hideEmptyPortfolio: boolean;
    setTimezone: (tz: string) => Promise<void>;
    updatePreferences: (updates: Partial<{ hideEmptyMarketOverview: boolean; hideEmptyCustomUniverses: boolean; hideEmptyPortfolio: boolean; timezone: string }>) => Promise<void>;
    isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType>({
    mode: 'ADVANCED',
    timezone: 'America/Toronto',
    hideEmptyMarketOverview: false,
    hideEmptyCustomUniverses: false,
    hideEmptyPortfolio: false,
    setTimezone: async () => { },
    updatePreferences: async () => { },
    isLoading: true
});

export const usePreferences = () => useContext(PreferencesContext);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [timezone, setTimezoneState] = useState<string>('America/Toronto');
    const [hideEmptyMarketOverview, setHideEmptyMarketOverview] = useState(false);
    const [hideEmptyCustomUniverses, setHideEmptyCustomUniverses] = useState(false);
    const [hideEmptyPortfolio, setHideEmptyPortfolio] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        fetch('/api/settings/preferences')
            .then(res => res.json())
            .then(data => {
                if (data.timezone) setTimezoneState(data.timezone);
                if (data.hideEmptyMarketOverview !== undefined) setHideEmptyMarketOverview(data.hideEmptyMarketOverview);
                if (data.hideEmptyCustomUniverses !== undefined) setHideEmptyCustomUniverses(data.hideEmptyCustomUniverses);
                if (data.hideEmptyPortfolio !== undefined) setHideEmptyPortfolio(data.hideEmptyPortfolio);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [user]);

    const setTimezone = async (newTz: string) => {
        await updatePreferences({ timezone: newTz });
    };

    const updatePreferences = async (updates: Partial<{ hideEmptyMarketOverview: boolean; hideEmptyCustomUniverses: boolean; hideEmptyPortfolio: boolean; timezone: string }>) => {
        if (updates.timezone !== undefined) setTimezoneState(updates.timezone);
        if (updates.hideEmptyMarketOverview !== undefined) setHideEmptyMarketOverview(updates.hideEmptyMarketOverview);
        if (updates.hideEmptyCustomUniverses !== undefined) setHideEmptyCustomUniverses(updates.hideEmptyCustomUniverses);
        if (updates.hideEmptyPortfolio !== undefined) setHideEmptyPortfolio(updates.hideEmptyPortfolio);

        try {
            const res = await fetch('/api/settings/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error('Failed to update preferences');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <PreferencesContext.Provider value={{
            mode: 'ADVANCED',
            timezone,
            hideEmptyMarketOverview,
            hideEmptyCustomUniverses,
            hideEmptyPortfolio,
            setTimezone,
            updatePreferences,
            isLoading
        }}>
            {children}
        </PreferencesContext.Provider>
    );
};
