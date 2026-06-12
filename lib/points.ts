import type { KnockoutMethod } from '@prisma/client';

export function baseMatchPoints(
  pred: { homeScore: number; awayScore: number },
  result90: { homeScore: number; awayScore: number }
): number {
  if (pred.homeScore === result90.homeScore && pred.awayScore === result90.awayScore) return 3;
  if (Math.sign(pred.homeScore - pred.awayScore) === Math.sign(result90.homeScore - result90.awayScore)) return 1;
  return 0;
}

export type KnockoutActual = {
  winnerId: string;
  method: KnockoutMethod;
  etHomeScore: number | null;
  etAwayScore: number | null;
};

export type KnockoutPred = {
  winnerId: string | null;
  method: KnockoutMethod | null;
  etHomeScore: number | null;
  etAwayScore: number | null;
};

export function knockoutBonus(pred: KnockoutPred, actual: KnockoutActual, basePoints: number): number {
  if (basePoints === 0 || !pred.winnerId) return 0;
  let bonus = 0;
  if (pred.winnerId === actual.winnerId) {
    bonus += 1; // pasar ronda
    if (pred.method === actual.method && actual.method === 'EXTRA_TIME') {
      bonus += 1; // prórroga acertada
      if (
        pred.etHomeScore !== null && pred.etAwayScore !== null &&
        actual.etHomeScore !== null && actual.etAwayScore !== null &&
        pred.etHomeScore === actual.etHomeScore &&
        pred.etAwayScore === actual.etAwayScore
      ) {
        bonus += 3; // marcador de prórroga exacto
      }
    }
  }
  return bonus;
}

export function favTeamBonus(
  favoriteTeam: string | null,
  teams: { home: string | null; away: string | null },
  result90: { homeScore: number; awayScore: number },
  knockoutWinnerId: string | null,
  basePoints: number
): number {
  if (!favoriteTeam || basePoints === 0) return 0;
  if (teams.home !== favoriteTeam && teams.away !== favoriteTeam) return 0;
  const winner90 = result90.homeScore > result90.awayScore ? teams.home
    : result90.awayScore > result90.homeScore ? teams.away
    : null;
  const realWinner = winner90 ?? knockoutWinnerId;
  return realWinner === favoriteTeam ? 1 : 0;
}
