import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, LineSeries } from 'lightweight-charts';

interface ChartProps {
    data: { time: string | number, open: number, high: number, low: number, close: number }[];
    type?: 'line' | 'candle';
}

export function TradingViewChart({ data, type = 'candle' }: ChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#737373', // neutral-500
            },
            grid: {
                vertLines: { color: '#262626' }, // neutral-800
                horzLines: { color: '#262626' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#262626'
            },
            rightPriceScale: {
                borderColor: '#262626'
            }
        });
        chartRef.current = chart;

        if (type === 'candle') {
            const candlestickSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#34d399', // emerald-400
                downColor: '#fb7185', // rose-400
                borderVisible: false,
                wickUpColor: '#34d399', // emerald-400
                wickDownColor: '#fb7185', // rose-400
            });
            candlestickSeries.setData(data as any);
        } else {
            const lineSeries = chart.addSeries(LineSeries, {
                color: '#818cf8', // indigo-400
                lineWidth: 2,
            });
            // Map candlestick data to line data (using close price)
            const lineData = data.map(d => ({ time: d.time, value: d.close }));
            lineSeries.setData(lineData as any);
        }

        chart.timeScale().fitContent();

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, type]);

    return <div ref={chartContainerRef} className="w-full h-full" />;
}
