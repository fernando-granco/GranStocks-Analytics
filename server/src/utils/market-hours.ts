export type MarketRegion = 'US' | 'CA' | 'BR' | 'CRYPTO';
export type SessionStatus = 'PRE_OPEN' | 'OPEN' | 'POST_CLOSE' | 'CLOSED' | 'ALWAYS_OPEN';

export interface MarketSessionInfo {
    market: MarketRegion;
    status: SessionStatus;
    quoteType: 'Last Trade' | 'Last Close' | 'Last';
}

/**
 * Returns the current market session status and quote type label
 * based on the provided asset type and symbol.
 */
export function getMarketSession(symbol: string, assetType: 'STOCK' | 'CRYPTO', now?: Date): MarketSessionInfo {
    if (assetType === 'CRYPTO') {
        return { market: 'CRYPTO', status: 'ALWAYS_OPEN', quoteType: 'Last Trade' };
    }

    const _now = now || new Date();

    if (symbol.endsWith('.SA')) {
        return getBrazilSessionInfo(_now);
    } else if (symbol.endsWith('.TO') || symbol.endsWith('.V') || symbol.endsWith('.CN')) {
        // Canadian exchanges
        return getCanadaSessionInfo(_now);
    } else {
        return getUsSessionInfo(_now);
    }
}

function isWeekend(dayStr: string): boolean {
    return ['Sat', 'Sun'].includes(dayStr);
}

function getUsSessionInfo(now: Date): MarketSessionInfo {
    // US (NYSE/NASDAQ): 09:30–16:00 ET
    // Pre-open: 09:15-09:30 ET
    // Post-close: 16:00-17:00 ET
    const options = { timeZone: 'America/New_York', hour12: false };
    const hour = parseInt(now.toLocaleTimeString('en-US', { ...options, hour: 'numeric' }));
    const minute = parseInt(now.toLocaleTimeString('en-US', { ...options, minute: 'numeric' }));
    const day = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });

    if (isWeekend(day)) {
        return { market: 'US', status: 'CLOSED', quoteType: 'Last Close' };
    }

    const timeInMins = hour * 60 + minute;
    const openMins = 9 * 60 + 30;   // 09:30
    const closeMins = 16 * 60;      // 16:00
    const preOpenMins = 9 * 60 + 15;// 09:15
    const postCloseMins = 17 * 60;  // 17:00

    if (timeInMins >= preOpenMins && timeInMins < openMins) {
        return { market: 'US', status: 'PRE_OPEN', quoteType: 'Last Close' };
    } else if (timeInMins >= openMins && timeInMins < closeMins) {
        return { market: 'US', status: 'OPEN', quoteType: 'Last Trade' };
    } else if (timeInMins >= closeMins && timeInMins < postCloseMins) {
        return { market: 'US', status: 'POST_CLOSE', quoteType: 'Last Close' };
    } else {
        return { market: 'US', status: 'CLOSED', quoteType: 'Last Close' };
    }
}

function getCanadaSessionInfo(now: Date): MarketSessionInfo {
    // TSX: 09:30–16:00 ET (Roughly aligned with US)
    const options = { timeZone: 'America/Toronto', hour12: false };
    const hour = parseInt(now.toLocaleTimeString('en-US', { ...options, hour: 'numeric' }));
    const minute = parseInt(now.toLocaleTimeString('en-US', { ...options, minute: 'numeric' }));
    const day = now.toLocaleDateString('en-US', { timeZone: 'America/Toronto', weekday: 'short' });

    if (isWeekend(day)) {
        return { market: 'CA', status: 'CLOSED', quoteType: 'Last Close' };
    }

    const timeInMins = hour * 60 + minute;
    const openMins = 9 * 60 + 30; // 09:30
    const closeMins = 16 * 60;    // 16:00

    if (timeInMins >= openMins && timeInMins < closeMins) {
        return { market: 'CA', status: 'OPEN', quoteType: 'Last Trade' };
    } else {
        return { market: 'CA', status: 'CLOSED', quoteType: 'Last Close' };
    }
}

function getBrazilSessionInfo(now: Date): MarketSessionInfo {
    // B3 (Brazil): 10:00–17:00 BRT
    const options = { timeZone: 'America/Sao_Paulo', hour12: false };
    const hour = parseInt(now.toLocaleTimeString('en-US', { ...options, hour: 'numeric' }));
    const minute = parseInt(now.toLocaleTimeString('en-US', { ...options, minute: 'numeric' }));
    const day = now.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });

    if (isWeekend(day)) {
        return { market: 'BR', status: 'CLOSED', quoteType: 'Last Close' };
    }

    const timeInMins = hour * 60 + minute;
    const openMins = 10 * 60; // 10:00
    const closeMins = 17 * 60;// 17:00

    if (timeInMins >= openMins && timeInMins < closeMins) {
        return { market: 'BR', status: 'OPEN', quoteType: 'Last Trade' };
    } else {
        return { market: 'BR', status: 'CLOSED', quoteType: 'Last Close' };
    }
}
