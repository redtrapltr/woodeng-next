'use client';

import React, { useEffect, useRef } from 'react';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';



// 1 SOL = 1.0 UI unit; 1 lamport = 1e-9 SOL
const UI_TICK = 1e-9;
// treat opens smaller than a few ticks as effectively zero
const EPS = 5 * UI_TICK;


// derive types
type LWC = typeof import('lightweight-charts');
type ChartApi = ReturnType<LWC['createChart']>;

type Candle = { t: number; o: number; h: number; l: number; c: number };
type VolBar = { t: number; v: number; up?: boolean };

type Props = {
  data: Candle[];
  latest?: Candle | null;
  volume?: VolBar[]; // ← NEW
  yTickFormatter?: (v: number) => string;
  onBarHover?: (info: { candle: Candle | null; pct: number | null }) => void;
};

export default function CandleChart({ data, latest, volume, yTickFormatter, onBarHover }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef     = useRef<ChartApi | null>(null);
  const seriesRef    = useRef<any | null>(null);
  const volSeriesRef = useRef<any | null>(null); // ← NEW
  const roRef        = useRef<ResizeObserver | null>(null);
  const fmtRef       = useRef<Props['yTickFormatter'] | null>(null);
  const legendRef    = useRef<HTMLDivElement | null>(null);
  const cbRef        = useRef<Props['onBarHover'] | null>(null);

  // zoom/fit management
  const didUserZoomRef = useRef(false);
  const didFirstFitRef = useRef(false);




const prevCloseMapRef = useRef<Map<number, number>>(new Map());


  // default “max 6 decimals, trim trailing zeros”
  const defaultFmt = (p: number) => {
    if (!Number.isFinite(p)) return '0';
    return p.toFixed(6).replace(/\.?0+$/,'');
  };
  useEffect(() => { fmtRef.current = yTickFormatter ?? defaultFmt; }, [yTickFormatter]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    chartRef.current?.remove();
    chartRef.current = null;
    seriesRef.current = null;
    volSeriesRef.current = null;

    let alive = true;
    const unsubs: Array<() => void> = [];

    (async () => {
      const L = await import('lightweight-charts'); // v5
      const { createChart, ColorType, CrosshairMode } = L;
      if (!alive || !el) return;

      const chart = createChart(el, {
        width: el.clientWidth,
        height: el.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255,255,255,0.8)',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.08)' },
          horzLines: { color: 'rgba(255,255,255,0.08)' },
        },
        rightPriceScale: { borderVisible: false },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: true,
          // allow user zoom/scroll
          rightOffset: 0,
          fixLeftEdge: false,
          fixRightEdge: false,
        },
        crosshair: { mode: CrosshairMode.Magnet },
        localization: {
          priceFormatter: (p: number) => (fmtRef.current ? fmtRef.current(p) : defaultFmt(p)),
        },
      });

      chartRef.current = chart;

      // when user scrolls/zooms, remember it so we don’t auto-fit later
      const ts = chart.timeScale();
      const onRange = () => { didUserZoomRef.current = true; };
      // v5 name:
      (ts as any).subscribeVisibleLogicalRangeChange?.(onRange);
      unsubs.push(() => (ts as any).unsubscribeVisibleLogicalRangeChange?.(onRange));

      // Candle series
      const seriesOpts = {
        upColor: '#26a69a',
        downColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        borderVisible: false,
        priceFormat: {
          type: 'custom' as const,
          minMove: 0.000001,
          formatter: (p: number) => (fmtRef.current ? fmtRef.current(p) : defaultFmt(p)),
        },
      };

      let candles: any;
      if ('addSeries' in chart) {
        candles = chart.addSeries((L as any).CandlestickSeries, seriesOpts);
      } else if ('addCandlestickSeries' in (chart as any)) {
        candles = (chart as any).addCandlestickSeries(seriesOpts);
      } else {
        throw new Error('No candlestick series API found on chart');
      }
      seriesRef.current = candles;

      // Volume series on its own scale at the bottom
      let volumeSeries: any;
      const volOpts = {
        priceFormat: { type: 'volume' as const },
        priceScaleId: 'volume',
      };
      if ('addSeries' in chart) {
        volumeSeries = chart.addSeries((L as any).HistogramSeries, volOpts);
      } else if ('addHistogramSeries' in (chart as any)) {
        volumeSeries = (chart as any).addHistogramSeries(volOpts);
      }
      volSeriesRef.current = volumeSeries;



      // --- ADD right after volSeriesRef.current = volumeSeries; ---

// helper to convert your Candle -> LWC bar
const toCandle = (d: Candle): CandlestickData => ({
  time: Math.floor(d.t / 1000) as UTCTimestamp,
  open: +d.o,
  high: +d.h,
  low:  +d.l,
  close:+d.c,
});

// seed initial candles
const seedCandles = (data ?? []).map(toCandle);
if (seedCandles.length) {
  candles.setData(seedCandles);
}


// --- PATCH: build time(ms) -> previous close map from initial data ---
prevCloseMapRef.current = new Map();
for (let i = 1; i < seedCandles.length; i++) {
  const cur = seedCandles[i];
  const prev = seedCandles[i - 1];
  prevCloseMapRef.current.set(
    (cur.time as number) * 1000, // store ms to match your Candle.t
    prev.close as number
  );
}
// --- END PATCH ---

// seed initial volume (if provided)
if (volumeSeries && volume?.length) {
  volumeSeries.setData(
    volume.map(b => ({
      time: Math.floor(b.t / 1000) as UTCTimestamp,
      value: Math.max(0, +b.v),
      color: b.up ? 'rgba(38,166,154,0.6)' : 'rgba(239,83,80,0.6)',
    }))
  );
}

// show something immediately
if (seedCandles.length) {
  chart.timeScale().fitContent();
  didFirstFitRef.current = true;
}

// optional: also seed the very latest bar
if (latest) {
  candles.update(toCandle(latest));
}


      // margin to push volume to the bottom; hide its axis
      try {
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.80, bottom: 0.00 },
          borderVisible: false,
          visible: false,
        });
      } catch {}

      // simple hover legend (O / H / L / C and Δ%)
      const legend = document.createElement('div');
      legend.style.position = 'absolute';
      legend.style.left = '8px';
      legend.style.top = '8px';
      legend.style.padding = '6px 8px';
      legend.style.background = 'rgba(0,0,0,0.55)';
      legend.style.borderRadius = '8px';
      legend.style.fontSize = '11px';
      legend.style.lineHeight = '1.15';
      legend.style.pointerEvents = 'none';
      legend.style.whiteSpace = 'nowrap';
      legend.style.border = '1px solid rgba(255,255,255,0.1)';
      legend.style.backdropFilter = 'blur(2px)';
      legend.style.color = '#fff';
      legend.textContent = '';
      el.appendChild(legend);
      legendRef.current = legend;

      const onMove = (param: any) => {
        if (!legendRef.current) return;
        const sd = param?.seriesData?.get?.(candles) as CandlestickData | undefined;

        let o = NaN, h = NaN, l = NaN, c = NaN;
        if (sd && typeof (sd as any).open === 'number') {
          o = (sd as any).open;
          h = (sd as any).high;
          l = (sd as any).low;
          c = (sd as any).close;
        }

        const fmt = (v: number) => (fmtRef.current ? fmtRef.current(v) : defaultFmt(v));
        let pct: number | null = null;

if (Number.isFinite(o) && Number.isFinite(c)) {
  // Choose baseline: valid open, else previous bar's close.
  const tMs = (sd?.time as number) * 1000;

  const baseline =
    Math.abs(o) > EPS
      ? o
      : prevCloseMapRef.current.get(tMs);

  if (Number.isFinite(baseline as number) && Math.abs(baseline as number) > EPS) {
    pct = ((c - (baseline as number)) / (baseline as number)) * 100;
  }
}



        if (Number.isFinite(o)) {
          legendRef.current.innerHTML =
            `O ${fmt(o)} &nbsp; H ${fmt(h)} &nbsp; L ${fmt(l)} &nbsp; C ${fmt(c)}` +
            (pct !== null ? ` &nbsp; <span style="opacity:.85">${pct >= 0 ? '▲' : '▼'} ${pct.toFixed(2)}%</span>` : '');
        } else {
          legendRef.current.innerHTML = '';
        }

        if (cbRef.current) {
          if (sd && Number.isFinite(o) && Number.isFinite(h) && Number.isFinite(l) && Number.isFinite(c)) {
            cbRef.current({
              candle: { t: (param?.time as number) * 1000, o, h, l, c },
              pct,
            });
          } else {
            cbRef.current({ candle: null, pct: null });
          }
        }
      };

      chart.subscribeCrosshairMove(onMove);
      unsubs.push(() => chart.unsubscribeCrosshairMove(onMove));

      if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(() => {
          const c = containerRef.current;
          const ch = chartRef.current;
          if (!c || !ch) return;
          ch.applyOptions({ width: c.clientWidth, height: c.clientHeight });
        });
        ro.observe(el);
        roRef.current = ro;
      }
    })();

    return () => {
      roRef.current?.disconnect();
      try { chartRef.current?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
      if (legendRef.current?.parentElement) {
        legendRef.current.parentElement.removeChild(legendRef.current);
      }
      legendRef.current = null;
      didUserZoomRef.current = false;
      didFirstFitRef.current = false;
    };
  }, []);

  // formatter live update
  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    s.applyOptions({
      priceFormat: {
        type: 'custom',
        minMove: 0.000001,
        formatter: (p: number) => (fmtRef.current ? fmtRef.current(p) : defaultFmt(p)),
      },
    });
  }, [yTickFormatter]);

  // keep callback ref fresh
  useEffect(() => { cbRef.current = onBarHover ?? null; }, [onBarHover]);

  // full data reload — preserve zoom if user interacted; fit once otherwise
  useEffect(() => {
    const s  = seriesRef.current;
    const ch = chartRef.current;
    if (!s || !ch) return;

    const mapped: CandlestickData[] = (data ?? []).map(d => ({
      time: Math.floor(d.t / 1000) as UTCTimestamp,
      open: +d.o,
      high: +d.h,
      low:  +d.l,
      close:+d.c,
    }));

    const ts = ch.timeScale();
    const prevRange = (ts as any).getVisibleLogicalRange?.();

    s.setData(mapped);

    // --- PATCH: rebuild time(ms) -> previous close map on full reload ---
prevCloseMapRef.current = new Map();
for (let i = 1; i < mapped.length; i++) {
  const cur = mapped[i];
  const prev = mapped[i - 1];
  prevCloseMapRef.current.set(
    (cur.time as number) * 1000,
    prev.close as number
  );
}
// --- END PATCH ---


    if (didUserZoomRef.current && prevRange) {
      // keep current zoom
      (ts as any).setVisibleLogicalRange?.(prevRange);
    } else if (!didFirstFitRef.current) {
      ts.fitContent();
      didFirstFitRef.current = true;
    }
  }, [data]);

  // volume data (optional)
  useEffect(() => {
    const vs = volSeriesRef.current;
    if (!vs) return;
    if (!volume || !volume.length) {
      vs.setData([]);
      return;
    }
    vs.setData(
      volume.map(b => ({
        time: Math.floor(b.t / 1000) as UTCTimestamp,
        value: Math.max(0, +b.v),
        color: b.up ? 'rgba(38,166,154,0.6)' : 'rgba(239,83,80,0.6)',
      }))
    );
  }, [volume]);

  // quick live update (candles only — volume is discrete per bucket)
  useEffect(() => {
    const s = seriesRef.current;
    if (!s || !latest) return;
    s.update({
      time: Math.floor(latest.t / 1000) as UTCTimestamp,
      open: +latest.o,
      high: +latest.h,
      low:  +latest.l,
      close:+latest.c,
    });

    // --- PATCH: ensure prevClose exists for the latest bar ---
const arr = data ?? [];
if (arr.length >= 1) {
  // Use the most recent *completed* bar's close as baseline for the current bar
  const last = arr[arr.length - 1];
  // only set if not set; avoids overwriting if we already mapped it
  if (!prevCloseMapRef.current.has(latest.t)) {
    prevCloseMapRef.current.set(latest.t, +last.c);
  }
}
// --- END PATCH ---

  }, [latest]);

  return <div ref={containerRef} className="w-full h-full" />;
}
