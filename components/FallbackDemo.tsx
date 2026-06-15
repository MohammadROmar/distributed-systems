'use client';

import { useState, useCallback } from 'react';

/* ─── Mock response payloads ──────────────────────────────── */
interface WeatherResponse {
  city: string;
  temp: number;
  condition: string;
  humidity: number;
  source: string;
  cached: boolean;
  latency: string;
  age?: string;
}

const PRIMARY_DATA: WeatherResponse = {
  city: 'Berlin',
  temp: 22.4,
  condition: 'Partly cloudy',
  humidity: 61,
  source: 'weather-api.live',
  cached: false,
  latency: '14ms',
};

const FALLBACK_DATA: WeatherResponse = {
  city: 'Berlin',
  temp: 21.8,
  condition: 'Partly cloudy',
  humidity: 59,
  source: 'local-cache',
  cached: true,
  latency: '2ms',
  age: '7 min ago',
};

/* Small variance so live data "updates" */
function vary(data: WeatherResponse): WeatherResponse {
  return {
    ...data,
    temp: Math.round((data.temp + (Math.random() - 0.5) * 0.6) * 10) / 10,
    humidity: data.humidity + Math.floor((Math.random() - 0.5) * 4),
    latency: `${10 + Math.floor(Math.random() * 12)}ms`,
  };
}

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

let hid = 0;

/* ─── Component ──────────────────────────────────────────── */
export function FallbackDemo() {
  const [primaryOnline, setPrimaryOnline] = useState(true);
  const [response, setResponse] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<
    { id: number; source: 'primary' | 'fallback'; latency: string }[]
  >([]);

  const sendRequest = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    if (primaryOnline) {
      /* ── Happy path: primary succeeds ── */
      await sleep(600 + Math.random() * 200);
      const data = vary(PRIMARY_DATA);
      setResponse(data);
      setHistory((h) =>
        [
          { id: ++hid, source: 'primary' as const, latency: data.latency },
          ...h,
        ].slice(0, 10),
      );
    } else {
      /* ── Fallback path: primary is down, use cached data ── */
      /* The fallback is invoked AUTOMATICALLY — the caller never sees an error */
      await sleep(120); // cache hit is fast
      setResponse({
        ...FALLBACK_DATA,
        age: `${Math.floor(Math.random() * 10) + 2} min ago`,
      });
      setHistory((h) =>
        [
          { id: ++hid, source: 'fallback' as const, latency: '2ms' },
          ...h,
        ].slice(0, 10),
      );
    }

    setLoading(false);
  }, [loading, primaryOnline]);

  return (
    <section
      id="fallback"
      className="relative min-h-screen flex flex-col justify-center px-6 py-28 max-w-5xl mx-auto"
    >
      <div className="absolute -left-40 top-1/2 w-80 h-80 bg-blue-500/6 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Section header ── */}
      <div className="flex items-start flex-col sm:flex-row gap-6 mb-12">
        <span className="font-code text-8xl font-bold text-blue-400 leading-none select-none">
          03
        </span>
        <div>
          <p className="font-code text-xs text-blue-400 tracking-widest uppercase mb-2">
            Fault Tolerance Pattern
          </p>
          <h2 className="font-heading text-4xl font-bold text-white">
            Fallback
          </h2>
          <p className="font-code text-sm text-white/40 mt-2 max-w-lg leading-relaxed">
            When the primary service is unavailable, automatically serve an
            alternative — cached data, a default value, or a backup service — so
            the caller always gets a useful response instead of an error.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-surface relative overflow-hidden">
        <div className="h-px w-full bg-linear-to-r from-transparent via-blue-400/60 to-transparent" />

        <div className="p-8 space-y-8">
          {/* ── Service topology ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            {/* Requester */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-full max-w-35 rounded-xl border border-white/10 bg-white/2 p-4 flex flex-col items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-white/30" />
                <span className="font-code text-xs text-white/40">
                  YOUR APP
                </span>
                <span className="font-code text-[10px] text-white/20">
                  makes request
                </span>
              </div>
            </div>

            {/* Router + arrow */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 w-full justify-center">
                <div className="h-px flex-1 bg-linear-to-r from-white/10 to-blue-400/30" />
                <div className="px-3 py-1.5 rounded-lg border border-blue-400/30 bg-blue-400/5">
                  <span className="font-code text-[10px] text-blue-400">
                    ROUTER
                  </span>
                </div>
                <div className="h-px flex-1 bg-linear-to-l from-white/10 to-blue-400/30" />
              </div>
              <span className="font-code text-[10px] text-white/25">
                routes automatically
              </span>
            </div>

            {/* Services */}
            <div className="flex flex-col gap-3">
              {/* Primary */}
              <div
                className={`rounded-xl border p-3 transition-all duration-300 ${
                  primaryOnline
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-red-500/30 bg-red-500/5 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-code text-[11px] text-white/60">
                    PRIMARY
                  </span>
                  <div
                    className={`flex items-center gap-1.5 ${
                      primaryOnline ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        primaryOnline ? 'bg-green-400' : 'bg-red-500'
                      }`}
                    />
                    <span className="font-code text-[10px]">
                      {primaryOnline ? 'ONLINE' : 'DOWN'}
                    </span>
                  </div>
                </div>
                <span className="font-code text-[10px] text-white/25">
                  weather-api.live · live data
                </span>
              </div>

              {/* Fallback */}
              <div className="rounded-xl border border-blue-400/25 bg-blue-400/5 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-code text-[11px] text-white/60">
                    FALLBACK
                  </span>
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="font-code text-[10px]">ALWAYS UP</span>
                  </div>
                </div>
                <span className="font-code text-[10px] text-white/25">
                  local-cache · cached data
                </span>
              </div>
            </div>
          </div>

          {/* ── Response viewer ── */}
          <div className="rounded-xl border border-white/8 bg-surface-2 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
              <span className="font-code text-xs text-white/30">
                Last Response
              </span>
              {response && (
                <span
                  className={`ml-auto font-code text-[10px] px-2 py-0.5 rounded border ${
                    response.cached
                      ? 'border-blue-400/30 bg-blue-400/10 text-blue-300'
                      : 'border-green-500/30 bg-green-500/10 text-green-300'
                  }`}
                >
                  {response.cached ? '⚡ FROM CACHE' : '⬆ LIVE DATA'}
                </span>
              )}
            </div>

            <div className="p-5 font-code text-sm min-h-30 flex items-center">
              {loading ? (
                <span className="text-white/30 animate-pulse">Fetching…</span>
              ) : response ? (
                <div className="space-y-2 w-full animate-fade-in">
                  <div className="text-white/40 text-xs mb-3">{'{'}</div>
                  {[
                    ['city', `"${response.city}"`],
                    ['temp', `${response.temp}°C`],
                    ['condition', `"${response.condition}"`],
                    ['humidity', `${response.humidity}%`],
                    ['source', `"${response.source}"`],
                    ['cached', response.cached ? 'true' : 'false'],
                    ['latency', `"${response.latency}"`],
                    ...(response.age
                      ? [['age', `"${response.age}"`] as const]
                      : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 pl-4">
                      <span className="text-blue-300/70">&quot;{k}&quot;</span>
                      <span className="text-white/30">:</span>
                      <span
                        className={
                          k === 'source' && !response.cached
                            ? 'text-green-400'
                            : k === 'source' && response.cached
                            ? 'text-blue-400'
                            : k === 'cached' && response.cached
                            ? 'text-yellow-400'
                            : 'text-white/60'
                        }
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                  <div className="text-white/40 text-xs">{'}'}</div>
                </div>
              ) : (
                <span className="text-white/20 italic">
                  Press &quot;Send Request&quot; to see a response
                </span>
              )}
            </div>
          </div>

          {/* ── Request history dots ── */}
          {history.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-code text-[10px] text-white/25 uppercase tracking-widest">
                Request History
              </p>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    title={`${h.source} · ${h.latency}`}
                    className={`w-7 h-7 rounded-lg border font-code text-[9px] flex items-center justify-center transition-all animate-fade-in ${
                      h.source === 'primary'
                        ? 'border-green-500/30 bg-green-500/10 text-green-400'
                        : 'border-blue-400/30 bg-blue-400/10 text-blue-400'
                    }`}
                  >
                    {h.source === 'primary' ? 'P' : 'F'}
                  </div>
                ))}
              </div>
              <p className="font-code text-[10px] text-white/20">
                <span className="text-green-400">P</span> = primary &nbsp;
                <span className="text-blue-400">F</span> = fallback
              </p>
            </div>
          )}

          {/* ── Controls ── */}
          <div className="flex flex-wrap gap-3 border-t border-white/6 pt-6">
            <button
              onClick={() => setPrimaryOnline((u) => !u)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border font-heading font-bold text-sm transition-all cursor-pointer ${
                primaryOnline
                  ? 'border-red-500/30 bg-red-500/8 text-red-400 hover:bg-red-500/15'
                  : 'border-green-500/30 bg-green-500/8 text-green-400 hover:bg-green-500/15'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  primaryOnline ? 'bg-red-400' : 'bg-green-400'
                }`}
              />
              {primaryOnline ? 'Kill Primary' : 'Restore Primary'}
            </button>

            <button
              onClick={sendRequest}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed font-heading font-bold text-white text-sm transition-colors cursor-pointer"
            >
              {loading ? 'Fetching…' : 'Send Request'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
