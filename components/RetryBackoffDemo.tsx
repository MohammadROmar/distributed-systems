'use client';

import { useState, useRef, useCallback } from 'react';

/* ─── Types ──────────────────────────────────────────────── */
type AttemptStatus = 'running' | 'failed' | 'success';

interface AttemptRecord {
  id: number;
  status: AttemptStatus;
  delayBefore: number; // ms — backoff delay before this attempt
  jitter: number; // ms — random jitter added on top
}

/* ─── Constants ──────────────────────────────────────────── */
const BASE_DELAY_MS = 1200; // 1.2 s base; doubles each retry
const MAX_RETRIES = 4; // total attempts: 1 original + 3 retries
const NETWORK_RTT = 900; // simulated round-trip time

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

/* ─── Component ──────────────────────────────────────────── */
export function RetryBackoffDemo() {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [running, setRunning] = useState(false);
  const [failRate, setFailRate] = useState(75);
  const [withJitter, setWithJitter] = useState(true);
  const [finalResult, setFinalResult] = useState<
    'success' | 'exhausted' | null
  >(null);
  const [countdown, setCountdown] = useState<{
    ms: number;
    total: number;
  } | null>(null);

  // "packet" travelling the wire
  const [packetPhase, setPacketPhase] = useState<
    'idle' | 'traveling' | 'success' | 'failed'
  >('idle');

  const cancelRef = useRef(false);

  /* ── main simulation ── */
  const triggerRequest = useCallback(async () => {
    cancelRef.current = false;
    setAttempts([]);
    setFinalResult(null);
    setRunning(true);
    setPacketPhase('idle');

    for (let i = 0; i < MAX_RETRIES; i++) {
      if (cancelRef.current) break;

      // Exponential backoff: delay = base * 2^(attempt-1), 0 on first attempt
      const rawDelay = i === 0 ? 0 : BASE_DELAY_MS * Math.pow(2, i - 1);
      const jitter = withJitter && i > 0 ? Math.floor(Math.random() * 400) : 0;
      const total = rawDelay + jitter;

      /* ─ countdown phase ─ */
      if (total > 0) {
        const STEP = 50;
        let remaining = total;
        while (remaining > 0 && !cancelRef.current) {
          setCountdown({ ms: remaining, total });
          await sleep(STEP);
          remaining -= STEP;
        }
        setCountdown(null);
      }
      if (cancelRef.current) break;

      /* ─ packet travels to server ─ */
      setPacketPhase('traveling');
      await sleep(NETWORK_RTT);
      if (cancelRef.current) break;

      /* ─ server responds ─ */
      const success = Math.random() * 100 >= failRate;

      setPacketPhase(success ? 'success' : 'failed');
      setAttempts((prev) => [
        ...prev,
        {
          id: i + 1,
          status: success ? 'success' : 'failed',
          delayBefore: rawDelay,
          jitter,
        },
      ]);

      await sleep(600);
      setPacketPhase('idle');

      if (success) {
        setFinalResult('success');
        setRunning(false);
        return;
      }
    }

    if (!cancelRef.current) setFinalResult('exhausted');
    setRunning(false);
  }, [failRate, withJitter]);

  const reset = () => {
    cancelRef.current = true;
    setAttempts([]);
    setFinalResult(null);
    setRunning(false);
    setCountdown(null);
    setPacketPhase('idle');
  };

  /* ─ packet colour ─ */
  const packetColor =
    packetPhase === 'success'
      ? '#22C55E'
      : packetPhase === 'failed'
      ? '#EF4444'
      : '#F97316';

  const countdownPct = countdown
    ? ((countdown.total - countdown.ms) / countdown.total) * 100
    : 0;

  return (
    <section
      id="retry"
      className="relative min-h-screen flex flex-col justify-center px-6 py-28 max-w-5xl mx-auto"
    >
      {/* Accent glow */}
      <div className="absolute -left-40 top-1/2 w-80 h-80 bg-orange-500/6 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Section header ── */}
      <div className="flex items-start gap-6 mb-12">
        <span className="font-code text-8xl font-bold text-orange-500 leading-none select-none">
          01
        </span>
        <div>
          <p className="font-code text-xs text-orange-500 tracking-widest uppercase mb-2">
            Fault Tolerance Pattern
          </p>
          <h2 className="font-heading text-4xl font-bold text-white">
            Retry + Backoff
          </h2>
          <p className="font-code text-sm text-white/40 mt-2 max-w-lg leading-relaxed">
            When a request fails, retry it — but wait a bit longer each time to
            avoid hammering a struggling service. Random{' '}
            <em className="text-orange-400/70 not-italic">jitter</em> prevents
            all retrying clients from hitting at the same moment.
          </p>
        </div>
      </div>

      {/* ── Demo card ── */}
      <div className="rounded-2xl border border-white/[0.07] bg-surface relative overflow-hidden">
        {/* Top accent line */}
        <div className="h-px w-full bg-linear-to-r from-transparent via-orange-500/60 to-transparent" />

        <div className="p-8 space-y-8">
          {/* ── Network visualisation ── */}
          <div className="flex items-center gap-4">
            {/* Client box */}
            <div
              className={`shrink-0 w-24 h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
                packetPhase === 'failed'
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-orange-500/30 bg-orange-500/5'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="font-code text-[11px] text-orange-400">
                CLIENT
              </span>
            </div>

            {/* Connection line + packet */}
            <div className="flex-1 relative h-10 flex items-center">
              {/* Track */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />

              {/* Countdown overlay */}
              {countdown && (
                <>
                  {/* Filled portion */}
                  <div
                    className="absolute top-1/2 h-px bg-orange-500/30 left-0 transition-none"
                    style={{ width: `${countdownPct}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="font-code text-xs text-orange-400 bg-[#04060D] px-2 py-0.5 rounded border border-orange-500/20">
                      backoff {(countdown.ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                </>
              )}

              {/* Packet dot */}
              {packetPhase !== 'idle' && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
                  style={{
                    left:
                      packetPhase === 'traveling' || packetPhase === 'success'
                        ? 'calc(100% - 16px)'
                        : '0px',
                    backgroundColor: packetColor,
                    boxShadow: `0 0 14px ${packetColor}`,
                    transition: 'left 0.85s ease, background-color 0.2s',
                  }}
                />
              )}

              {/* Flow dots when idle */}
              {packetPhase === 'idle' && !countdown && (
                <div className="absolute inset-x-0 top-1/2 h-px overflow-hidden">
                  <div className="absolute top-0 h-px w-24 bg-linear-to-r from-transparent via-white/20 to-transparent animate-flow" />
                </div>
              )}
            </div>

            {/* Server box */}
            <div
              className={`shrink-0 w-24 h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
                packetPhase === 'success'
                  ? 'border-green-500/50 bg-green-500/10'
                  : packetPhase === 'failed'
                  ? 'border-red-500/40 bg-red-500/10'
                  : 'border-white/10 bg-white/2'
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full transition-colors duration-200"
                style={{
                  backgroundColor:
                    packetPhase === 'success'
                      ? '#22C55E'
                      : packetPhase === 'failed'
                      ? '#EF4444'
                      : '#475569',
                }}
              />
              <span className="font-code text-[11px] text-white/40">
                SERVER
              </span>
            </div>
          </div>

          {/* ── Attempt timeline ── */}
          <div className="space-y-2 min-h-30">
            <p className="font-code text-[10px] text-white/25 uppercase tracking-widest">
              Attempt Log
            </p>

            {attempts.length === 0 && !running && (
              <p className="font-code text-sm text-white/20 italic pt-2">
                Press &quot;Trigger Request&quot; to begin
              </p>
            )}

            {attempts.map((a) => (
              <div key={a.id} className="animate-slide-up">
                {/* Backoff label between attempts */}
                {a.delayBefore > 0 && (
                  <div className="flex items-center gap-2 ml-3 mb-1.5">
                    <div className="w-px h-5 bg-orange-500/20 ml-0.75" />
                    <span className="font-code text-[11px] text-orange-400/50">
                      ↳ backoff {(a.delayBefore / 1000).toFixed(1)}s
                      {a.jitter > 0 && (
                        <span className="text-orange-400/30">
                          {' '}
                          + {a.jitter}ms jitter
                        </span>
                      )}
                    </span>
                  </div>
                )}
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border font-code text-sm ${
                    a.status === 'success'
                      ? 'border-green-500/25 bg-green-500/5 text-green-400'
                      : 'border-red-500/20 bg-red-500/5 text-red-400'
                  }`}
                >
                  <span className="text-base">
                    {a.status === 'success' ? '✓' : '✗'}
                  </span>
                  <span>Attempt {a.id}</span>
                  <span className="ml-auto text-xs opacity-60">
                    {a.status === 'success' ? '200 OK' : '503 Error'}
                  </span>
                </div>
              </div>
            ))}

            {finalResult && (
              <div
                className={`animate-fade-in font-code text-sm px-4 py-3 rounded-xl border mt-2 ${
                  finalResult === 'success'
                    ? 'border-green-500/35 bg-green-500/8 text-green-300'
                    : 'border-red-500/35 bg-red-500/8 text-red-300'
                }`}
              >
                {finalResult === 'success'
                  ? '✓ Request succeeded'
                  : `✗ All ${MAX_RETRIES} attempts exhausted — giving up`}
              </div>
            )}
          </div>

          {/* ── Controls ── */}
          <div className="border-t border-white/6 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-code text-xs text-white/40">
                  Failure Rate
                </label>
                <span className="font-code text-xs text-orange-400">
                  {failRate}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={failRate}
                onChange={(e) => setFailRate(Number(e.target.value))}
                disabled={running}
                className="w-full accent-orange-500 cursor-pointer disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="font-code text-xs text-white/40">Jitter</span>
              <button
                onClick={() => setWithJitter((j) => !j)}
                disabled={running}
                className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${
                  withJitter ? 'bg-orange-500' : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    withJitter ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
              <span className="font-code text-xs text-white/30">
                {withJitter ? 'ON — prevents thundering herd' : 'OFF'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={triggerRequest}
              disabled={running}
              className="flex-1 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-heading font-bold text-white text-sm transition-colors cursor-pointer"
            >
              {running ? 'Retrying…' : 'Trigger Request'}
            </button>
            <button
              onClick={reset}
              className="px-6 py-3.5 rounded-xl border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 font-heading font-bold text-sm transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
