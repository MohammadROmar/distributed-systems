'use client';

const SECTIONS = [
  { id: 'retry', label: '01 · Retry', color: 'hover:text-orange-400' },
  { id: 'circuit', label: '02 · Circuit Breaker', color: 'hover:text-red-400' },
  { id: 'fallback', label: '03 · Fallback', color: 'hover:text-blue-400' },
  { id: 'health', label: '04 · Health Check', color: 'hover:text-emerald-400' },
  { id: 'jitter', label: '05 · Jitter Lock', color: 'hover:text-violet-400' },
  { id: 'nginx', label: '06 · Nginx', color: 'hover:text-cyan-500' },
];

export function NavBar() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/6 bg-[#04060D]/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-center">
        <nav className="hidden md:flex items-center gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`font-code cursor-pointer text-xs text-white/40 ${s.color} px-3 py-1.5 rounded-md transition-colors`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
