import { NavBar } from '@/components/NavBar';
import { Hero } from '@/components/Hero';
import { RetryBackoffDemo } from '@/components/RetryBackoffDemo';
import { CircuitBreakerDemo } from '@/components/CircuitBreakerDemo';
import { FallbackDemo } from '@/components/FallbackDemo';
import { HealthCheckDemo } from '@/components/HealthCheckDemo';
import { JitterLockDemo } from '@/components/JitterLockDemo';
import { InfraSection } from '@/components/InfraSection';

function Separator() {
  return (
    <div className="max-w-5xl mx-auto px-6">
      <div className="h-px bg-linear-to-r from-transparent via-white/8 to-transparent" />
    </div>
  );
}

export default function Home() {
  return (
    <>
      <NavBar />

      <main className="relative z-10">
        <Hero />
        <Separator />

        <RetryBackoffDemo />
        <Separator />

        <CircuitBreakerDemo />
        <Separator />

        <FallbackDemo />
        <Separator />

        <HealthCheckDemo />
        <Separator />

        <JitterLockDemo />
        <Separator />

        <InfraSection />
      </main>
    </>
  );
}
