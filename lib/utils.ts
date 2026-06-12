import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKickoff(date: Date, tz = 'Europe/Madrid'): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: tz,
  }).format(date);
}

export function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    GROUP: 'Fase de Grupos',
    ROUND_OF_32: 'Ronda de 32',
    ROUND_OF_16: 'Octavos de Final',
    QUARTER: 'Cuartos de Final',
    SEMI: 'Semifinal',
    THIRD: 'Tercer Puesto',
    FINAL: 'Final',
  };
  return labels[stage] ?? stage;
}

export function methodLabel(method: string | null): string {
  if (!method) return '';
  return method === 'EXTRA_TIME' ? 'Prórroga' : 'Penaltis';
}
