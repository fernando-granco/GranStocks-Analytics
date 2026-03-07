export function inferCurrency(symbol: string, assetType: string) {
    if (assetType === 'CRYPTO') {
        return { currency: 'USD', isUsdNative: true };
    }

    if (symbol.endsWith('.SA')) {
        return { currency: 'BRL', isUsdNative: false };
    }

    if (symbol.endsWith('.TO')) {
        return { currency: 'CAD', isUsdNative: false };
    }

    return { currency: 'USD', isUsdNative: true };
}
