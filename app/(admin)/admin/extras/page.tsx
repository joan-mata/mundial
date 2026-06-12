import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResolveExtraForm } from '@/components/admin/resolve-extra-form';
import { AdminTeamPickPanel } from '@/components/admin/team-pick-panel';
import { ContestReorder } from '@/components/admin/contest-reorder';

const BET_META: Record<string, string> = {
  WORLD_CUP_WINNER: 'Campeón del Mundial',
  TOP_SCORER:       'Máximo goleador',
  BEST_GOALKEEPER:  'Mejor portero',
};

export default async function AdminExtrasPage() {
  const [contestsRaw, allTeams, settings] = await Promise.all([
    db.teamPickContest.findMany({
      include: { entries: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.team.findMany({ select: { id: true, name: true, flag: true }, orderBy: { name: 'asc' } }),
    db.setting.findMany(),
  ]);

  const sm = new Map(settings.map(s => [s.key, s.value]));
  const storedOrder: string[] = JSON.parse(sm.get('contest_order') ?? '[]');

  // Build unified items: fixed bets + contests, sorted by storedOrder
  const FIXED_KEYS = Object.keys(BET_META);
  const allIds = [
    ...storedOrder,
    ...FIXED_KEYS.filter(k => !storedOrder.includes(k)),
    ...contestsRaw.map(c => c.id).filter(id => !storedOrder.includes(id)),
  ];
  type AdminUnifiedItem =
    | { kind: 'fixed'; id: string }
    | { kind: 'contest'; contest: typeof contestsRaw[0] };
  const unifiedItems: AdminUnifiedItem[] = [];
  for (const id of allIds) {
    if (FIXED_KEYS.includes(id)) { unifiedItems.push({ kind: 'fixed', id }); continue; }
    const c = contestsRaw.find(x => x.id === id);
    if (c) unifiedItems.push({ kind: 'contest', contest: c });
  }

  const reorderItems = unifiedItems.map(item =>
    item.kind === 'fixed'
      ? { id: item.id, label: BET_META[item.id] }
      : { id: item.contest.id, label: item.contest.name }
  );

  const extraPts: Record<string, number> = {
    WORLD_CUP_WINNER: Number(sm.get('extra_pts_WORLD_CUP_WINNER') ?? 10),
    TOP_SCORER:       Number(sm.get('extra_pts_TOP_SCORER')       ?? 5),
    BEST_GOALKEEPER:  Number(sm.get('extra_pts_BEST_GOALKEEPER')  ?? 3),
  };
  const extraOpen: Record<string, boolean> = {
    WORLD_CUP_WINNER: sm.get('extra_open_WORLD_CUP_WINNER') !== 'false',
    TOP_SCORER:       sm.get('extra_open_TOP_SCORER')       !== 'false',
    BEST_GOALKEEPER:  sm.get('extra_open_BEST_GOALKEEPER')  !== 'false',
  };
  const deadline = sm.get('extra_bet_deadline') ?? '2026-07-19T21:00:00Z';

  const bets = await db.extraBet.findMany({
    include: { user: { select: { name: true } } },
    orderBy: [{ type: 'asc' }, { user: { name: 'asc' } }],
  });
  const byType = bets.reduce<Record<string, typeof bets>>((acc, b) => {
    (acc[b.type] ??= []).push(b);
    return acc;
  }, {});

  const contests = unifiedItems.filter(x => x.kind === 'contest').map(x => (x as { kind: 'contest'; contest: typeof contestsRaw[0] }).contest);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Apuestas extra</h1>

      {reorderItems.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Orden de secciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ContestReorder items={reorderItems} />
          </CardContent>
        </Card>
      )}

      {unifiedItems.map(item => {
        if (item.kind === 'fixed') {
          const type = item.id;
          const label = BET_META[type];
          const typeBets = byType[type] ?? [];
          const pts = extraPts[type] ?? 0;
          return (
            <Card key={type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{label}</CardTitle>
                  <Badge variant="secondary">+{pts} pts</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="divide-y text-sm rounded-md border">
                  {typeBets.length === 0 ? (
                    <p className="p-3 text-muted-foreground">Ninguna apuesta registrada</p>
                  ) : typeBets.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3">
                      <div>
                        <span className="font-medium">{b.user.name}</span>
                        <span className="text-muted-foreground ml-2">→ {b.value}</span>
                      </div>
                      {b.resolved
                        ? <Badge variant={(b.points ?? 0) > 0 ? 'default' : 'outline'}>{b.points ?? 0} pts</Badge>
                        : <Badge variant="outline">Pendiente</Badge>
                      }
                    </div>
                  ))}
                </div>
                <ResolveExtraForm type={type} betIds={typeBets.map(b => ({ id: b.id, value: b.value }))} awardPts={pts} />
              </CardContent>
            </Card>
          );
        }
        // Contest card is rendered by AdminTeamPickPanel — we pass contests in order
        return null;
      })}

      <AdminTeamPickPanel
        contests={contests}
        allTeams={allTeams}
        extraPts={extraPts}
        extraOpen={extraOpen}
        deadline={deadline}
      />
    </div>
  );
}
