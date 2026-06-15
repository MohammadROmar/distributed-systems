'use client';

import { useEffect, useState } from 'react';

const SECTIONS = [
  {
    id: 'retry',
    label: '01 · Retry',
    hoverColor: 'group-hover:text-orange-400',
    activeColor: 'text-orange-400',
  },
  {
    id: 'circuit',
    label: '02 · Circuit Breaker',
    hoverColor: 'group-hover:text-red-400',
    activeColor: 'text-red-400',
  },
  {
    id: 'fallback',
    label: '03 · Fallback',
    hoverColor: 'group-hover:text-blue-400',
    activeColor: 'text-blue-400',
  },
  {
    id: 'health',
    label: '04 · Health Check',
    hoverColor: 'group-hover:text-emerald-400',
    activeColor: 'text-emerald-400',
  },
  {
    id: 'jitter',
    label: '05 · Jitter Lock',
    hoverColor: 'group-hover:text-violet-400',
    activeColor: 'text-violet-400',
  },
  {
    id: 'nginx',
    label: '06 · Nginx',
    hoverColor: 'group-hover:text-cyan-500',
    activeColor: 'text-cyan-500',
  },
];

export function NavBar() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    document.documentElement.style.overflow = isOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  const scrollTo = (id: string) => {
    setIsOpen(false);

    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#04060D]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-end px-4 sm:px-6 md:justify-center">
          <nav className="hidden items-center gap-1 md:flex">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollTo(section.id)}
                className={`font-code rounded-md px-3 py-1.5 text-xs text-white/40 transition-all duration-300 cursor-pointer hover:text-white ${section.hoverColor}`}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="relative z-50 flex h-8 w-8 flex-col items-end justify-center gap-1.5 overflow-hidden text-white/70 transition-colors hover:text-white md:hidden"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            <span
              className={`block h-0.5 bg-current transition-all duration-300 ease-in-out ${
                isOpen ? 'w-6 translate-y-2 rotate-45' : 'w-6'
              }`}
            />
            <span
              className={`block h-0.5 bg-current transition-all duration-300 ease-in-out ${
                isOpen ? 'w-6 -translate-x-4 opacity-0' : 'w-4'
              }`}
            />
            <span
              className={`block h-0.5 bg-current transition-all duration-300 ease-in-out ${
                isOpen ? 'w-6 -translate-y-2 -rotate-45' : 'w-5'
              }`}
            />
          </button>
        </div>
      </header>

      <div
        id="mobile-menu"
        className={`fixed inset-0 z-40 md:hidden bg-[#04060D]/95 backdrop-blur-xl overflow-x-clip overflow-y-auto transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen
            ? 'visible pointer-events-auto opacity-100'
            : 'invisible pointer-events-none opacity-0'
        }`}
      >
        <div className="flex min-h-dvh w-full flex-col px-6 pt-28 pb-12">
          <nav className="my-auto flex w-full flex-col items-center gap-8">
            {SECTIONS.map((section, index) => {
              const [num, text] = section.label.split('·');

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollTo(section.id)}
                  style={{
                    transitionDelay: isOpen ? `${index * 75 + 150}ms` : '0ms',
                  }}
                  className={`font-code group flex w-full max-w-[90vw] flex-col items-center gap-1 text-center transition-all duration-500 ease-out ${
                    isOpen
                      ? 'translate-y-0 opacity-100 blur-none'
                      : 'translate-y-4 opacity-0 blur-sm'
                  }`}
                >
                  <span className="text-xs font-mono tracking-widest text-white/30 transition-colors group-hover:text-white/60">
                    {num.trim()}
                  </span>
                  <span
                    className={`max-w-full text-2xl tracking-wide text-white/60 transition-colors duration-300 ${section.hoverColor}`}
                  >
                    {text.trim()}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
