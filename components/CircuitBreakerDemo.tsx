'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ─── Types ──────────────────────────────────────────────── */
type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface LogEntry {
  id: number;
  time: string;
  type: 'pass' | 'fail' | 'blocked' | 'state';
  message: string;
}

/* ─── Constants ──────────────────────────────────────────── */
const FAILURE_THRESHOLD = 3; // failures before opening
const RECOVERY_TIMEOUT = 6000; // ms before probing again
const NETWORK_RTT = 700; // simulated request time

let logId = 0;
function now() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}
function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

/* ─── Component ──────────────────────────────────────────── */
export function CircuitBreakerDemo() {
  const [cbState, setCbState] = useState<CBState>('CLOSED');
  const [failureCount, setFailureCount] = useState(0);
  const [serviceUp, setServiceUp] = useState(true); // user toggle: is service healthy?
  const [log, setLog] = useState<LogEntry[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [cooldown, setCooldown] = useState(0); // ms remaining until HALF_OPEN
  const [probeUsed, setProbeUsed] = useState(false); // HALF_OPEN: probe already sent?

  const stateRef = useRef<CBState>('CLOSED');
  const failureCountRef = useRef(0);
  const probeUsedRef = useRef(false);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Keep refs in sync */
  useEffect(() => {
    stateRef.current = cbState;
  }, [cbState]);
  useEffect(() => {
    failureCountRef.current = failureCount;
  }, [failureCount]);
  useEffect(() => {
    probeUsedRef.current = probeUsed;
  }, [probeUsed]);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLog((prev) =>
      [{ id: ++logId, time: now(), type, message }, ...prev].slice(0, 30),
    );
  }, []);

  /* ── Open the circuit ── */
  const openCircuit = useCallback(() => {
    setCbState('OPEN');
    stateRef.current = 'OPEN';
    setFailureCount(0);
    failureCountRef.current = 0;
    addLog('state', 'Circuit tripped → OPEN — all requests blocked');

    let remaining = RECOVERY_TIMEOUT;
    setCooldown(remaining);

    cooldownTimer.current && clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      remaining -= 100;
      setCooldown(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(cooldownTimer.current!);
        setCbState('HALF_OPEN');
        stateRef.current = 'HALF_OPEN';
        setProbeUsed(false);
        probeUsedRef.current = false;
        addLog('state', 'Cooldown elapsed → HALF_OPEN — one probe allowed');
      }
    }, 100);
  }, [addLog]);

  /* ── Close the circuit ── */
  const closeCircuit = useCallback(() => {
    setCbState('CLOSED');
    stateRef.current = 'CLOSED';
    setFailureCount(0);
    failureCountRef.current = 0;
    setProbeUsed(false);
    addLog('state', 'Probe succeeded → CLOSED — normal operation resumed');
  }, [addLog]);

  /* ── Send a request ── */
  const sendRequest = useCallback(async () => {
    if (requesting) return;

    const state = stateRef.current;

    /* ── OPEN: fail immediately, no network call ── */
    if (state === 'OPEN') {
      addLog(
        'blocked',
        'Request blocked — circuit is OPEN (fail-fast, service not called)',
      );
      return;
    }

    /* ── HALF_OPEN: only one probe allowed ── */
    if (state === 'HALF_OPEN' && probeUsedRef.current) {
      addLog('blocked', 'Request blocked — waiting for probe result');
      return;
    }

    if (state === 'HALF_OPEN') {
      setProbeUsed(true);
      probeUsedRef.current = true;
      addLog('state', 'Sending probe request through half-open circuit…');
    }

    setRequesting(true);
    await sleep(NETWORK_RTT);

    const success = serviceUp;

    if (success) {
      addLog(
        'pass',
        `Request succeeded${
          state === 'HALF_OPEN' ? ' (probe)' : ''
        } — service is healthy`,
      );

      if (state === 'HALF_OPEN') {
        /* Successful probe → close */
        closeCircuit();
      } else {
        /* CLOSED + success → reset failure count */
        setFailureCount(0);
        failureCountRef.current = 0;
      }
    } else {
      const newCount =
        state === 'HALF_OPEN' ? FAILURE_THRESHOLD : failureCountRef.current + 1;

      if (state === 'HALF_OPEN') {
        addLog('fail', 'Probe failed — service still unhealthy');
        openCircuit();
      } else {
        setFailureCount(newCount);
        failureCountRef.current = newCount;
        addLog(
          'fail',
          `Request failed — failure ${newCount}/${FAILURE_THRESHOLD}`,
        );

        if (newCount >= FAILURE_THRESHOLD) {
          openCircuit();
        }
      }
    }

    setRequesting(false);
  }, [requesting, serviceUp, addLog, openCircuit, closeCircuit]);

  useEffect(
    () => () => {
      cooldownTimer.current && clearInterval(cooldownTimer.current);
    },
    [],
  );

  /* ─ derived style helpers ─ */
  const stateColor =
    cbState === 'CLOSED'
      ? {
          text: 'text-green-400',
          border: 'border-green-500/40',
          bg: 'bg-green-500/8',
        }
      : cbState === 'OPEN'
      ? {
          text: 'text-red-400',
          border: 'border-red-500/40',
          bg: 'bg-red-500/8',
        }
      : {
          text: 'text-yellow-400',
          border: 'border-yellow-500/40',
          bg: 'bg-yellow-500/8',
        };

  const gateDot =
    cbState === 'CLOSED'
      ? 'bg-green-500'
      : cbState === 'OPEN'
      ? 'bg-red-500'
      : 'bg-yellow-400';

  const requestFlows =
    cbState === 'CLOSED' || (cbState === 'HALF_OPEN' && !probeUsed);

  return (
    <section
      id="circuit"
      className="relative min-h-screen flex flex-col justify-center px-6 py-28 max-w-5xl mx-auto"
    >
      <div className="absolute -right-40 top-1/2 w-80 h-80 bg-red-500/6 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Section header ── */}
      <div className="flex items-start gap-6 mb-12">
        <span className="font-code text-8xl font-bold text-red-500 leading-none select-none">
          02
        </span>
        <div>
          <p className="font-code text-xs text-red-400 tracking-widest uppercase mb-2">
            Fault Tolerance Pattern
          </p>
          <h2 className="font-heading text-4xl font-bold text-white">
            Circuit Breaker
          </h2>
          <p className="font-code text-sm text-white/40 mt-2 max-w-lg leading-relaxed">
            Stops calling a failing service entirely —{' '}
            <em className="text-red-400/70 not-italic">fail fast</em> instead of
            piling up slow timeouts. After a cooldown, it probes once to check
            recovery. Three states:{' '}
            <span className="text-green-400">CLOSED</span>,{' '}
            <span className="text-red-400">OPEN</span>,{' '}
            <span className="text-yellow-400">HALF-OPEN</span>.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-surface relative overflow-hidden">
        <div className="h-px w-full bg-linear-to-r from-transparent via-red-500/60 to-transparent" />

        <div className="p-8 space-y-8">
          {/* ── State indicator row ── */}
          <div className="flex flex-wrap items-center gap-4">
            {(['CLOSED', 'OPEN', 'HALF_OPEN'] as CBState[]).map((s) => (
              <div
                key={s}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border font-code text-sm transition-all ${
                  cbState === s
                    ? s === 'CLOSED'
                      ? 'border-green-500/50  bg-green-500/10  text-green-300'
                      : s === 'OPEN'
                      ? 'border-red-500/50    bg-red-500/10    text-red-300'
                      : 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300'
                    : 'border-white/8 bg-transparent text-white/25'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    cbState === s
                      ? s === 'CLOSED'
                        ? 'bg-green-400'
                        : s === 'OPEN'
                        ? 'bg-red-400'
                        : 'bg-yellow-400'
                      : 'bg-white/15'
                  }`}
                />
                {s.replace('_', '-')}
                {cbState === s && (
                  <span className="ml-1 text-[10px] opacity-60">← now</span>
                )}
              </div>
            ))}

            {/* Cooldown timer */}
            {cbState === 'OPEN' && (
              <span className="font-code text-xs text-white/30 ml-auto">
                probe in {(cooldown / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {/* ── Architecture diagram ── */}
          <div className="flex items-stretch gap-3">
            {/* Request source */}
            <div className="shrink-0 w-24 flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/2 py-4">
              <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
              <span className="font-code text-[11px] text-white/30">
                REQUEST
              </span>
            </div>

            {/* Arrow + gate */}
            <div className="flex-1 flex items-center gap-3">
              {/* Line to gate */}
              <div className="flex-1 relative h-1 overflow-hidden rounded">
                <div className="absolute inset-0 bg-white/8 rounded" />
                {requestFlows && (
                  <div className="absolute inset-y-0 w-1/2 bg-linear-to-r from-transparent via-white/30 to-transparent animate-flow rounded" />
                )}
              </div>

              {/* Gate */}
              <div
                className={`relative shrink-0 w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-500 ${
                  cbState === 'CLOSED'
                    ? 'border-green-500/60  bg-green-500/8   shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                    : cbState === 'OPEN'
                    ? 'border-red-500/60    bg-red-500/8     shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                    : 'border-yellow-500/60 bg-yellow-500/8  shadow-[0_0_20px_rgba(234,179,8,0.15)]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${gateDot}`} />
                <span className={`font-code text-[10px] ${stateColor.text}`}>
                  {cbState === 'CLOSED'
                    ? 'CLOSED'
                    : cbState === 'OPEN'
                    ? 'OPEN'
                    : '½-OPEN'}
                </span>
              </div>

              {/* Line from gate → service */}
              <div className="flex-1 relative h-1 overflow-hidden rounded">
                <div className="absolute inset-0 bg-white/8 rounded" />
                {requestFlows && (
                  <div className="absolute inset-y-0 w-1/2 bg-linear-to-r from-transparent via-white/30 to-transparent animate-flow rounded" />
                )}
                {cbState === 'OPEN' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-red-400 text-[10px] font-code z-10 bg-[#04060D] px-1">
                      ✗
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Service box */}
            <div
              className={`shrink-0 w-24 flex flex-col items-center justify-center gap-1 rounded-xl border py-4 transition-all duration-300 ${
                serviceUp
                  ? 'border-white/10 bg-white/2'
                  : 'border-red-500/30 bg-red-500/5'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  serviceUp ? 'bg-white/30' : 'bg-red-500'
                }`}
              />
              <span className="font-code text-[11px] text-white/30">
                SERVICE
              </span>
              <span
                className={`font-code text-[9px] ${
                  serviceUp ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {serviceUp ? 'HEALTHY' : 'DOWN'}
              </span>
            </div>
          </div>

          {/* ── Failure counter ── */}
          {cbState === 'CLOSED' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-code text-xs text-white/40">
                  Failure count
                </span>
                <span className="font-code text-xs text-white/50">
                  {failureCount} / {FAILURE_THRESHOLD}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(failureCount / FAILURE_THRESHOLD) * 100}%`,
                    backgroundColor:
                      failureCount === 0
                        ? '#22C55E'
                        : failureCount === 1
                        ? '#EAB308'
                        : '#EF4444',
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Controls ── */}
          <div className="flex flex-wrap items-center gap-4 border-t border-white/6 pt-6">
            <div className="flex items-center gap-3">
              <span className="font-code text-xs text-white/40">Service</span>
              <button
                onClick={() => setServiceUp((u) => !u)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  serviceUp ? 'bg-green-500' : 'bg-red-500/70'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    serviceUp ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
              <span className="font-code text-xs text-white/30">
                {serviceUp
                  ? 'Healthy — requests succeed'
                  : 'Down — requests fail'}
              </span>
            </div>

            <button
              onClick={sendRequest}
              disabled={requesting}
              className={`ml-auto px-6 py-3 rounded-xl font-heading font-bold text-sm transition-all cursor-pointer disabled:opacity-50 ${
                cbState === 'OPEN'
                  ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                  : 'bg-white/8 border border-white/15 text-white/80 hover:bg-white/12'
              }`}
            >
              {requesting ? 'Requesting…' : 'Send Request'}
            </button>
          </div>

          {/* ── Event log ── */}
          <div className="space-y-1.5">
            <p className="font-code text-[10px] text-white/25 uppercase tracking-widest mb-3">
              Event Log
            </p>
            {log.length === 0 && (
              <p className="font-code text-sm text-white/20 italic">
                No events yet
              </p>
            )}
            {log.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-start gap-3 font-code text-xs animate-slide-up px-3 py-2 rounded-lg border ${
                  entry.type === 'pass'
                    ? 'border-green-500/15  bg-green-500/5  text-green-400'
                    : entry.type === 'fail'
                    ? 'border-red-500/15    bg-red-500/5    text-red-400'
                    : entry.type === 'blocked'
                    ? 'border-orange-500/15 bg-orange-500/5 text-orange-400'
                    : 'border-yellow-500/15  bg-yellow-500/5 text-yellow-300'
                }`}
              >
                <span className="text-white/25 shrink-0">{entry.time}</span>
                <span className="shrink-0">
                  {entry.type === 'pass'
                    ? '✓'
                    : entry.type === 'state'
                    ? '◆'
                    : '✗'}
                </span>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
