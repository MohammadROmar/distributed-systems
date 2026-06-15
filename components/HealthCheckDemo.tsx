'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/* ─── Types ──────────────────────────────────────────────── */
type NodeStatus = 'HEALTHY' | 'DEAD' | 'STARTING' | 'VERIFYING';

interface ServiceNode {
  id: string;
  name: string;
  role: 'api' | 'db' | 'cache';
  status: NodeStatus;
  crashed: boolean;
  missedBeats: number;
  lastBeatMs: number;
  cpu: number;
  rtt: number;
  consecutiveChecks: number; // counts up during VERIFYING
  trafficWeight: number; // 0-100, ramps up during slow-start
  flaps: number; // how many times this node has died
}

interface LogEntry {
  id: number;
  time: string;
  type: 'beat' | 'missed' | 'down' | 'up' | 'check' | 'verify' | 'warn';
  message: string;
}

/* ─── Constants ──────────────────────────────────────────── */
const HEARTBEAT_INTERVAL = 2000;
const HEALTH_CHECK_EVERY = 3000;
const MAX_MISSED_BEATS = 2;
const STARTUP_DELAY = 3000;
const FLAP_EXTRA_DELAY = 5000; // extra penalty if node keeps dying
const VERIFY_THRESHOLD = 3; // consecutive passing checks before HEALTHY

/* ─── Initial nodes ─────────────────────────────────────── */
const INITIAL_NODES: ServiceNode[] = [
  {
    id: 'api-01',
    name: 'API-01',
    role: 'api',
    status: 'HEALTHY',
    crashed: false,
    missedBeats: 0,
    lastBeatMs: Date.now(),
    cpu: 34,
    rtt: 18,
    consecutiveChecks: 0,
    trafficWeight: 100,
    flaps: 0,
  },
  {
    id: 'api-02',
    name: 'API-02',
    role: 'api',
    status: 'HEALTHY',
    crashed: false,
    missedBeats: 0,
    lastBeatMs: Date.now(),
    cpu: 51,
    rtt: 24,
    consecutiveChecks: 0,
    trafficWeight: 100,
    flaps: 0,
  },
  {
    id: 'api-03',
    name: 'API-03',
    role: 'api',
    status: 'HEALTHY',
    crashed: false,
    missedBeats: 0,
    lastBeatMs: Date.now(),
    cpu: 28,
    rtt: 12,
    consecutiveChecks: 0,
    trafficWeight: 100,
    flaps: 0,
  },
  {
    id: 'db-01',
    name: 'DB-01',
    role: 'db',
    status: 'HEALTHY',
    crashed: false,
    missedBeats: 0,
    lastBeatMs: Date.now(),
    cpu: 19,
    rtt: 5,
    consecutiveChecks: 0,
    trafficWeight: 100,
    flaps: 0,
  },
  {
    id: 'db-02',
    name: 'DB-02',
    role: 'db',
    status: 'HEALTHY',
    crashed: false,
    missedBeats: 0,
    lastBeatMs: Date.now(),
    cpu: 22,
    rtt: 6,
    consecutiveChecks: 0,
    trafficWeight: 100,
    flaps: 0,
  },
  {
    id: 'cache-01',
    name: 'CACHE-01',
    role: 'cache',
    status: 'HEALTHY',
    crashed: false,
    missedBeats: 0,
    lastBeatMs: Date.now(),
    cpu: 8,
    rtt: 1,
    consecutiveChecks: 0,
    trafficWeight: 100,
    flaps: 0,
  },
];

let logId = 0;
function nowStr() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

/* ─── Component ──────────────────────────────────────────── */
export function HealthCheckDemo() {
  const [nodes, setNodes] = useState<ServiceNode[]>(INITIAL_NODES);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [nextCheckIn, setNextCheckIn] = useState(HEALTH_CHECK_EVERY);

  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const addLog = useCallback(
    (type: LogEntry['type'], message: string) =>
      setLog((prev) =>
        [{ id: ++logId, time: nowStr(), type, message }, ...prev].slice(0, 50),
      ),
    [],
  );

  /* ── Heartbeat: HEALTHY + VERIFYING non-crashed nodes send beats ── */
  useEffect(() => {
    const t = setInterval(() => {
      setNodes((prev) =>
        prev.map((n) => {
          if ((n.status !== 'HEALTHY' && n.status !== 'VERIFYING') || n.crashed)
            return n;
          return {
            ...n,
            lastBeatMs: Date.now(),
            cpu: Math.max(
              5,
              Math.min(95, n.cpu + Math.floor((Math.random() - 0.5) * 8)),
            ),
            rtt: Math.max(1, n.rtt + Math.floor((Math.random() - 0.5) * 4)),
          };
        }),
      );
    }, HEARTBEAT_INTERVAL);
    return () => clearInterval(t);
  }, []);

  /* ── Slow-start: ramp traffic weight 0 → 100 after verification ── */
  useEffect(() => {
    const t = setInterval(() => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.status !== 'HEALTHY' || n.trafficWeight >= 100) return n;
          const next = Math.min(100, n.trafficWeight + 10);
          if (next === 100)
            addLog('up', `${n.name} at full traffic — slow-start complete`);
          return { ...n, trafficWeight: next };
        }),
      );
    }, 600);
    return () => clearInterval(t);
  }, [addLog]);

  /* ── Health-check: orchestrator polls all nodes every 3s ── */
  useEffect(() => {
    const checkTimer = setInterval(() => {
      const now_ms = Date.now();
      const current = nodesRef.current;

      setNodes((prev) =>
        prev.map((n) => {
          if (n.status === 'STARTING' || n.status === 'DEAD') return n;

          const silentFor = now_ms - n.lastBeatMs;
          const beatMissed = silentFor > HEARTBEAT_INTERVAL * 1.5;

          /* ── VERIFYING: count consecutive passing checks ── */
          if (n.status === 'VERIFYING') {
            if (beatMissed) {
              addLog(
                'down',
                `${n.name} failed during verification → back to DEAD`,
              );
              return {
                ...n,
                status: 'DEAD',
                missedBeats: 1,
                consecutiveChecks: 0,
              };
            }
            const newChecks = n.consecutiveChecks + 1;
            if (newChecks >= VERIFY_THRESHOLD) {
              addLog(
                'up',
                `${n.name} verified (${newChecks}/${VERIFY_THRESHOLD}) — entering slow-start`,
              );
              addLog(
                'up',
                `${n.name} incident resolved — rejoining pool at 0% traffic`,
              );
              return {
                ...n,
                status: 'HEALTHY',
                consecutiveChecks: newChecks,
                trafficWeight: 0,
              };
            }
            addLog(
              'verify',
              `${n.name} verification ${newChecks}/${VERIFY_THRESHOLD} checks passed`,
            );
            return { ...n, consecutiveChecks: newChecks };
          }

          /* ── HEALTHY: check for missed beats ── */
          if (!beatMissed) return n;

          const newMissed = n.missedBeats + 1;
          if (newMissed >= MAX_MISSED_BEATS) {
            addLog('down', `${n.name} → DEAD (${newMissed} missed heartbeats)`);
            return { ...n, missedBeats: newMissed, status: 'DEAD' };
          }
          addLog(
            'missed',
            `${n.name} missed heartbeat (${newMissed}/${MAX_MISSED_BEATS})`,
          );
          return { ...n, missedBeats: newMissed };
        }),
      );

      const alive = current.filter((n) => n.status === 'HEALTHY').length;
      addLog(
        'check',
        `Health check — ${alive}/${current.length} instances responding`,
      );
    }, HEALTH_CHECK_EVERY);

    let remaining = HEALTH_CHECK_EVERY;
    const countdown = setInterval(() => {
      remaining -= 100;
      if (remaining <= 0) remaining = HEALTH_CHECK_EVERY;
      setNextCheckIn(remaining);
    }, 100);

    return () => {
      clearInterval(checkTimer);
      clearInterval(countdown);
    };
  }, [addLog]);

  /* ── Kill: stop heartbeat, let orchestrator detect naturally ── */
  const killNode = useCallback(
    (id: string) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, crashed: true } : n)),
      );
      const node = nodesRef.current.find((n) => n.id === id);
      if (node)
        addLog(
          'missed',
          `${node.name} stopped — waiting for orchestrator to detect…`,
        );
    },
    [addLog],
  );

  /* ── Restart: STARTING → VERIFYING, with flap penalty ── */
  const restartNode = useCallback(
    (id: string) => {
      const node = nodesRef.current.find((n) => n.id === id);
      if (!node) return;

      const newFlaps = node.flaps + 1;
      const isFlapping = newFlaps >= 2;
      const startupMs = isFlapping
        ? STARTUP_DELAY + FLAP_EXTRA_DELAY
        : STARTUP_DELAY;

      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                status: 'STARTING',
                crashed: false,
                missedBeats: 0,
                flaps: newFlaps,
                consecutiveChecks: 0,
                trafficWeight: 0,
                lastBeatMs: Date.now() + startupMs,
              }
            : n,
        ),
      );

      if (isFlapping) {
        addLog(
          'warn',
          `${node.name} flapping detected (died ${newFlaps}×) — ${
            FLAP_EXTRA_DELAY / 1000
          }s penalty added`,
        );
      }
      addLog('up', `${node.name} restarting… (${startupMs / 1000}s startup)`);

      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, status: 'VERIFYING', lastBeatMs: Date.now() }
              : n,
          ),
        );
        addLog(
          'verify',
          `${node.name} online — needs ${VERIFY_THRESHOLD} consecutive checks before rejoining pool`,
        );
      }, startupMs);
    },
    [addLog],
  );

  const healthyCount = nodes.filter((n) => n.status === 'HEALTHY').length;
  const verifyCount = nodes.filter((n) => n.status === 'VERIFYING').length;
  const silentCount = nodes.filter(
    (n) => n.crashed && n.status === 'HEALTHY',
  ).length;
  const deadCount = nodes.filter((n) => n.status === 'DEAD').length;
  const startingCount = nodes.filter((n) => n.status === 'STARTING').length;

  const roleIcon = (r: ServiceNode['role']) =>
    r === 'api' ? '⬡' : r === 'db' ? '◫' : '◈';

  return (
    <section
      id="health"
      className="relative min-h-screen flex flex-col justify-center px-6 py-28 max-w-5xl mx-auto"
    >
      <div className="absolute -right-40 top-1/2 w-80 h-80 bg-emerald-500/6 rounded-full blur-[100px] pointer-events-none" />

      {/* Section header */}
      <div className="flex items-start flex-col sm:flex-row gap-6 mb-12">
        <span className="font-code text-8xl font-bold text-emerald-400 leading-none select-none">
          04
        </span>
        <div>
          <p className="font-code text-xs text-emerald-400 tracking-widest uppercase mb-2">
            Fault Tolerance Pattern
          </p>
          <h2 className="font-heading text-4xl font-bold text-white">
            Health Check + Heartbeat
          </h2>
          <p className="font-code text-sm text-white/40 mt-2 max-w-lg leading-relaxed">
            Nodes send a heartbeat every {HEARTBEAT_INTERVAL / 1000}s.
            Orchestrator checks every {HEALTH_CHECK_EVERY / 1000}s. Recovery
            requires {VERIFY_THRESHOLD} consecutive passing checks, then traffic
            ramps up gradually (slow-start). Repeated failures trigger flapping
            protection.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-surface relative overflow-hidden">
        <div className="h-px w-full bg-linear-to-r from-transparent via-emerald-400/60 to-transparent" />
        <div className="p-8 space-y-8">
          {/* Monitor bar */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-400/30 bg-emerald-400/5">
              <div className="relative w-2.5 h-2.5">
                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-ring" />
                <div className="relative w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <span className="font-code text-xs text-emerald-300">
                MONITOR ACTIVE
              </span>
            </div>
            <div className="flex items-center gap-4 font-code text-sm">
              <span className="text-green-400">{healthyCount} healthy</span>
              {silentCount > 0 && (
                <span className="text-orange-400">{silentCount} silent</span>
              )}
              {verifyCount > 0 && (
                <span className="text-blue-400">{verifyCount} verifying</span>
              )}
              {deadCount > 0 && (
                <span className="text-red-400">{deadCount} dead</span>
              )}
              {startingCount > 0 && (
                <span className="text-yellow-400">
                  {startingCount} starting
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="font-code text-xs text-white/30">
                next check
              </span>
              <div className="w-24 h-1 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400/50 rounded-full transition-none"
                  style={{
                    width: `${
                      ((HEALTH_CHECK_EVERY - nextCheckIn) /
                        HEALTH_CHECK_EVERY) *
                      100
                    }%`,
                  }}
                />
              </div>
              <span className="font-code text-xs text-emerald-400/70 w-8">
                {(nextCheckIn / 1000).toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Node grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-3 gap-4">
            {nodes.map((node) => {
              const isSilent = node.crashed && node.status === 'HEALTHY';
              const isSlowStart =
                node.status === 'HEALTHY' && node.trafficWeight < 100;
              return (
                <div
                  key={node.id}
                  className={`rounded-xl border p-4 transition-all duration-500 ${
                    node.status === 'DEAD'
                      ? 'border-red-500/25    bg-red-500/5    opacity-70'
                      : node.status === 'STARTING'
                      ? 'border-yellow-400/25 bg-yellow-400/5'
                      : node.status === 'VERIFYING'
                      ? 'border-blue-400/25   bg-blue-400/5'
                      : isSilent
                      ? 'border-orange-400/30 bg-orange-400/5'
                      : isSlowStart
                      ? 'border-teal-400/25   bg-teal-400/5'
                      : 'border-emerald-400/20 bg-emerald-400/4'
                  }`}
                >
                  {/* Node header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white/20 text-sm">
                        {roleIcon(node.role)}
                      </span>
                      <span className="font-code text-xs font-bold text-white/70">
                        {node.name}
                      </span>
                      {node.flaps >= 2 && (
                        <span className="font-code text-[9px] text-orange-400/60 border border-orange-400/20 rounded px-1">
                          ⚠ flap×{node.flaps}
                        </span>
                      )}
                    </div>
                    {node.status === 'HEALTHY' && !isSilent && (
                      <div className="relative w-3 h-3">
                        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-ring opacity-70" />
                        <div className="relative w-3 h-3 rounded-full bg-emerald-400 animate-heartbeat" />
                      </div>
                    )}
                    {node.status === 'VERIFYING' && (
                      <div className="relative w-3 h-3">
                        <div className="absolute inset-0 rounded-full bg-blue-400 animate-pulse-ring opacity-60" />
                        <div className="relative w-3 h-3 rounded-full bg-blue-400 animate-heartbeat" />
                      </div>
                    )}
                    {isSilent && (
                      <div className="w-3 h-3 rounded-full bg-orange-400/50" />
                    )}
                    {node.status === 'STARTING' && (
                      <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
                    )}
                    {node.status === 'DEAD' && (
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                    )}
                  </div>

                  {/* Status badge */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-code text-[10px] mb-3 ${
                      node.status === 'DEAD'
                        ? 'border-red-500/25     text-red-300'
                        : node.status === 'STARTING'
                        ? 'border-yellow-400/25  text-yellow-300'
                        : node.status === 'VERIFYING'
                        ? 'border-blue-400/25    text-blue-300'
                        : isSilent
                        ? 'border-orange-400/25  text-orange-300'
                        : 'border-emerald-400/25 text-emerald-300'
                    }`}
                  >
                    {node.status === 'DEAD'
                      ? `✗ DEAD (${node.missedBeats} missed)`
                      : node.status === 'STARTING'
                      ? '● STARTING…'
                      : node.status === 'VERIFYING'
                      ? `◈ VERIFYING (${node.consecutiveChecks}/${VERIFY_THRESHOLD})`
                      : isSilent
                      ? `! SILENT (${node.missedBeats}/${MAX_MISSED_BEATS})`
                      : isSlowStart
                      ? `↑ SLOW-START ${node.trafficWeight}%`
                      : '● HEALTHY'}
                  </div>

                  {/* Metrics for healthy nodes */}
                  {node.status === 'HEALTHY' && !isSilent && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between font-code text-[10px]">
                        <span className="text-white/30">Traffic</span>
                        <span
                          className={
                            node.trafficWeight < 100
                              ? 'text-teal-400'
                              : 'text-white/50'
                          }
                        >
                          {node.trafficWeight}%
                        </span>
                      </div>
                      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${node.trafficWeight}%`,
                            backgroundColor:
                              node.trafficWeight < 100 ? '#2DD4BF' : '#34D399',
                          }}
                        />
                      </div>
                      <div className="flex justify-between font-code text-[10px]">
                        <span className="text-white/30">CPU</span>
                        <span
                          className={
                            node.cpu > 80
                              ? 'text-red-400'
                              : node.cpu > 60
                              ? 'text-yellow-400'
                              : 'text-white/50'
                          }
                        >
                          {node.cpu}%
                        </span>
                      </div>
                      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${node.cpu}%`,
                            backgroundColor:
                              node.cpu > 80
                                ? '#EF4444'
                                : node.cpu > 60
                                ? '#EAB308'
                                : '#34D399',
                          }}
                        />
                      </div>
                      <div className="flex justify-between font-code text-[10px]">
                        <span className="text-white/30">RTT</span>
                        <span className="text-white/50">{node.rtt}ms</span>
                      </div>
                    </div>
                  )}

                  {/* Verification progress */}
                  {node.status === 'VERIFYING' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between font-code text-[10px]">
                        <span className="text-blue-400/60">Checks passed</span>
                        <span className="text-blue-300">
                          {node.consecutiveChecks}/{VERIFY_THRESHOLD}
                        </span>
                      </div>
                      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              (node.consecutiveChecks / VERIFY_THRESHOLD) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <p className="font-code text-[10px] text-blue-400/50 italic">
                        {VERIFY_THRESHOLD - node.consecutiveChecks} more check
                        {VERIFY_THRESHOLD - node.consecutiveChecks !== 1
                          ? 's'
                          : ''}{' '}
                        before rejoining pool…
                      </p>
                    </div>
                  )}

                  {isSilent && (
                    <p className="font-code text-[10px] text-orange-400/60 italic">
                      Heartbeat stopped — orchestrator will detect on next
                      check…
                    </p>
                  )}

                  {/* Actions */}
                  <div className="mt-3">
                    {node.status === 'HEALTHY' && !isSilent && (
                      <button
                        onClick={() => killNode(node.id)}
                        className="w-full py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 font-code text-[11px] text-red-400 transition-colors cursor-pointer"
                      >
                        Kill instance
                      </button>
                    )}
                    {node.status === 'DEAD' && (
                      <button
                        onClick={() => restartNode(node.id)}
                        className="w-full py-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 hover:bg-emerald-400/15 font-code text-[11px] text-emerald-400 transition-colors cursor-pointer"
                      >
                        Restart instance{' '}
                        {node.flaps >= 2 ? '(+flap penalty)' : ''}
                      </button>
                    )}
                    {node.status === 'STARTING' && (
                      <div className="w-full py-1.5 rounded-lg border border-yellow-400/15 font-code text-[11px] text-yellow-400/60 text-center">
                        {node.flaps >= 2
                          ? '⚠ Extended startup (flap penalty)…'
                          : 'Starting up…'}
                      </div>
                    )}
                    {node.status === 'VERIFYING' && (
                      <div className="w-full py-1.5 rounded-lg border border-blue-400/15 font-code text-[11px] text-blue-400/50 text-center">
                        Verifying stability…
                      </div>
                    )}
                    {isSilent && (
                      <div className="w-full py-1.5 rounded-lg border border-orange-400/15 font-code text-[11px] text-orange-400/50 text-center">
                        Awaiting detection…
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* System log */}
          <div className="space-y-1.5">
            <p className="font-code text-[10px] text-white/25 uppercase tracking-widest">
              System Log
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {log.length === 0 && (
                <p className="font-code text-sm text-white/20 italic">
                  Waiting for events…
                </p>
              )}
              {log.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 font-code text-xs px-3 py-2 rounded-lg border animate-slide-up ${
                    entry.type === 'down'
                      ? 'border-red-500/15     bg-red-500/5     text-red-400'
                      : entry.type === 'up'
                      ? 'border-emerald-400/15 bg-emerald-400/5 text-emerald-300'
                      : entry.type === 'missed'
                      ? 'border-orange-500/15  bg-orange-500/5  text-orange-400'
                      : entry.type === 'verify'
                      ? 'border-blue-400/15    bg-blue-400/5    text-blue-300'
                      : entry.type === 'warn'
                      ? 'border-yellow-400/15  bg-yellow-400/5  text-yellow-300'
                      : entry.type === 'check'
                      ? 'border-white/6         bg-white/2  text-white/30'
                      : 'border-emerald-400/10  bg-emerald-400/4 text-emerald-400/60'
                  }`}
                >
                  <span className="text-white/20 shrink-0">{entry.time}</span>
                  <span className="shrink-0">
                    {entry.type === 'down'
                      ? '✗'
                      : entry.type === 'up'
                      ? '✓'
                      : entry.type === 'missed'
                      ? '!'
                      : entry.type === 'verify'
                      ? '◈'
                      : entry.type === 'warn'
                      ? '⚠'
                      : entry.type === 'check'
                      ? '◎'
                      : '♡'}
                  </span>
                  <span>{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
