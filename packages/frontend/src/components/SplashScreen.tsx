import { useEffect, useState } from 'react';

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<'in' | 'visible' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('visible'), 50);   // brief delay then fully visible
    const t2 = setTimeout(() => setPhase('out'), 1800);      // start fade-out at 1.8s
    const t3 = setTimeout(() => onDone(), 2300);             // done at 2.3s
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#1C1917',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        transition: 'opacity 0.5s ease',
        opacity: phase === 'out' ? 0 : phase === 'visible' ? 1 : 0,
      }}
    >
      <img
        src="/logo-bee-forest.jpg"
        alt="Bee Forest"
        style={{
          maxWidth: '240px',
          borderRadius: '12px',
          filter: 'brightness(1.05) contrast(1.05)',
          boxShadow: '0 0 60px rgba(245,158,11,0.15)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b',
          animation: 'splash-pulse 1s ease-in-out infinite',
        }} />
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b',
          animation: 'splash-pulse 1s ease-in-out 0.2s infinite',
        }} />
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b',
          animation: 'splash-pulse 1s ease-in-out 0.4s infinite',
        }} />
      </div>

      <style>{`
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
