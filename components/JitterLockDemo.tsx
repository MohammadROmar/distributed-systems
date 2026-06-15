'use client';

import { useState, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ClientStatus =
  | 'IDLE'
  | 'OPTIMISTIC' // UI updated, request in-flight — LOCKED
  | 'CONFIRMING' // server accepted — brief success flash
  | 'ROLLING_BACK' // server rejected — reverting UI
  | 'RETRYING' // waiting out jitter delay before next attempt
  | 'CONFLICT'; // got 409 — syncing to server truth

interface LogEntry {
  id: number;
  time: string;
  type:
    | 'lock'
    | 'optimistic'
    | 'confirm'
    | 'rollback'
    | 'jitter'
    | 'conflict'
    | 'sync';
  client: 'A' | 'B' | 'SRV';
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SERVER_LATENCY_MS = 1500; // simulated network round-trip
const BASE_JITTER_MS = 600; // base for exponential backoff
const MAX_RETRIES = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────
let logId = 0;
const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Full jitter: delay = random(0, base * 2^attempt)
// This is the correct algorithm — NOT just adding a small fixed value.
// Spreading retries randomly across the window prevents thundering herd.
function fullJitter(attempt: number): number {
  const window = BASE_JITTER_MS * Math.pow(2, attempt);
  return Math.max(300, Math.floor(Math.random() * window));
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function JitterLockDemo() {
  // ── Shared server (single source of truth) ────────────────────────────────
  // srvRef  → used inside async functions (always current, no stale closures)
  // srvXxx  → state copies used only for rendering
  const srvRef = useRef({ value: 38, version: 0 });
  const srvBusyCount = useRef(0); // tracks concurrent in-flight requests

  const [srvValue, setSrvValue] = useState(38);
  const [srvVersion, setSrvVersion] = useState(0);
  const [srvBusy, setSrvBusy] = useState(false);

  // ── Event log ─────────────────────────────────────────────────────────────
  const [log, setLog] = useState<LogEntry[]>([]);
  const addLog = useCallback(
    (type: LogEntry['type'], client: LogEntry['client'], message: string) =>
      setLog((p) =>
        [{ id: ++logId, time: ts(), type, client, message }, ...p].slice(0, 60),
      ),
    [],
  );

  // ── Failure rate ──────────────────────────────────────────────────────────
  const [failRate, setFailRate] = useState(40);
  const failRateRef = useRef(40);
  const handleFailRate = (v: number) => {
    setFailRate(v);
    failRateRef.current = v;
  };

  // ── Client A ──────────────────────────────────────────────────────────────
  const [aDisplay, setADisplay] = useState(38);
  const [aInput, setAInput] = useState(42);
  const [aStatus, setAStatus] = useState<ClientStatus>('IDLE');
  const [aLocked, setALocked] = useState(false);
  const [aCountdown, setACountdown] = useState<number | null>(null);
  const aLockRef = useRef(false); // real lock for async logic
  const aCancelRef = useRef(false); // set true by Reset to abort in-flight ops

  // ── Client B ──────────────────────────────────────────────────────────────
  const [bDisplay, setBDisplay] = useState(38);
  const [bInput, setBInput] = useState(45);
  const [bStatus, setBStatus] = useState<ClientStatus>('IDLE');
  const [bLocked, setBLocked] = useState(false);
  const [bCountdown, setBCountdown] = useState<number | null>(null);
  const bLockRef = useRef(false);
  const bCancelRef = useRef(false);

  // ── Simulated server request ───────────────────────────────────────────────
  // clientVersion = the version the client saw at submission time.
  // If the server's version has changed since then → 409 Conflict.
  const serverRequest = useCallback(
    async (
      newValue: number,
      clientVersion: number,
    ): Promise<'accepted' | 'rejected' | 'conflict'> => {
      // Track concurrent requests for the busy indicator
      srvBusyCount.current++;
      setSrvBusy(true);

      await sleep(SERVER_LATENCY_MS + Math.random() * 400); // variable latency

      srvBusyCount.current--;
      if (srvBusyCount.current === 0) setSrvBusy(false);

      // Version mismatch → someone else committed first
      if (clientVersion !== srvRef.current.version) return 'conflict';

      // Random rejection (network error, server overload, etc.)
      if (Math.random() * 100 < failRateRef.current) return 'rejected';

      // Accept: update server state
      srvRef.current.value = newValue;
      srvRef.current.version += 1;
      setSrvValue(newValue);
      setSrvVersion((v) => v + 1);
      return 'accepted';
    },
    [],
  );

  // ── Core submit flow ───────────────────────────────────────────────────────
  const runSubmit = useCallback(
    async (
      client: 'A' | 'B',
      value: number,
      attempt: number,
      prevValue: number, // server's last confirmed value — for rollback
      capturedVersion: number, // version at submission time — for conflict detection
    ): Promise<void> => {
      const isA = client === 'A';
      const cancelRef = isA ? aCancelRef : bCancelRef;
      const lockRef = isA ? aLockRef : bLockRef;
      const setDisplay = isA ? setADisplay : setBDisplay;
      const setStatus = isA ? setAStatus : setBStatus;
      const setLocked = isA ? setALocked : setBLocked;
      const setCdown = isA ? setACountdown : setBCountdown;

      if (cancelRef.current) return;

      // ── Step 1: Optimistic update ────────────────────────────────────────
      // Show the new value in the UI BEFORE the server confirms.
      // The user sees an immediate response — this is Network Optimistic UI.
      setDisplay(value);
      setStatus('OPTIMISTIC');
      if (attempt === 0) {
        addLog(
          'optimistic',
          client,
          `Optimistic update → ${value}  (server still at ${prevValue}, awaiting confirmation…)`,
        );
      } else {
        addLog(
          'optimistic',
          client,
          `Retry ${attempt}/${MAX_RETRIES}: re-applying optimistic update → ${value}`,
        );
      }

      const result = await serverRequest(value, capturedVersion);
      if (cancelRef.current) return;

      // ── Step 2a: Accepted ────────────────────────────────────────────────
      if (result === 'accepted') {
        setStatus('CONFIRMING');
        addLog(
          'confirm',
          client,
          `✓ Server accepted → ${value}  (version now ${srvRef.current.version})`,
        );
        await sleep(700);
        if (cancelRef.current) return;
        setStatus('IDLE');
        setLocked(false);
        lockRef.current = false;
        return;
      }

      // ── Step 2b: Conflict (409) ──────────────────────────────────────────
      // Another client committed a different value while this request was in-flight.
      // DO NOT rollback to our own prevValue — sync to the SERVER's current truth.
      if (result === 'conflict') {
        const serverTruth = srvRef.current.value;
        setDisplay(serverTruth);
        setStatus('CONFLICT');
        const winner = client === 'A' ? 'B' : 'A';
        addLog(
          'conflict',
          client,
          `409 Conflict — Client ${winner} committed first (server now at ${serverTruth})`,
        );
        addLog(
          'sync',
          client,
          `State synchronized to server truth → ${serverTruth}  (your change was discarded)`,
        );
        await sleep(800);
        if (cancelRef.current) return;
        setStatus('IDLE');
        setLocked(false);
        lockRef.current = false;
        return;
      }

      // ── Step 2c: Rejected — rollback + jitter retry ───────────────────────
      // Server rejected us (random failure). Roll back the optimistic update.
      setDisplay(prevValue);
      setStatus('ROLLING_BACK');
      addLog(
        'rollback',
        client,
        `Server rejected. Rolling UI back → ${prevValue}`,
      );
      await sleep(400);
      if (cancelRef.current) return;

      if (attempt >= MAX_RETRIES) {
        setStatus('IDLE');
        setLocked(false);
        lockRef.current = false;
        addLog(
          'rollback',
          client,
          `Max retries (${MAX_RETRIES}) reached. Giving up.`,
        );
        return;
      }

      // Calculate full jitter delay and show countdown
      const delay = fullJitter(attempt + 1);
      setStatus('RETRYING');
      addLog(
        'jitter',
        client,
        `Backoff: attempt ${
          attempt + 1
        }/${MAX_RETRIES} — waiting ${delay}ms  ` +
          `(full jitter: random between 0 and ${
            BASE_JITTER_MS * Math.pow(2, attempt + 1)
          }ms)`,
      );

      let remaining = delay;
      while (remaining > 0 && !cancelRef.current) {
        setCdown(remaining);
        await sleep(50);
        remaining -= 50;
      }
      setCdown(null);
      if (cancelRef.current) return;

      // Re-capture version before retry in case server changed during the wait
      const newVersion = srvRef.current.version;

      await runSubmit(client, value, attempt + 1, prevValue, newVersion);
    },
    [serverRequest, addLog],
  );

  // ── Entry point: lock check + kick off runSubmit ──────────────────────────
  const handleSubmit = useCallback(
    async (client: 'A' | 'B') => {
      const isA = client === 'A';
      const lockRef = isA ? aLockRef : bLockRef;

      // ── Jitter Lock Shield ───────────────────────────────────────────────
      // If a request is already in-flight for this client, block the duplicate.
      if (lockRef.current) {
        addLog(
          'lock',
          client,
          `🔒 Duplicate blocked — request already in-flight`,
        );
        return;
      }

      // Acquire lock
      lockRef.current = true;
      (isA ? setALocked : setBLocked)(true);
      (isA ? aCancelRef : bCancelRef).current = false;

      const value = isA ? aInput : bInput;
      // prevValue = what the server actually has confirmed right now (for rollback target)
      const prev = srvRef.current.value;
      // capturedVersion = server version at submission time (for conflict detection)
      const version = srvRef.current.version;

      await runSubmit(client, value, 0, prev, version);
    },
    [aInput, bInput, addLog, runSubmit],
  );

  // ── Simulate conflict: both clients submit simultaneously ─────────────────
  // Both capture the same server version before either request resolves.
  // The first to resolve wins; the second gets a 409 Conflict.
  const simulateConflict = useCallback(() => {
    if (aLockRef.current || bLockRef.current) return;
    addLog(
      'conflict',
      'SRV',
      '⚡ Conflict simulation — both clients submitting simultaneously with version ' +
        srvRef.current.version,
    );
    handleSubmit('A');
    setTimeout(() => handleSubmit('B'), 60); // B arrives 60ms after A
  }, [handleSubmit, addLog]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    aCancelRef.current = true;
    bCancelRef.current = true;
    setTimeout(() => {
      aCancelRef.current = false;
      bCancelRef.current = false;
    }, 200);
    aLockRef.current = false;
    bLockRef.current = false;
    srvBusyCount.current = 0;
    srvRef.current = { value: 38, version: 0 };
    setADisplay(38);
    setAInput(42);
    setAStatus('IDLE');
    setALocked(false);
    setACountdown(null);
    setBDisplay(38);
    setBInput(45);
    setBStatus('IDLE');
    setBLocked(false);
    setBCountdown(null);
    setSrvValue(38);
    setSrvVersion(0);
    setSrvBusy(false);
    setLog([]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <section
      id="jitter"
      className="relative min-h-screen flex flex-col justify-center px-6 py-28 max-w-5xl mx-auto"
    >
      <div className="absolute -left-40 top-1/3 w-80 h-80 bg-violet-500/6 rounded-full blur-[100px] pointer-events-none" />

      {/* Section header */}
      <div className="flex items-start flex-col sm:flex-row gap-6 mb-12">
        <span className="font-code text-8xl font-bold text-violet-400 leading-none select-none">
          05
        </span>
        <div>
          <p className="font-code text-xs text-violet-400 tracking-widest uppercase mb-2">
            Fault Tolerance Pattern
          </p>
          <h2 className="font-heading text-4xl font-bold text-white">
            Jittered Backoff &amp; Lock Shield
          </h2>
          <p className="font-code text-sm text-white/40 mt-2 max-w-xl leading-relaxed">
            UI updates optimistically before the server confirms. A per-client
            lock blocks duplicate in-flight requests. Rejections trigger
            exponential backoff with full jitter. Concurrent updates cause a
            version conflict — the loser syncs to server truth.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-surface relative overflow-hidden">
        <div className="h-px w-full bg-linear-to-r from-transparent via-violet-400/60 to-transparent" />

        <div className="p-8 space-y-8">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="font-code text-xs text-white/30">
                Server failure rate
              </span>
              <input
                type="range"
                min={0}
                max={90}
                value={failRate}
                onChange={(e) => handleFailRate(Number(e.target.value))}
                className="w-28 accent-violet-400"
              />
              <span className="font-code text-xs text-violet-300 w-8">
                {failRate}%
              </span>
            </div>

            <button
              onClick={simulateConflict}
              disabled={aLocked || bLocked}
              className="px-4 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 font-code text-xs text-red-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ⚡ Simulate Conflict
            </button>

            <button
              onClick={reset}
              className="ml-auto px-4 py-1.5 rounded-lg border border-white/10 bg-white/3 hover:bg-white/6 font-code text-xs text-white/30 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* Three-panel layout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Client A */}
            <ClientPanel
              label="CLIENT A"
              color="violet"
              displayValue={aDisplay}
              inputValue={aInput}
              onInputChange={setAInput}
              status={aStatus}
              locked={aLocked}
              countdown={aCountdown}
              onSubmit={() => handleSubmit('A')}
            />

            {/* Server */}
            <div
              className={`rounded-xl border p-5 flex flex-col items-center justify-center gap-4 transition-all duration-300 ${
                srvBusy
                  ? 'border-amber-400/30 bg-amber-400/5'
                  : 'border-white/8 bg-white/2'
              }`}
            >
              <p className="font-code text-[10px] text-white/25 tracking-widest">
                SERVER
              </p>

              <div className="text-center">
                <p className="font-code text-5xl font-bold text-white">
                  {srvValue}
                </p>
                <p className="font-code text-[10px] text-white/20 mt-1">
                  version {srvVersion}
                </p>
              </div>

              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-code text-[10px] transition-all ${
                  srvBusy
                    ? 'border-amber-400/30 text-amber-300 bg-amber-400/5'
                    : 'border-emerald-400/20 text-emerald-400/60'
                }`}
              >
                {srvBusy ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    PROCESSING
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    READY
                  </>
                )}
              </div>

              <p className="font-code text-[9px] text-white/15 text-center leading-relaxed px-2">
                First-write-wins
                <br />
                version-based conflict detection
              </p>
            </div>

            {/* Client B */}
            <ClientPanel
              label="CLIENT B"
              color="cyan"
              displayValue={bDisplay}
              inputValue={bInput}
              onInputChange={setBInput}
              status={bStatus}
              locked={bLocked}
              countdown={bCountdown}
              onSubmit={() => handleSubmit('B')}
            />
          </div>

          {/* Event log */}
          <div className="space-y-1.5">
            <p className="font-code text-[10px] text-white/25 uppercase tracking-widest">
              Event Log
            </p>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {log.length === 0 && (
                <p className="font-code text-sm text-white/20 italic">
                  Submit a value or press ⚡ Simulate Conflict…
                </p>
              )}
              {log.map((e) => (
                <div
                  key={e.id}
                  className={`flex items-start gap-3 font-code text-xs px-3 py-2 rounded-lg border animate-slide-up ${
                    e.type === 'lock'
                      ? 'border-red-500/15     bg-red-500/5     text-red-400'
                      : e.type === 'optimistic'
                      ? 'border-blue-400/15    bg-blue-400/5    text-blue-300'
                      : e.type === 'confirm'
                      ? 'border-emerald-400/15 bg-emerald-400/5 text-emerald-300'
                      : e.type === 'rollback'
                      ? 'border-orange-500/15  bg-orange-500/5  text-orange-400'
                      : e.type === 'jitter'
                      ? 'border-amber-400/15   bg-amber-400/5   text-amber-300'
                      : e.type === 'conflict'
                      ? 'border-red-500/20     bg-red-500/8     text-red-300'
                      : e.type === 'sync'
                      ? 'border-violet-400/15  bg-violet-400/5  text-violet-300'
                      : 'border-white/6        bg-white/2  text-white/30'
                  }`}
                >
                  <span className="text-white/20 shrink-0 w-14">{e.time}</span>
                  <span
                    className={`shrink-0 font-code text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                      e.client === 'A'
                        ? 'border-violet-400/30 text-violet-300 bg-violet-400/8'
                        : e.client === 'B'
                        ? 'border-cyan-400/30   text-cyan-300   bg-cyan-400/8'
                        : 'border-white/15       text-white/30'
                    }`}
                  >
                    {e.client}
                  </span>
                  <span className="flex-1 leading-relaxed">{e.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Client Panel (sub-component) ────────────────────────────────────────────
interface ClientPanelProps {
  label: string;
  color: 'violet' | 'cyan';
  displayValue: number;
  inputValue: number;
  onInputChange: (v: number) => void;
  status: ClientStatus;
  locked: boolean;
  countdown: number | null;
  onSubmit: () => void;
}

function ClientPanel({
  label,
  color,
  displayValue,
  inputValue,
  onInputChange,
  status,
  locked,
  countdown,
  onSubmit,
}: ClientPanelProps) {
  const isViolet = color === 'violet';

  const containerClass =
    status === 'CONFLICT'
      ? 'border-red-500/30    bg-red-500/5'
      : status === 'CONFIRMING'
      ? 'border-emerald-400/25 bg-emerald-400/4'
      : status === 'OPTIMISTIC'
      ? 'border-blue-400/25   bg-blue-400/4'
      : status === 'ROLLING_BACK'
      ? 'border-orange-400/25 bg-orange-400/4'
      : status === 'RETRYING'
      ? 'border-amber-400/25  bg-amber-400/4'
      : isViolet
      ? 'border-violet-400/20 bg-violet-400/4'
      : 'border-cyan-400/20   bg-cyan-400/4';

  const badge = {
    IDLE: { cls: 'border-white/15        text-white/40', text: '● IDLE' },
    OPTIMISTIC: {
      cls: 'border-blue-400/40     text-blue-300',
      text: '◌ OPTIMISTIC',
    },
    CONFIRMING: {
      cls: 'border-emerald-400/40  text-emerald-300',
      text: '✓ CONFIRMED',
    },
    ROLLING_BACK: {
      cls: 'border-orange-400/40   text-orange-300',
      text: '↩ ROLLING BACK',
    },
    RETRYING: {
      cls: 'border-amber-400/40    text-amber-300',
      text: countdown
        ? `⟳ RETRY in ${(countdown / 1000).toFixed(1)}s`
        : '⟳ RETRYING',
    },
    CONFLICT: {
      cls: 'border-red-500/50      text-red-300',
      text: '✗ CONFLICT',
    },
  }[status];

  const valueColor =
    status === 'OPTIMISTIC' || status === 'RETRYING'
      ? 'text-blue-300'
      : status === 'CONFLICT'
      ? 'text-red-300'
      : status === 'CONFIRMING'
      ? 'text-emerald-300'
      : 'text-white';

  const btnClass = locked
    ? 'border-red-500/25 bg-red-500/5 text-red-400'
    : isViolet
    ? 'border-violet-400/25 bg-violet-400/5 hover:bg-violet-400/15 text-violet-300'
    : 'border-cyan-400/25   bg-cyan-400/5   hover:bg-cyan-400/15   text-cyan-300';

  const labelColor = isViolet ? 'text-violet-300' : 'text-cyan-300';

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-4 transition-all duration-300 ${containerClass}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className={`font-code text-[10px] tracking-widest ${labelColor}`}>
          {label}
        </p>
        <div
          className={`font-code text-[10px] px-2 py-0.5 rounded border ${badge.cls}`}
        >
          {badge.text}
        </div>
      </div>

      {/* Displayed value — shows optimistic update immediately */}
      <div className="text-center py-2">
        <div
          className={`font-code text-5xl font-bold transition-colors duration-300 ${valueColor}`}
        >
          {displayValue}
        </div>
        {(status === 'OPTIMISTIC' || status === 'RETRYING') && (
          <p className="font-code text-[10px] text-blue-400/60 mt-1">
            optimistic — awaiting server
          </p>
        )}
        {status === 'CONFLICT' && (
          <p className="font-code text-[10px] text-red-400/60 mt-1">
            synced to server truth
          </p>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2">
        <span className="font-code text-[10px] text-white/25 shrink-0">
          value
        </span>
        <input
          type="number"
          value={inputValue}
          onChange={(e) => onInputChange(Number(e.target.value))}
          disabled={locked}
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 font-code text-sm text-white/80 focus:outline-none focus:border-white/25 disabled:opacity-40"
        />
      </div>

      {/* Submit — becomes LOCKED while in-flight */}
      <button
        onClick={onSubmit}
        className={`w-full py-2 rounded-lg border font-code text-xs transition-all duration-200 cursor-pointer ${btnClass}`}
      >
        {locked ? '🔒 LOCKED — in-flight' : 'Submit'}
      </button>

      {/* Jitter countdown bar */}
      {status === 'RETRYING' && countdown !== null && (
        <div className="space-y-1">
          <div className="flex justify-between font-code text-[10px] text-amber-400/50">
            <span>full jitter backoff</span>
            <span>{(countdown / 1000).toFixed(2)}s</span>
          </div>
          <div className="h-1 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400/50 rounded-full transition-none"
              style={{
                width: `${Math.min(
                  100,
                  (countdown / (BASE_JITTER_MS * 4)) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
