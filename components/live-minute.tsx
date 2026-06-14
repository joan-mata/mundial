'use client';
import { useEffect, useState } from 'react';

interface Props {
  kickoff: Date | string;
}

function calcMinute(kickoff: Date): { display: string; isHT: boolean } {
  const elapsed = Math.floor((Date.now() - new Date(kickoff).getTime()) / 60_000);

  // 1st half: 0-45 min
  if (elapsed <= 47) return { display: `${Math.min(elapsed, 45)}'`, isHT: false };
  // Halftime break: 47-62 min elapsed
  if (elapsed <= 62) return { display: 'HT', isHT: true };
  // 2nd half: starts ~62 min elapsed
  const secondHalf = elapsed - 62;
  if (secondHalf <= 47) return { display: `${45 + Math.min(secondHalf, 45)}'`, isHT: false };
  // Extra time / overrun
  return { display: `90+'`, isHT: false };
}

export function LiveMinute({ kickoff }: Props) {
  const [state, setState] = useState(() => calcMinute(new Date(kickoff)));

  useEffect(() => {
    const id = setInterval(() => setState(calcMinute(new Date(kickoff))), 30_000);
    return () => clearInterval(id);
  }, [kickoff]);

  return (
    <span className={`font-mono tabular-nums text-sm font-semibold ${state.isHT ? 'text-muted-foreground' : 'text-red-500'}`}>
      {state.display}
    </span>
  );
}
