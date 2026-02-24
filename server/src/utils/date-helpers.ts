export function toDateString(d: Date = new Date()): string {
    const timeZone = process.env.ANALYSIS_TIMEZONE || 'America/New_York';
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(d);
    const mo = parts.find(p => p.type === 'month')!.value;
    const da = parts.find(p => p.type === 'day')!.value;
    const ye = parts.find(p => p.type === 'year')!.value;
    return `${ye}-${mo}-${da}`;
}

export function toDateHourString(d: Date = new Date()): string {
    const timeZone = process.env.ANALYSIS_TIMEZONE || 'America/New_York';
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
    const parts = formatter.formatToParts(d);
    const mo = parts.find(p => p.type === 'month')!.value;
    const da = parts.find(p => p.type === 'day')!.value;
    const ye = parts.find(p => p.type === 'year')!.value;
    let hr = parts.find(p => p.type === 'hour')!.value;
    if (hr === '24') hr = '00';
    return `${ye}-${mo}-${da}T${hr}:00`;
}
