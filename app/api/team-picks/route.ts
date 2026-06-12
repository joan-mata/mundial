import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contests = await db.teamPickContest.findMany({
    orderBy: { createdAt: 'desc' },
  });
  const entries = await db.teamPickEntry.findMany({
    where: { userId: session.user.id },
    select: { contestId: true, teamIds: true, points: true },
  });
  const myMap = new Map(entries.map(e => [e.contestId, e]));

  return NextResponse.json({ contests, myPicks: Object.fromEntries(myMap) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role === 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { contestId, teamIds } = await req.json() as { contestId: string; teamIds: string[] };
  if (!contestId || !Array.isArray(teamIds) || teamIds.length === 0) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (teamIds.length > 2) {
    return NextResponse.json({ error: 'Máximo 2 equipos' }, { status: 400 });
  }

  const contest = await db.teamPickContest.findUnique({ where: { id: contestId } });
  if (!contest) return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
  if (!contest.open) return NextResponse.json({ error: 'Contest is closed' }, { status: 400 });
  for (const tid of teamIds) {
    if (!contest.teamIds.includes(tid)) {
      return NextResponse.json({ error: `Team ${tid} not in pool` }, { status: 400 });
    }
  }

  const entry = await db.teamPickEntry.upsert({
    where: { contestId_userId: { contestId, userId: session.user.id } },
    create: { contestId, userId: session.user.id, teamIds },
    update: { teamIds },
  });

  return NextResponse.json(entry);
}
