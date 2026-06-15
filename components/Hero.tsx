'use client';

const CARDS = [
  {
    id: 'retry',
    num: '01',
    label: 'Retry',
    sublabel: '+ Backoff',
    numColor: 'text-orange-400',
    dot: 'bg-orange-500',
    hover: 'hover:bg-orange-500/5',
  },
  {
    id: 'circuit',
    num: '02',
    label: 'Circuit',
    sublabel: 'Breaker',
    numColor: 'text-red-400',
    dot: 'bg-red-500',
    hover: 'hover:bg-red-500/5',
  },
  {
    id: 'fallback',
    num: '03',
    label: 'Fallback',
    sublabel: '',
    numColor: 'text-blue-400',
    dot: 'bg-blue-400',
    hover: 'hover:bg-blue-400/5',
  },
  {
    id: 'health',
    num: '04',
    label: 'Health Check',
    sublabel: '+ Heartbeat',
    numColor: 'text-emerald-400',
    dot: 'bg-emerald-400',
    hover: 'hover:bg-emerald-400/5',
  },
  {
    id: 'jitter',
    num: '05',
    label: 'Jitter Lock',
    sublabel: 'Shield',
    numColor: 'text-violet-400',
    dot: 'bg-violet-400',
    hover: 'hover:bg-violet-400/5',
  },
  {
    id: 'nginx',
    num: '06',
    label: 'Nginx',
    sublabel: 'Ingress',
    numColor: 'text-cyan-400',
    dot: 'bg-cyan-500',
    hover: 'hover:bg-cyan-500/5',
  },
];

export function Hero() {
  const scrollTo = (id: string) => {
    if (typeof window !== 'undefined') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      className="relative min-h-screen flex flex-col justify-between px-6 md:px-16 lg:px-24 py-10 md:py-14 overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    >
      <div className="absolute -top-32 -left-32 w-120 h-120 rounded-full bg-indigo-900/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-70 h-70 rounded-full bg-indigo-950/40 blur-[90px] pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col items-center gap-6 justify-center py-10 md:py-16">
        <h1 className="font-heading font-black leading-none text-[clamp(3rem,9.5vw,5rem)] text-center text-white tracking-tighter uppercase select-none">
          Distributed Systems
        </h1>

        <p className="font-code max-w-2xl text-sm text-white/35 text-center leading-relaxed">
          Best experienced on a desktop or laptop screen. Mobile is not
          responsive.
        </p>

        <a
          href="https://github.com/MohammadROmar/distributed-systems"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full border border-white/20 bg-white/10 hover:bg-white/10 hover:border-white/20 w-fit transition-all duration-200 group"
        >
          <svg
            className="size-5 text-white/80 group-hover:text-white transition-colors"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span className="font-code leading-none text-lg text-white/80 group-hover:text-white transition-colors">
            Source
          </span>
          <svg
            className="size-4 text-white/60 group-hover:text-white/80 transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
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

      <div className="flex md:grid md:grid-cols-6 gap-px rounded-xl overflow-x-auto md:overflow-hidden bg-white/6 border border-white/8">
        {CARDS.map((c) => (
          <button
            key={c.id}
            onClick={() => scrollTo(c.id)}
            className={`group relative min-w-36 md:min-w-0 flex flex-col justify-between p-4 md:p-5 bg-black/50 text-left transition-all duration-200 cursor-pointer first:rounded-l-xl last:rounded-r-xl ${c.hover}`}
          >
            <div
              className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${c.dot} opacity-20 group-hover:opacity-70 transition-opacity duration-200`}
            />
            <div
              className={`font-code text-3xl font-bold ${c.numColor} opacity-20 group-hover:opacity-45 transition-opacity duration-200 leading-none`}
            >
              {c.num}
            </div>
            <div className="mt-6 pl-1">
              <div className="font-heading text-[11px] font-semibold text-white/45 group-hover:text-white/80 transition-colors duration-200 leading-snug uppercase tracking-wide">
                {c.label}
              </div>
              {c.sublabel && (
                <div className="font-heading text-[11px] font-semibold text-white/22 group-hover:text-white/45 transition-colors duration-200 leading-snug uppercase tracking-wide">
                  {c.sublabel}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
