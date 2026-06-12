import { db } from './db';

export async function effectiveDeadline(matchId: string, userId: string): Promise<Date> {
  const [individual, global_, match] = await Promise.all([
    db.predictionExtension.findFirst({ where: { matchId, userId } }),
    db.predictionExtension.findFirst({ where: { matchId, userId: null } }),
    db.match.findUniqueOrThrow({ where: { id: matchId }, select: { kickoff: true } }),
  ]);
  if (individual) return individual.newDeadline;
  if (global_)   return global_.newDeadline;
  return new Date(match.kickoff.getTime() - 60_000);
}

export async function canPredict(matchId: string, userId: string): Promise<boolean> {
  const deadline = await effectiveDeadline(matchId, userId);
  return new Date() < deadline;
}
