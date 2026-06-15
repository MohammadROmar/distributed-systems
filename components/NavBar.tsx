'use client';

import { useState, useEffect } from 'react';

const SECTIONS = [
  {
    id: 'retry',
    label: '01 · Retry',
    color: 'hover:text-orange-400',
    activeColor: 'text-orange-400',
  },
  {
    id: 'circuit',
    label: '02 · Circuit Breaker',
    color: 'hover:text-red-400',
    activeColor: 'text-red-400',
  },
  {
    id: 'fallback',
    label: '03 · Fallback',
    color: 'hover:text-blue-400',
    activeColor: 'text-blue-400',
  },
  {
    id: 'health',
    label: '04 · Health Check',
    color: 'hover:text-emerald-400',
    activeColor: 'text-emerald-400',
  },
  {
    id: 'jitter',
    label: '05 · Jitter Lock',
    color: 'hover:text-violet-400',
    activeColor: 'text-violet-400',
  },
  {
    id: 'nginx',
    label: '06 · Nginx',
    color: 'hover:text-cyan-500',
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
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const scrollTo = (id: string) => {
    setIsOpen(false);
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  return (
    <>
      {/* --- DESKTOP & MOBILE HEADER --- */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#04060D]/80 backdrop-blur-md transition-all">
        <div className="max-w-6xl mx-auto px-6 h-16 flex justify-end items-center md:justify-center">
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center  gap-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`font-code cursor-pointer text-xs text-white/40 ${s.color} px-3 py-1.5 rounded-md transition-all duration-300`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* Mobile Hamburger Button (Pure CSS Animation) */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden relative z-50 w-8 h-8 flex flex-col items-end justify-center gap-1.5 text-white/70 hover:text-white transition-colors"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            <span
              className={`block h-0.5 bg-current transform transition-all duration-300 ease-in-out ${
                isOpen ? 'w-6 rotate-45 translate-y-2' : 'w-6'
              }`}
            />
            <span
              className={`block h-0.5 bg-current transition-all duration-300 ease-in-out ${
                isOpen ? 'w-6 opacity-0 translate-x-4' : 'w-4'
              }`}
            />
            <span
              className={`block h-0.5 bg-current transform transition-all duration-300 ease-in-out ${
                isOpen ? 'w-6 -rotate-45 -translate-y-2' : 'w-5'
              }`}
            />
          </button>
        </div>
      </header>

      {/* --- MOBILE FULL-SCREEN OVERLAY --- */}
      <div
        className={`fixed inset-0 z-40 bg-[#04060D]/95 backdrop-blur-xl md:hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-center justify-center ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none delay-200'
        }`}
      >
        <nav className="flex flex-col items-center justify-center gap-8 w-full px-6">
          {SECTIONS.map((s, i) => {
            // Split "01 · Retry" into small number and large text for a premium visual hierarchy
            const [num, text] = s.label.split('·');

            return (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                // Math-based staggering effect (increases delay per item)
                style={{ transitionDelay: `${isOpen ? i * 75 + 150 : 0}ms` }}
                className={`font-code group flex flex-col items-center gap-1 transition-all duration-500 ease-out ${
                  isOpen
                    ? 'translate-y-0 opacity-100 blur-none'
                    : 'translate-y-8 opacity-0 blur-sm'
                }`}
              >
                <span className="text-xs text-white/30 font-mono tracking-widest group-hover:text-white/60 transition-colors">
                  {num.trim()}
                </span>
                <span
                  className={`text-2xl tracking-wide text-white/60 transition-colors duration-300 group-hover:${s.activeColor}`}
                >
                  {text.trim()}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
