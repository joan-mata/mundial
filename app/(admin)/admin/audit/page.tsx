import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';

const actionLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
  RESULT_SET:        { label: 'Resultado',       variant: 'success'     },
  RESULT_CLEARED:    { label: 'Borrado',          variant: 'destructive' },
  EXTENSION_GRANTED: { label: 'Prórroga',         variant: 'warning'     },
  EXTENSION_REVOKED: { label: 'Rev. prórroga',    variant: 'outline'     },
  RECALCULATE_ALL:   { label: 'Recálculo',        variant: 'secondary'   },
  USER_CREATED:      { label: 'Usuario creado',   variant: 'success'     },
  USER_DEACTIVATED:  { label: 'Desactivado',      variant: 'destructive' },
  EXTRA_BET_RESOLVED:{ label: 'Extra resuelta',   variant: 'secondary'   },
  FAVORITE_RESET:    { label: 'Reset favorito',   variant: 'outline'     },
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1'));
  const perPage = 20;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      include: { admin: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.auditLog.count(),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>

      <div className="rounded-lg border divide-y text-sm">
        {logs.map(log => {
          const info = actionLabels[log.action] ?? { label: log.action, variant: 'outline' as const };
          return (
            <div key={log.id} className="p-3 flex gap-3 items-start">
              <Badge variant={info.variant} className="text-xs shrink-0 mt-0.5">{info.label}</Badge>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{log.admin.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {log.createdAt.toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <details className="mt-1">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver detalle</summary>
                  <pre className="text-xs bg-muted rounded p-2 mt-1 overflow-x-auto">{JSON.stringify(log.detail, null, 2)}</pre>
                </details>
              </div>
            </div>
          );
        })}
        {logs.length === 0 && <p className="p-4 text-center text-muted-foreground">Sin registros</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && <a href={`?page=${page - 1}`} className="px-3 py-1 rounded border hover:bg-muted text-sm">← Anterior</a>}
          <span className="px-3 py-1 text-sm text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && <a href={`?page=${page + 1}`} className="px-3 py-1 rounded border hover:bg-muted text-sm">Siguiente →</a>}
        </div>
      )}
    </div>
  );
}
