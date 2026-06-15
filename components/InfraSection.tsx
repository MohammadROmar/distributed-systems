'use client';

import { useState } from 'react';

type FileId = 'nginx' | 'dockerfile' | 'compose';

const FILES: Record<FileId, { name: string; content: string }> = {
  nginx: {
    name: 'nginx/nginx.conf',
    content: `# ════════════════════════════════════════════════════════════════
#  Nginx — Front-End Ingress Policy Router
#
#  Covers:
#    ✓ Reverse Proxy Architecture  — upstream pool + proxy_pass
#    ✓ Ingress Routing             — path-based location blocks
#    ✓ API Gateway Patterns        — headers, timeouts, fingerprint hiding
#    ✓ Load Shedding               — limit_req + limit_conn (503 on overload)
# ════════════════════════════════════════════════════════════════

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # ── Load Shedding: define shared memory zones ────────────────
    limit_req_zone  $binary_remote_addr  zone=api:10m     rate=30r/s;
    limit_req_zone  $binary_remote_addr  zone=static:10m  rate=200r/s;
    limit_conn_zone $binary_remote_addr  zone=per_ip:10m;

    # ── Reverse Proxy Architecture: upstream pool ────────────────
    upstream app_pool {
        server app-1:3000;
        server app-2:3000;
        server app-3:3000;
        keepalive 32;
    }

    server {
        listen 80;
        server_name _;

        # ── API Gateway Patterns: hide server fingerprint ────────
        server_tokens off;
        proxy_hide_header X-Powered-By;

        # ── API Gateway Patterns: forwarding headers ─────────────
        proxy_set_header Host               $host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  $scheme;

        # ── API Gateway Patterns: timeout policy ─────────────────
        proxy_connect_timeout   5s;
        proxy_read_timeout      30s;
        proxy_send_timeout      10s;

        # ── API Gateway Patterns: add tracing header ─────────────
        add_header X-Upstream $upstream_addr always;

        # ── Ingress Routing: health check bypass ─────────────────
        location = /health {
            proxy_pass  http://app_pool;
            access_log  off;
        }

        # ── Ingress Routing: static assets ───────────────────────
        location /_next/static/ {
            limit_req   zone=static  burst=300  nodelay;
            limit_conn  per_ip       50;
            proxy_pass  http://app_pool;
            add_header  Cache-Control "public, max-age=31536000, immutable";
            access_log  off;
        }

        # ── Ingress Routing: Next.js internals ───────────────────
        location /_next/ {
            proxy_pass  http://app_pool;
            access_log  off;
        }

        # ── Ingress Routing + Load Shedding: main app ────────────
        location / {
            limit_req   zone=api  burst=10  nodelay;
            limit_conn  per_ip    20;
            proxy_pass  http://app_pool;
        }
    }
}`,
  },
  dockerfile: {
    name: 'Dockerfile',
    content: `# ── Stage 1: Install dependencies ───────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build the Next.js app ──────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: Minimal production image ───────────────────────
# Only copies what Next.js standalone output needs — no node_modules bloat.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \\
    PORT=3000 \\
    HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public

EXPOSE 3000
CMD ["node", "server.js"]`,
  },
  compose: {
    name: 'docker-compose.yml',
    content: `services:

  # ── Nginx: sits in front of everything ──────────────────────
  # The single entry point on port 80.
  # Reads its config from ./nginx/nginx.conf (mounted read-only).
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app-1
      - app-2
      - app-3

  # ── Three identical instances of the app ────────────────────
  # Docker gives each one its own internal IP.
  # INSTANCE_ID is visible in the X-Upstream response header,
  # so you can see which backend handled each request.
  app-1:
    build: .
    environment:
      INSTANCE_ID: "1"

  app-2:
    build: .
    environment:
      INSTANCE_ID: "2"

  app-3:
    build: .
    environment:
      INSTANCE_ID: "3"`,
  },
};

const FEATURES = [
  {
    label: 'Reverse Proxy',
    desc: 'Upstream pool distributes requests across 3 app instances',
    accentColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/20',
    bgColor: 'bg-cyan-950/10',
  },
  {
    label: 'Ingress Routing',
    desc: 'Path-based location blocks — static vs dynamic vs health',
    accentColor: 'text-blue-400',
    borderColor: 'border-blue-400/20',
    bgColor: 'bg-blue-950/10',
  },
  {
    label: 'API Gateway',
    desc: 'Header forwarding, timeout policy, fingerprint hiding',
    accentColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/20',
    bgColor: 'bg-indigo-950/10',
  },
  {
    label: 'Load Shedding',
    desc: 'Rate + connection zone limits — returns 503 on overload',
    accentColor: 'text-orange-400',
    borderColor: 'border-orange-500/20',
    bgColor: 'bg-orange-950/10',
  },
];

export function InfraSection() {
  const [activeFile, setActiveFile] = useState<FileId>('nginx');

  return (
    <section
      id="nginx"
      className="relative px-6 md:px-16 lg:px-24 py-24 md:py-32 overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-cyan-950/20 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-6 md:gap-10 items-start mb-16">
          <span className="font-code font-bold text-cyan-500 leading-none shrink-0 select-none text-[5rem] md:text-[7rem] -mt-3">
            06
          </span>
          <div>
            <div className="font-code text-xs text-cyan-500 tracking-[0.2em] uppercase mb-3">
              Infrastructure · Local Dev
            </div>
            <h2 className="font-heading text-3xl md:text-5xl font-black text-white tracking-tight leading-none mb-4">
              Nginx Ingress Layer
            </h2>
            <p className="font-code text-sm text-white/40 leading-relaxed max-w-lg">
              Three Next.js instances sit behind Nginx as a reverse proxy. Nginx
              handles path-based routing, API gateway policies, and rate-based
              load shedding. Orchestrated with Docker Compose — runs locally,
              not on Vercel.
            </p>
          </div>
        </div>

        <div
          className="w-full border border-white/8 rounded-xl bg-black/40 p-6 md:p-10 mb-6"
          style={{
            backgroundImage:
              'linear-gradient(rgba(6,182,212,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.025) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        >
          <div className="flex justify-center mb-5">
            <div className="flex items-center gap-2.5 px-5 py-2 border border-white/15 rounded-full bg-white/5">
              <div className="w-2 h-2 rounded-full bg-white/40" />
              <span className="font-code text-xs text-white/50">
                Browser · Client
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center mb-4 gap-0.5">
            <div className="w-px h-5 bg-white/15" />
            <span className="font-code text-[9px] text-white/25 tracking-widest px-2">
              HTTP · :80
            </span>
            <div className="w-px h-5 bg-white/15" />
            <div className="w-2 h-2 border-r border-b border-white/20 rotate-45 -mt-1.5" />
          </div>

          <div className="border border-cyan-500/25 rounded-lg bg-cyan-950/15 p-4 mx-auto max-w-sm mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-code text-xs font-bold text-cyan-400 tracking-wider uppercase">
                nginx · 1.27-alpine
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/70" />
                <span className="font-code text-[10px] text-cyan-500/50">
                  port 80
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Reverse Proxy',
                'Ingress Routing',
                'API Gateway',
                'Load Shedding',
              ].map((f) => (
                <span
                  key={f}
                  className="font-code text-[9px] text-cyan-300/40 border border-cyan-500/15 rounded-sm px-1.5 py-0.5"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(['1', '2', '3'] as const).map((n) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div className="w-px h-5 bg-white/10" />
                <div className="w-full border border-white/10 rounded-lg bg-white/3 p-3 text-center">
                  <div className="font-code text-[9px] text-white/25 uppercase tracking-wider mb-1.5">
                    app-{n}
                  </div>
                  <div className="font-code text-sm font-bold text-white/55">
                    :3000
                  </div>
                  <div className="font-code text-[9px] text-white/20 mt-1">
                    Next.js · standalone
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/8">
                    <div className="w-1 h-1 rounded-full bg-emerald-400/60" />
                    <span className="font-code text-[8px] text-white/25">
                      <span className="hidden sm:inline-block">INSTANCE_</span>
                      ID={n}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className={`p-3.5 border ${f.borderColor} ${f.bgColor} rounded-lg`}
            >
              <div
                className={`font-heading text-[11px] font-bold ${f.accentColor} uppercase tracking-wide mb-1.5`}
              >
                {f.label}
              </div>
              <div className="font-code text-[10px] text-white/30 leading-relaxed">
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        <div className="border border-white/8 rounded-xl overflow-hidden bg-black/50 mb-4">
          {/* Tab bar */}
          <div className="flex overflow-y-auto items-center border-b border-white/8 bg-black/30">
            {(Object.keys(FILES) as FileId[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveFile(key)}
                className={`px-4 py-3 whitespace-nowrap font-code text-xs transition-all duration-150 border-b border-transparent ${
                  activeFile === key
                    ? 'text-cyan-400 border-b border-cyan-400/50 bg-cyan-950/20'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                {FILES[key].name}
              </button>
            ))}

            <a
              href="https://github.com/MohammadROmar/distributed-systems"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto mr-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/8 bg-white/5 hover:bg-white/10 hover:border-white/15 transition-all duration-200 group"
            >
              <svg
                className="w-3.5 h-3.5 text-white/35 group-hover:text-white/60 transition-colors"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span className="font-code text-[10px] text-white/35 group-hover:text-white/55 transition-colors">
                GitHub
              </span>
              <svg
                className="w-2.5 h-2.5 text-white/20 group-hover:text-white/35 transition-colors"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M2 10L10 2M10 2H5M10 2V7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </a>
          </div>

          <pre className="p-5 text-[11px] leading-relaxed overflow-x-auto max-h-88 font-code text-white/45 scrollbar-thin">
            <code>{FILES[activeFile].content}</code>
          </pre>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 shrink-0" />
          <span className="font-code text-[11px] text-white/25 leading-relaxed">
            Runs at <span className="text-amber-400/60">http://localhost</span>{' '}
            via Docker Compose — not available on the Vercel deployment. The
            config above is the exact file running locally.
          </span>
        </div>
      </div>
    </section>
  );
}
