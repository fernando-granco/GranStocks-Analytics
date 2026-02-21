import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

type Mode = 'BASIC' | 'ADVANCED';

interface PreferencesContextType {
    mode: Mode;
    timezone: string;
    setMode: (mode: Mode) => Promise<void>;
    setTimezone: (tz: string) => Promise<void>;
    isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType>({
    mode: 'BASIC',
    timezone: 'America/Toronto',
    setMode: async () => { },
    setTimezone: async () => { },
    isLoading: true
});

export const usePreferences = () => useContext(PreferencesContext);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [mode, setModeState] = useState<Mode>('BASIC');
    const [timezone, setTimezoneState] = useState<string>('America/Toronto');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        fetch('/api/settings/preferences')
            .then(res => res.json())
            .then(data => {
                if (data.mode) setModeState(data.mode);
                if (data.timezone) setTimezoneState(data.timezone);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));

    }, [user]);

    const setMode = async (newMode: Mode) => {
        setModeState(newMode); // Optimistic UI update
        try {
            const res = await fetch('/api/settings/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: newMode })
            });
            if (!res.ok) throw new Error('Failed to update preferences');
        } catch (err) {
            console.error(err);
        }
    };

    const setTimezone = async (newTz: string) => {
        setTimezoneState(newTz);
        try {
            const res = await fetch('/api/settings/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timezone: newTz })
            });
            if (!res.ok) throw new Error('Failed to update timezone');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <PreferencesContext.Provider value={{ mode, timezone, setMode, setTimezone, isLoading }}>
            {children}
        </PreferencesContext.Provider>
    );
};
