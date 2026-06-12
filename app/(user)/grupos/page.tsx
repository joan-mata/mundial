import { db } from '@/lib/db';

export const revalidate = 120;

type Row = {
  teamId: string; name: string; flag: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; pts: number;
};

export default async function GruposPage() {
  const [teams, matches] = await Promise.all([
    db.team.findMany({ orderBy: { group: 'asc' } }),
    db.match.findMany({
      where: { stage: 'GROUP' },
      orderBy: { kickoff: 'asc' },
    }),
  ]);

  const teamMap = new Map(teams.map(t => [t.id, t]));

  // Build standings from match results
  const rows = new Map<string, Row>();

  function getOrCreate(teamId: string): Row {
    if (!rows.has(teamId)) {
      const t = teamMap.get(teamId);
      rows.set(teamId, { teamId, name: t?.name ?? teamId, flag: t?.flag ?? '', played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 });
    }
    return rows.get(teamId)!;
  }

  for (const m of matches) {
    if (m.homeScore === null || m.awayScore === null) continue;
    if (!m.homeTeamId || !m.awayTeamId) continue;
    const home = getOrCreate(m.homeTeamId);
    const away = getOrCreate(m.awayTeamId);

    home.played++; home.gf += m.homeScore; home.ga += m.awayScore;
    away.played++; away.gf += m.awayScore; away.ga += m.homeScore;

    if (m.homeScore > m.awayScore)      { home.won++;   home.pts += 3; away.lost++; }
    else if (m.homeScore < m.awayScore) { away.won++;   away.pts += 3; home.lost++; }
    else                                { home.drawn++; home.pts += 1; away.drawn++; away.pts += 1; }
  }

  // Ensure all teams appear even with 0 played
  for (const t of teams) getOrCreate(t.id);

  // Group by group letter
  const byGroup = new Map<string, Row[]>();
  for (const t of teams) {
    const r = rows.get(t.id)!;
    if (!byGroup.has(t.group)) byGroup.set(t.group, []);
    byGroup.get(t.group)!.push(r);
  }

  // Sort each group: pts desc, GD desc, GF desc, name asc
  for (const [, arr] of byGroup) {
    arr.sort((a, b) => {
      const byPts = b.pts - a.pts;
      if (byPts !== 0) return byPts;
      const byGD = (b.gf - b.ga) - (a.gf - a.ga);
      if (byGD !== 0) return byGD;
      const byGF = b.gf - a.gf;
      if (byGF !== 0) return byGF;
      return a.name.localeCompare(b.name);
    });
  }

  const hasData = matches.some(m => m.homeScore !== null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fase de grupos</h1>

      {!hasData && (
        <p className="text-muted-foreground text-sm">Los resultados aparecerán aquí conforme se jueguen los partidos.</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([group, arr]) => (
          <div key={group} className="rounded-lg border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 text-sm font-semibold">Grupo {group.replace(/^GROUP_/, '')}</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-1.5 text-left">Equipo</th>
                  <th className="px-2 py-1.5 text-center">PJ</th>
                  <th className="px-2 py-1.5 text-center">G</th>
                  <th className="px-2 py-1.5 text-center">E</th>
                  <th className="px-2 py-1.5 text-center">P</th>
                  <th className="px-2 py-1.5 text-center">GD</th>
                  <th className="px-2 py-1.5 text-center font-bold">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {arr.map((r, i) => (
                  <tr key={r.teamId} className={i < 2 ? 'bg-green-50/40 dark:bg-green-950/20' : ''}>
                    <td className="px-3 py-2 flex items-center gap-1.5">
                      <span>{r.flag}</span>
                      <span className={`truncate ${i < 2 ? 'font-medium' : ''}`}>{r.name}</span>
                    </td>
                    <td className="px-2 py-2 text-center text-muted-foreground">{r.played}</td>
                    <td className="px-2 py-2 text-center">{r.won}</td>
                    <td className="px-2 py-2 text-center">{r.drawn}</td>
                    <td className="px-2 py-2 text-center">{r.lost}</td>
                    <td className="px-2 py-2 text-center">{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</td>
                    <td className="px-2 py-2 text-center font-bold">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
