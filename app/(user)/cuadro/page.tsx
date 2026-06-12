import { db } from '@/lib/db';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { labelText } from '@/lib/football-api';
import { rowFlagBackground } from '@/lib/flag-colors';
import { BracketScaler } from '@/components/bracket-scaler';

export const revalidate = 300;

type Match = Awaited<ReturnType<typeof db.match.findMany>>[number];
type Team  = { id: string; flag: string; name: string; group: string };

const BRACKET_STAGES = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER', 'SEMI'] as const;

const STAGE_LABEL: Record<string, string> = {
  ROUND_OF_32: '32avos',
  ROUND_OF_16: 'Octavos',
  QUARTER:     'Cuartos',
  SEMI:        'Semis',
  FINAL:       'Final',
  THIRD:       '3er puesto',
};

const SLOT_PX = 100;
const ARM_W   = 14;

type StandingRow = { teamId: string; flag: string; pts: number; gd: number; gf: number };
type GroupStandings = Map<string, StandingRow[]>;

function projectedTeam(label: string | null, standings: GroupStandings): StandingRow | null {
  if (!label) return null;
  const pos   = parseInt(label[0], 10) - 1;
  const group = label[1];
  if (!group) return null;
  return standings.get(group)?.[pos] ?? null;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TeamRow({
  teamId, label, score, win, teamMap, standings, isBottom,
}: {
  teamId: string | null; label: string | null; score: number | null;
  win: boolean; teamMap: Map<string, Team>; standings: GroupStandings; isBottom?: boolean;
}) {
  const team = teamId ? teamMap.get(teamId) : null;
  const proj = !teamId ? projectedTeam(label, standings) : null;
  const bgStyle = teamId
    ? rowFlagBackground(teamId)
    : proj ? rowFlagBackground(proj.teamId) : {};

  return (
    <div
      className={`flex items-center justify-between px-2 py-[5px] gap-1 ${!isBottom ? 'border-b border-border' : ''} ${win ? 'font-bold bg-green-50/80 dark:bg-green-950/30' : ''}`}
      style={bgStyle}
    >
      <div className="flex-1 min-w-0">
        {team ? (
          <span className="flex items-center gap-1 truncate leading-tight text-xs">
            <span className="shrink-0 text-sm leading-none">{team.flag}</span>
            <span className="truncate font-medium">{team.name}</span>
          </span>
        ) : proj ? (
          <div className="leading-tight">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="shrink-0 text-sm leading-none opacity-60">⏱</span>
              <span className="shrink-0">{proj.flag}</span>
              <span className="truncate text-[11px]">{proj.teamId}</span>
            </span>
            {label && (
              <span className="block text-[9px] text-muted-foreground/50 leading-tight">
                {labelText(label)}
              </span>
            )}
          </div>
        ) : label ? (
          <span className="text-[11px] text-muted-foreground font-medium leading-tight truncate block">
            {labelText(label)}
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-[10px]">TBC</span>
        )}
      </div>
      <span className="font-mono shrink-0 text-[11px] font-bold">{score ?? ''}</span>
    </div>
  );
}

function MatchCard({ match, teamMap, standings }: { match: Match | undefined; teamMap: Map<string, Team>; standings: GroupStandings }) {
  if (!match) return <div className="w-36 border border-dashed rounded-md opacity-25 h-[76px]" />;
  const isDone = match.status === 'FINISHED' && match.homeScore !== null;
  const isLive = match.status === 'LIVE';

  return (
    <div className={`w-36 border rounded-md overflow-hidden shadow-sm ${isLive ? 'border-red-400' : 'border-border'}`}>
      <TeamRow
        teamId={match.homeTeamId} label={match.homeLabel}
        score={match.homeScore} win={isDone && match.knockoutWinnerId === match.homeTeamId}
        teamMap={teamMap} standings={standings}
      />
      <TeamRow
        teamId={match.awayTeamId} label={match.awayLabel}
        score={match.awayScore} win={isDone && match.knockoutWinnerId === match.awayTeamId}
        teamMap={teamMap} standings={standings} isBottom
      />
    </div>
  );
}

function ArmLeft({ count, totalH }: { count: number; totalH: number }) {
  return (
    <div className="flex flex-col shrink-0" style={{ height: totalH, width: ARM_W }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col flex-1">
          <div className="flex-1 border-r border-b border-muted-foreground/20 rounded-br-sm" />
          <div className="flex-1 border-r border-t border-muted-foreground/20 rounded-tr-sm" />
        </div>
      ))}
    </div>
  );
}

function ArmRight({ count, totalH }: { count: number; totalH: number }) {
  return (
    <div className="flex flex-col shrink-0" style={{ height: totalH, width: ARM_W }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col flex-1">
          <div className="flex-1 border-l border-b border-muted-foreground/20 rounded-bl-sm" />
          <div className="flex-1 border-l border-t border-muted-foreground/20 rounded-tl-sm" />
        </div>
      ))}
    </div>
  );
}

function RoundColumn({ matches, totalH, teamMap, standings }: { matches: Match[]; totalH: number; teamMap: Map<string, Team>; standings: GroupStandings }) {
  const slotH = totalH / Math.max(matches.length, 1);
  return (
    <div className="flex flex-col shrink-0" style={{ height: totalH }}>
      {matches.map(m => (
        <div key={m.id} className="flex items-center justify-center" style={{ height: slotH }}>
          <MatchCard match={m} teamMap={teamMap} standings={standings} />
        </div>
      ))}
    </div>
  );
}

function ListMatchRow({ match, teamMap, standings }: { match: Match; teamMap: Map<string, Team>; standings: GroupStandings }) {
  const isDone = match.status === 'FINISHED' && match.homeScore !== null;
  const isLive = match.status === 'LIVE';

  function TeamCell({ teamId, label }: { teamId: string | null; label: string | null }) {
    const team = teamId ? teamMap.get(teamId) : null;
    const proj = !teamId ? projectedTeam(label, standings) : null;
    if (team) return (
      <span className="flex items-center gap-1.5">
        <span>{team.flag}</span>
        <span className="font-medium">{team.name}</span>
      </span>
    );
    if (proj) return (
      <div>
        <span className="text-muted-foreground flex items-center gap-1">⏱ {proj.flag} {proj.teamId}</span>
        {label && <span className="text-[10px] text-muted-foreground/50">{labelText(label)}</span>}
      </div>
    );
    return (
      <div>
        {label
          ? <span className="font-medium text-muted-foreground">{labelText(label)}</span>
          : <span className="text-muted-foreground/50">TBC</span>
        }
      </div>
    );
  }

  return (
    <Link href={`/matches/${match.id}`} className="flex items-center justify-between p-3 hover:bg-muted/30 rounded-md transition-colors">
      <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-right text-sm">
          <TeamCell teamId={match.homeTeamId} label={match.homeLabel} />
        </div>
        <span className="font-bold px-2 text-center">
          {isDone || isLive
            ? <span className={isLive ? 'text-red-500' : ''}>{match.homeScore}–{match.awayScore}</span>
            : <span className="text-muted-foreground text-xs">vs</span>
          }
        </span>
        <div className="text-sm">
          <TeamCell teamId={match.awayTeamId} label={match.awayLabel} />
        </div>
      </div>
      <div className="ml-3 flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">
          {match.kickoff.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })}
          {' '}
          {match.kickoff.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}h
        </span>
        {match.group && <span className="text-[10px] text-muted-foreground/60">Grupo {match.group}</span>}
      </div>
      {isLive && <Badge variant="destructive" className="ml-2 text-[10px] animate-pulse">LIVE</Badge>}
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function CuadroPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const isListView = vista === 'lista';

  const [allMatches, teams, groupMatches] = await Promise.all([
    db.match.findMany({ where: { stage: { not: 'GROUP' } }, orderBy: { kickoff: 'asc' } }),
    db.team.findMany({ select: { id: true, flag: true, name: true, group: true } }),
    db.match.findMany({ where: { stage: 'GROUP' }, select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, status: true } }),
  ]);

  const teamMap  = new Map(teams.map(t => [t.id, t]));
  const rowMap   = new Map<string, StandingRow>();

  function getRow(teamId: string): StandingRow {
    if (!rowMap.has(teamId)) {
      const meta = teamMap.get(teamId);
      rowMap.set(teamId, { teamId, flag: meta?.flag ?? '', pts: 0, gd: 0, gf: 0 });
    }
    return rowMap.get(teamId)!;
  }

  for (const m of groupMatches) {
    if (m.homeScore === null || m.awayScore === null) continue;
    if (!m.homeTeamId || !m.awayTeamId) continue;
    const h = getRow(m.homeTeamId); const a = getRow(m.awayTeamId);
    h.gf += m.homeScore; h.gd += m.homeScore - m.awayScore;
    a.gf += m.awayScore; a.gd += m.awayScore - m.homeScore;
    if (m.homeScore > m.awayScore)      { h.pts += 3; }
    else if (m.homeScore < m.awayScore) { a.pts += 3; }
    else                                { h.pts += 1; a.pts += 1; }
  }

  const standings: GroupStandings = new Map();
  for (const t of teams) {
    getRow(t.id);
    if (!standings.has(t.group)) standings.set(t.group, []);
    standings.get(t.group)!.push(rowMap.get(t.id)!);
  }
  for (const [, rows] of standings) rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

  const byStage = allMatches.reduce<Record<string, Match[]>>((acc, m) => {
    (acc[m.stage] ??= []).push(m);
    return acc;
  }, {});

  const hasMatches = allMatches.length > 0;
  if (!hasMatches) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <div className="text-4xl mb-4">🏆</div>
        <p>El cuadro de eliminatorias se activará al terminar la fase de grupos.</p>
      </div>
    );
  }

  const r32   = byStage['ROUND_OF_32'] ?? [];
  const r16   = byStage['ROUND_OF_16'] ?? [];
  const qf    = byStage['QUARTER']     ?? [];
  const sf    = byStage['SEMI']        ?? [];
  const final = byStage['FINAL']?.[0];
  const third = byStage['THIRD']?.[0];

  const activeStages  = BRACKET_STAGES.filter(s => (byStage[s]?.length ?? 0) > 0);
  const toggleHref    = isListView ? '/cuadro' : '/cuadro?vista=lista';
  const hasProjection = allMatches.some(m => !m.homeTeamId || !m.awayTeamId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Eliminatorias</h1>
        <Link href={toggleHref} className="text-sm px-3 py-1.5 rounded-md border hover:bg-accent transition-colors">
          {isListView ? 'Ver esquema' : 'Ver lista'}
        </Link>
      </div>

      {hasProjection && (
        <p className="text-xs text-muted-foreground">
          ⏱ Proyección provisional basada en la clasificación actual de grupos
        </p>
      )}

      {/* ── LIST VIEW ── */}
      {isListView ? (
        <div className="space-y-6">
          {[...activeStages, 'SEMI', 'FINAL', 'THIRD'].filter((s, i, arr) => arr.indexOf(s) === i).map(stage => {
            const stageMatches = byStage[stage] ?? (stage === 'FINAL' && final ? [final] : stage === 'THIRD' && third ? [third] : []);
            if (!stageMatches.length) return null;
            return (
              <div key={stage} className="rounded-lg border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-sm font-semibold">{STAGE_LABEL[stage] ?? stage}</div>
                <div className="divide-y">
                  {stageMatches.map(m => <ListMatchRow key={m.id} match={m} teamMap={teamMap} standings={standings} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── BRACKET VIEW ── */
        <div className="overflow-hidden pb-4">
          <BracketScaler>
            {(() => {
              function halve(arr: Match[]) {
                const mid = Math.ceil(arr.length / 2);
                return [arr.slice(0, mid), arr.slice(mid)] as const;
              }
              const [r32L, r32R] = halve(r32);
              const [r16L, r16R] = halve(r16);
              const [qfL,  qfR]  = halve(qf);
              const [sfL,  sfR]  = halve(sf);
              const leftCols  = activeStages.map(s => ({ ROUND_OF_32: r32L, ROUND_OF_16: r16L, QUARTER: qfL, SEMI: sfL }[s]!));
              const rightCols = [...activeStages].reverse().map(s => ({ ROUND_OF_32: r32R, ROUND_OF_16: r16R, QUARTER: qfR, SEMI: sfR }[s]!));
              const maxPerSide = Math.max(...leftCols.map(c => c.length), 1);
              const totalH     = maxPerSide * SLOT_PX;
              const props = { teamMap, standings };

              return (
                <div className="flex flex-row items-center gap-0">
                  {leftCols.map((col, i) => (
                    <div key={`L${i}`} className="flex flex-row items-center">
                      <RoundColumn matches={col} totalH={totalH} {...props} />
                      {i < leftCols.length - 1 && <ArmLeft count={leftCols[i + 1].length} totalH={totalH} />}
                    </div>
                  ))}
                  {leftCols.length > 0 && <div className="self-stretch w-px bg-muted-foreground/10 mx-1" />}
                  <div className="flex flex-col items-center justify-center gap-4 px-4" style={{ minHeight: totalH }}>
                    <div className="text-center">
                      <span className="text-[10px] tracking-widest uppercase text-muted-foreground block mb-1.5">Final</span>
                      <MatchCard match={final} {...props} />
                    </div>
                    {third && (
                      <div className="text-center">
                        <span className="text-[10px] tracking-widest uppercase text-muted-foreground block mb-1.5">3er puesto</span>
                        <MatchCard match={third} {...props} />
                      </div>
                    )}
                  </div>
                  {rightCols.length > 0 && <div className="self-stretch w-px bg-muted-foreground/10 mx-1" />}
                  {rightCols.map((col, i) => (
                    <div key={`R${i}`} className="flex flex-row items-center">
                      {i > 0 && <ArmRight count={rightCols[i - 1].length} totalH={totalH} />}
                      <RoundColumn matches={col} totalH={totalH} {...props} />
                    </div>
                  ))}
                </div>
              );
            })()}
          </BracketScaler>
        </div>
      )}
    </div>
  );
}
