'use client';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export type LeaderboardRow = {
  id: string;
  name: string;
  favoriteTeam: string | null;
  total: number;
  exact: number;
  winner: number;
  koBonusPts: number;
  closestPts: number;
  extraPts: number;
  pending: number;
  predCount: number;
};

interface Props {
  rows: LeaderboardRow[];
  userId: string;
}

export function LeaderboardTable({ rows, userId }: Props) {
  const router = useRouter();

  return (
    <div className="hidden sm:block overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left">#</th>
            <th className="px-4 py-3 text-left">Jugador</th>
            <th className="px-4 py-3 text-right font-bold">Pts</th>
            <th className="px-4 py-3 text-right hidden sm:table-cell">Exactos</th>
            <th className="px-4 py-3 text-right hidden sm:table-cell">Ganador</th>
            <th className="px-4 py-3 text-right hidden md:table-cell" title="Acierta quién pasa de ronda (+1), método prórroga (+1), marcador ET exacto (+3)">Bonus KO</th>
            <th className="px-4 py-3 text-right hidden md:table-cell">Más cerca</th>
            <th className="px-4 py-3 text-right hidden md:table-cell">Extras</th>
            <th className="px-4 py-3 text-right hidden lg:table-cell">Pendientes</th>
            <th className="px-4 py-3 text-right hidden lg:table-cell">Predicciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((u, i) => {
            const isMe = u.id === userId;
            return (
              <tr
                key={u.id}
                onClick={() => router.push(`/dashboard/${u.id}`)}
                className={`cursor-pointer ${isMe ? 'ranking-me font-medium' : 'hover:bg-accent/50 transition-colors'}`}
              >
                <td className="px-4 py-3 text-muted-foreground">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u.name}
                    {u.favoriteTeam && <span className="text-base">{u.favoriteTeam}</span>}
                    {isMe && <Badge variant="secondary" className="text-xs">Tú</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-bold text-lg">{u.total}</td>
                <td className="px-4 py-3 text-right hidden sm:table-cell text-green-600">{u.exact}</td>
                <td className="px-4 py-3 text-right hidden sm:table-cell text-yellow-600">{u.winner}</td>
                <td className="px-4 py-3 text-right hidden md:table-cell text-blue-600">{u.koBonusPts > 0 ? `+${u.koBonusPts}` : '-'}</td>
                <td className="px-4 py-3 text-right hidden md:table-cell text-orange-500">{u.closestPts > 0 ? `+${u.closestPts}` : '-'}</td>
                <td className="px-4 py-3 text-right hidden md:table-cell text-purple-600">{u.extraPts > 0 ? `+${u.extraPts}` : '-'}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">{u.pending}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">{u.predCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
