import { db } from './db';
import { baseMatchPoints, knockoutBonus, favTeamBonus } from './points';

export async function resolveMatch(matchId: string): Promise<{ updated: number }> {
  const match = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      predictions: { include: { user: { select: { favoriteTeam: true } } } },
    },
  });

  if (match.homeScore === null || match.awayScore === null) return { updated: 0 };

  const result90 = { homeScore: match.homeScore, awayScore: match.awayScore };
  const isKnockout = match.stage !== 'GROUP';
  let updated = 0;

  // Paso 1: calcular base + ko + fav para cada predicción
  type PredResult = {
    pred:         typeof match.predictions[number];
    base:         number;
    koBonus:      number;
    favBonus:     number;
    closestBonus: number;
    total:        number;
  };

  const predResults: PredResult[] = match.predictions.map(pred => {
    const base = baseMatchPoints(pred, result90);

    let koBonus = 0;
    if (isKnockout && match.knockoutWinnerId && match.knockoutMethod) {
      koBonus = knockoutBonus(
        {
          winnerId:    pred.knockoutWinnerId,
          method:      pred.knockoutMethod,
          etHomeScore: pred.etHomeScore,
          etAwayScore: pred.etAwayScore,
        },
        {
          winnerId:    match.knockoutWinnerId,
          method:      match.knockoutMethod,
          etHomeScore: match.etHomeScore ?? null,
          etAwayScore: match.etAwayScore ?? null,
        },
        base
      );
    }

    const favB = favTeamBonus(
      pred.user.favoriteTeam,
      { home: match.homeTeamId, away: match.awayTeamId },
      result90,
      match.knockoutWinnerId,
      base
    );

    return { pred, base, koBonus, favBonus: favB, closestBonus: 0, total: base + koBonus + favB };
  });

  // Paso 2: closest bonus — solo si nadie acierta el resultado exacto
  const hasExact = predResults.some(r => r.base === 3);
  if (!hasExact && predResults.length > 0) {
    const distances = predResults.map(r => ({
      id:   r.pred.id,
      dist: Math.abs(r.pred.homeScore - result90.homeScore) + Math.abs(r.pred.awayScore - result90.awayScore),
    }));
    const minDist    = Math.min(...distances.map(d => d.dist));
    const closestIds = new Set(distances.filter(d => d.dist === minDist).map(d => d.id));
    for (const r of predResults) {
      if (closestIds.has(r.pred.id)) {
        r.closestBonus = 1;
        r.total       += 1;
      }
    }
  }

  // Paso 3: persistir
  for (const r of predResults) {
    const { pred, base, koBonus, closestBonus, total } = r;
    if (
      pred.points         !== total      ||
      pred.basePoints     !== base       ||
      pred.knockoutPoints !== koBonus    ||
      (pred.closestBonus ?? 0) !== closestBonus
    ) {
      await db.prediction.update({
        where: { id: pred.id },
        data: { basePoints: base, knockoutPoints: koBonus, closestBonus, points: total },
      });
      updated++;
    }
  }

  await db.match.update({ where: { id: matchId }, data: { resolved: true } });
  return { updated };
}

export async function recalculateAll(): Promise<{ matchesProcessed: number; predictionsUpdated: number }> {
  const matches = await db.match.findMany({
    where: { homeScore: { not: null }, awayScore: { not: null } },
    select: { id: true },
  });
  let predictionsUpdated = 0;
  for (const { id } of matches) {
    const { updated } = await resolveMatch(id);
    predictionsUpdated += updated;
  }
  return { matchesProcessed: matches.length, predictionsUpdated };
}
