# BUILD TASK — Mundial 2026 Prediction App

Construye esta aplicación **desde cero** en el directorio actual. Es una quiniela privada para el Mundial FIFA 2026 (11 jun – 19 jul 2026, 48 equipos). El grupo es ~10 personas, acceso solo por invitación gestionado por un admin. Deploy en `mundial.joanmata.com` sobre Docker + nginx-proxy existente.

Sigue el orden de implementación del final. Construye todo lo especificado, no añadas funcionalidad no descrita.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, TypeScript strict) |
| Base de datos | PostgreSQL 16 + Prisma ORM |
| Auth | NextAuth.js v5, credentials provider, sesiones JWT |
| Estilos | Tailwind CSS v4 + shadcn/ui, mobile-first, dark mode |
| Notificaciones | node-telegram-bot-api |
| Datos fútbol | football-data.org REST API v4 (tier gratuito) |
| Cron | node-cron dentro del proceso Next.js |
| Deploy | Docker Compose, proxy-net, VIRTUAL_HOST=mundial.joanmata.com |

---

## Estructura de carpetas

```
app/
  (auth)/
    login/page.tsx
  (user)/
    layout.tsx                  # sidebar nav, session guard
    dashboard/page.tsx          # clasificación general
    matches/
      page.tsx                  # lista de partidos
      [id]/page.tsx             # detalle + formulario predicción
    bracket/page.tsx            # árbol eliminatorios visual
    extras/page.tsx             # apuestas especiales
    profile/page.tsx            # equipo favorito, telegram chat id
  (admin)/
    layout.tsx                  # guard role=ADMIN
    admin/
      page.tsx                  # panel principal + botón recálculo global
      users/
        page.tsx                # tabla usuarios
        [id]/page.tsx           # editar usuario, reset favorito, ver predicciones
      matches/
        page.tsx                # tabla partidos + sync manual
        [id]/page.tsx           # editar resultado + gestionar prórrogas
      extras/page.tsx           # resolver apuestas especiales
      audit/page.tsx            # log de acciones admin
  api/
    auth/[...nextauth]/route.ts
    predictions/
      route.ts                  # POST crear/editar predicción
      [id]/route.ts             # DELETE
    admin/
      matches/[id]/
        result/route.ts         # PUT resultado manual
        extension/route.ts      # POST/DELETE prórroga
      recalculate/route.ts      # POST recálculo global
      users/route.ts            # POST crear usuario
      users/[id]/route.ts       # PUT/DELETE
      extras/[id]/resolve/route.ts
    cron/
      sync-results/route.ts     # protegido con CRON_SECRET
      sync-fixture/route.ts
      reminders/route.ts

components/
  ui/                           # shadcn components
  match-card.tsx
  prediction-form.tsx
  countdown.tsx
  leaderboard-table.tsx
  bracket-tree.tsx
  admin/
    result-form.tsx
    extension-form.tsx
    recalculate-button.tsx
    audit-log.tsx

lib/
  db.ts                         # singleton PrismaClient
  auth.ts                       # NextAuth config
  telegram.ts                   # wrapper bot
  football-api.ts               # cliente football-data.org con rate limit
  points.ts                     # cálculo de puntos
  recalculate.ts                # recálculo global idempotente
  deadline.ts                   # lógica efectivePredictionDeadline
  cron.ts                       # inicialización cron jobs
  audit.ts                      # escritura audit log

prisma/
  schema.prisma
  seed.ts                       # 48 equipos + partidos fase grupos + admin user

Dockerfile
docker-compose.yml
.env.example
next.config.ts
middleware.ts
```

---

## Schema Prisma completo

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role        { ADMIN USER }
enum Stage       { GROUP ROUND_OF_32 ROUND_OF_16 QUARTER SEMI THIRD FINAL }
enum MatchStatus { SCHEDULED LIVE FINISHED POSTPONED }
// Cómo se decidió el partido tras empate a 90' (solo eliminatorias)
enum KnockoutMethod { EXTRA_TIME PENALTIES }
enum ExtraBetType {
  WORLD_CUP_WINNER   // puntos: 10
  TOP_SCORER         // puntos: 5
  BEST_GOALKEEPER    // puntos: 3
}
enum AuditAction {
  RESULT_SET
  RESULT_CLEARED
  EXTENSION_GRANTED
  EXTENSION_REVOKED
  RECALCULATE_ALL
  USER_CREATED
  USER_DEACTIVATED
  EXTRA_BET_RESOLVED
  FAVORITE_RESET
}

model User {
  id             String   @id @default(cuid())
  name           String
  email          String   @unique
  passwordHash   String
  telegramChatId String?
  role           Role     @default(USER)
  favoriteTeam   String?  // code equipo, elegido una sola vez
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())

  predictions  Prediction[]
  extraBets    ExtraBet[]
  extensions   PredictionExtension[]
  auditActions AuditLog[]            @relation("AuditAdmin")
}

model Team {
  id    String @id   // "ESP", "FRA", "USA", etc.
  name  String
  group String        // "A".."L"
  flag  String        // emoji bandera
}

model Match {
  id         String      @id @default(cuid())
  homeTeamId String?     // null hasta que se conoce el cruce en eliminatorias
  awayTeamId String?
  kickoff    DateTime
  stage      Stage
  group      String?     // null si es eliminatoria
  venueCity  String

  // Resultado a 90' (siempre; en eliminatorias puede ser empate)
  homeScore  Int?
  awayScore  Int?

  // Resultado en prórroga (solo si knockoutMethod=EXTRA_TIME)
  etHomeScore Int?       // marcador acumulado tras prórroga (ej. 2 si 1-1 → 2-1 en ET)
  etAwayScore Int?

  // Cómo se decidió el cruce si hubo empate a 90'
  knockoutMethod   KnockoutMethod?  // EXTRA_TIME o PENALTIES
  knockoutWinnerId String?          // equipo que avanza (tras ET o penaltis)

  status     MatchStatus @default(SCHEDULED)
  externalId String?     @unique
  resolved   Boolean     @default(false)
  updatedAt  DateTime    @updatedAt

  predictions Prediction[]
  extensions  PredictionExtension[]
  auditLogs   AuditLog[]
}

model Prediction {
  id        String   @id @default(cuid())
  userId    String
  matchId   String

  // Predicción a 90' (obligatoria para todos los partidos)
  homeScore Int
  awayScore Int

  // Predicción de eliminatoria (solo cuando stage != GROUP y el usuario predice empate a 90')
  // Si homeScore == awayScore, estos campos son obligatorios en eliminatorias
  knockoutWinnerId String?         // equipo que cree que avanza
  knockoutMethod   KnockoutMethod? // ET o penaltis
  etHomeScore      Int?            // marcador que cree que habrá tras ET (acumulado)
  etAwayScore      Int?

  // Puntos desglosados
  basePoints     Int?  // 0/1/3 por resultado a 90'
  knockoutPoints Int?  // bonus por knockout prediction (0-6)
  points         Int?  // total = basePoints + knockoutPoints + favTeamBonus

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)

  @@unique([userId, matchId])
}

// Prórroga de predicción: admin extiende el deadline para un usuario concreto
// userId null = aplica a TODOS los usuarios del partido
model PredictionExtension {
  id          String   @id @default(cuid())
  matchId     String
  userId      String?  // null = extensión global para el partido
  newDeadline DateTime // nueva fecha límite que sustituye al kickoff-60s
  reason      String?  // nota del admin (visible en el log)
  createdAt   DateTime @default(now())
  createdById String   // userId del admin que concedió la prórroga

  match     Match  @relation(fields: [matchId], references: [id], onDelete: Cascade)
  user      User?  @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@unique([matchId, userId])  // una prórroga por usuario por partido; null = global
}

model ExtraBet {
  id       String       @id @default(cuid())
  userId   String
  type     ExtraBetType
  value    String       // teamId o nombre del jugador
  points   Int?
  resolved Boolean      @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type])
}

model AuditLog {
  id        String      @id @default(cuid())
  action    AuditAction
  adminId   String
  matchId   String?
  detail    Json        // datos del cambio (before/after, reason, etc.)
  createdAt DateTime    @default(now())

  admin Admin User  @relation("AuditAdmin", fields: [adminId], references: [id])
  match Match? @relation(fields: [matchId], references: [id], onDelete: SetNull)
}
```

---

## `lib/deadline.ts` — deadline efectivo de predicción

```typescript
import { db } from './db';

// Retorna la fecha límite efectiva para que userId ponga su predicción en matchId.
// Prioridad: prórroga individual > prórroga global > kickoff - 60s (default).
export async function effectiveDeadline(matchId: string, userId: string): Promise<Date> {
  const [individual, global, match] = await Promise.all([
    db.predictionExtension.findUnique({ where: { matchId_userId: { matchId, userId } } }),
    db.predictionExtension.findUnique({ where: { matchId_userId: { matchId, userId: null } } }),
    db.match.findUniqueOrThrow({ where: { id: matchId }, select: { kickoff: true } }),
  ]);

  if (individual) return individual.newDeadline;
  if (global)     return global.newDeadline;
  return new Date(match.kickoff.getTime() - 60_000);
}

export async function canPredict(matchId: string, userId: string): Promise<boolean> {
  const deadline = await effectiveDeadline(matchId, userId);
  return new Date() < deadline;
}
```

---

## `lib/points.ts` — cálculo de puntos

```typescript
import type { KnockoutMethod } from '@prisma/client';

// ─── Puntos base (aplica a todos los partidos, fase de grupos y eliminatorias) ──
// En eliminatorias el resultado a 90' puede ser empate aunque luego alguien avance.
// "predijo empate y hubo empate a 90'" = 1 punto, igual que en grupos.
export function baseMatchPoints(
  pred: { homeScore: number; awayScore: number },
  result90: { homeScore: number; awayScore: number }
): number {
  if (pred.homeScore === result90.homeScore && pred.awayScore === result90.awayScore) return 3;
  if (Math.sign(pred.homeScore - pred.awayScore) === Math.sign(result90.homeScore - result90.awayScore)) return 1;
  return 0;
}

// ─── Bonus de eliminatoria ────────────────────────────────────────────────────
// Solo se evalúa si:
//   a) El partido es eliminatoria (stage != GROUP)
//   b) El resultado a 90' fue empate
//   c) El usuario predijo empate a 90' (basePoints >= 1)
//   d) El usuario rellenó knockoutWinnerId en su predicción
//
// Tabla de bonus:
//   +2  predijo correctamente quién avanza
//   +1  predijo correctamente el método (ET o penaltis)  — acumulable con +2
//   +3  predijo el marcador exacto tras la prórroga (etHomeScore/etAwayScore exactos)
//       — acumulable con los anteriores, solo si knockoutMethod=EXTRA_TIME
//
// Máximo bonus knockout = 6 pts (avanza + ET + marcador ET exacto)
export type KnockoutResult = {
  winnerId: string;                  // equipo que avanzó
  method: KnockoutMethod;            // EXTRA_TIME | PENALTIES
  etHomeScore: number | null;        // marcador tras ET (null si fueron penaltis directos)
  etAwayScore: number | null;
};

export type KnockoutPrediction = {
  winnerId: string | null;
  method: KnockoutMethod | null;
  etHomeScore: number | null;
  etAwayScore: number | null;
};

export function knockoutBonus(
  pred: KnockoutPrediction,
  actual: KnockoutResult,
  basePoints: number       // si es 0 el usuario no predijo empate a 90', no aplica bonus
): number {
  if (basePoints === 0 || !pred.winnerId) return 0;

  let bonus = 0;

  // +2 por avanzada correcta
  if (pred.winnerId === actual.winnerId) {
    bonus += 2;

    // +1 por método correcto (solo si acertó al ganador)
    if (pred.method === actual.method) {
      bonus += 1;

      // +3 por marcador exacto en prórroga (solo si fue ET y acertó método)
      if (
        actual.method === 'EXTRA_TIME' &&
        pred.etHomeScore !== null && pred.etAwayScore !== null &&
        actual.etHomeScore !== null && actual.etAwayScore !== null &&
        pred.etHomeScore === actual.etHomeScore &&
        pred.etAwayScore === actual.etAwayScore
      ) {
        bonus += 3;
      }
    }
  }

  return bonus;
}

// ─── Bonus equipo favorito ────────────────────────────────────────────────────
// +1 si el equipo favorito del usuario juega el partido,
//    el usuario acertó algo (basePoints > 0) y el favorito avanzó/ganó.
// En eliminatorias "ganó" = knockoutWinnerId si hubo empate a 90',
//    o el ganador normal si no hubo empate.
export function favTeamBonus(
  favoriteTeam: string | null,
  teams: { home: string | null; away: string | null },
  result90: { homeScore: number; awayScore: number },
  knockoutWinnerId: string | null,
  basePoints: number
): number {
  if (!favoriteTeam || basePoints === 0) return 0;
  if (teams.home !== favoriteTeam && teams.away !== favoriteTeam) return 0;

  // Determinar ganador real: primero knockout (si hay empate a 90'), si no el ganador en 90'
  const winner90 = result90.homeScore > result90.awayScore ? teams.home
    : result90.awayScore > result90.homeScore ? teams.away
    : null; // empate a 90'

  const realWinner = winner90 ?? knockoutWinnerId;
  return realWinner === favoriteTeam ? 1 : 0;
}
```

---

## `lib/recalculate.ts` — recálculo global idempotente

Esta función se llama desde el botón del admin y también desde `resolveMatch`. Es completamente idempotente: puede correr varias veces sin duplicar puntos.

```typescript
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

  for (const pred of match.predictions) {
    const base = baseMatchPoints(pred, result90);

    // Bonus knockout: solo si eliminatoria, hubo empate a 90' y el match tiene knockoutWinnerId
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

    const favBonus = favTeamBonus(
      pred.user.favoriteTeam,
      { home: match.homeTeamId, away: match.awayTeamId },
      result90,
      match.knockoutWinnerId,
      base
    );

    const total = base + koBonus + favBonus;
    if (pred.points !== total || pred.basePoints !== base || pred.knockoutPoints !== koBonus) {
      await db.prediction.update({
        where: { id: pred.id },
        data: { basePoints: base, knockoutPoints: koBonus, points: total },
      });
      updated++;
    }
  }

  await db.match.update({ where: { id: matchId }, data: { resolved: true } });
  return { updated };
}

// Recalcula TODOS los partidos con resultado (idempotente).
// Llamado desde POST /api/admin/recalculate
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
```

---

## API routes clave

### `POST /api/admin/matches/[id]/result` — resultado manual

```typescript
// body: { homeScore: number, awayScore: number, status: MatchStatus }
// Solo ADMIN. Tras guardar, llama resolveMatch(id) automáticamente.
// Registra en AuditLog con before/after.
// Si status === 'SCHEDULED' y scores null → limpia el resultado (RESULT_CLEARED).
```

### `POST /api/admin/matches/[id]/extension` — conceder prórroga

```typescript
// body: { userId: string | null, newDeadline: string (ISO), reason?: string }
// userId null = prórroga global para todos en ese partido.
// Registra AuditLog action=EXTENSION_GRANTED con { matchId, userId, newDeadline, reason }.
// Upsert: si ya existe una prórroga para ese userId+matchId, la sobreescribe.
```

### `DELETE /api/admin/matches/[id]/extension` — revocar prórroga

```typescript
// body: { userId: string | null }
// Elimina la PredictionExtension. Registra EXTENSION_REVOKED.
```

### `POST /api/admin/recalculate` — recálculo global

```typescript
// Sin body. Llama recalculateAll(), registra AuditLog action=RECALCULATE_ALL.
// Devuelve { matchesProcessed, predictionsUpdated }.
// Protegido: solo ADMIN.
```

### `POST /api/predictions` — crear/editar predicción (usuario)

```typescript
// body: { matchId, homeScore, awayScore }
// 1. Verificar sesión activa
// 2. canPredict(matchId, userId) → si false: 403 con mensaje "Plazo cerrado"
// 3. Upsert en Prediction
```

---

## Panel admin — `/admin/matches/[id]`

Esta página es la más compleja del admin. Debe tener:

**Sección: Resultado del partido**
- Formulario con inputs `homeScore` / `awayScore` y selector de `status`
- Botón "Guardar resultado" → PUT a `/api/admin/matches/[id]/result`
- Tras guardar muestra: partidos procesados, predicciones actualizadas
- Si el partido ya está resuelto, lo indica claramente con badge

**Sección: Prórrogas de predicción**
- Tabla con todas las prórrogas activas del partido: usuario (o "Todos"), nuevo deadline, motivo, admin que la concedió
- Formulario "Nueva prórroga":
  - Select: usuario concreto (lista desplegable) o "Todos los usuarios"
  - DateTimePicker: nuevo deadline (mínimo = ahora, máximo = kickoff + 2h)
  - Input texto: motivo (obligatorio, max 200 chars)
  - Botón "Conceder prórroga"
- Por cada fila de prórroga activa: botón "Revocar" → DELETE con confirmación

**Sección: Predicciones recibidas**
- Tabla de solo lectura: usuario, predicción, puntos asignados, tiene prórroga (badge)

---

## Panel admin — `/admin` (panel principal)

**Card: Recálculo global de puntos**

```
┌─────────────────────────────────────────────────────┐
│  Recalcular todos los puntos                        │
│                                                     │
│  Vuelve a calcular puntos para todos los partidos   │
│  con resultado. Operación idempotente y segura.     │
│  Útil si se corrigió un resultado manualmente.      │
│                                                     │
│  [Últ. ejecución: 10 jun 2026 22:14]               │
│                           [ Recalcular ahora → ]   │
└─────────────────────────────────────────────────────┘
```

- El botón muestra spinner durante la petición
- Al completar: toast con "X partidos procesados, Y predicciones actualizadas"
- Guarda timestamp de última ejecución en localStorage (solo UI, no DB)
- El botón requiere confirmación: dialog "¿Seguro? Esto sobrescribirá todos los puntos calculados."

**Card: Estado del sistema**
- Partidos hoy con resultado: X/Y
- Partidos sin resultado pendientes de hoy: lista
- Último sync con football-data.org: timestamp
- Botón "Forzar sync ahora" → POST `/api/cron/sync-results` con CRON_SECRET

**Card: Usuarios**
- Tabla compacta: nombre, puntos totales, predicciones realizadas / pendientes de hoy, equipo favorito
- Link "Ver detalle" → `/admin/users/[id]`

---

## Panel admin — `/admin/audit`

Tabla paginada (20 por página) del AuditLog:
- Columnas: fecha, admin, acción, partido afectado, detalle (expandible)
- Filtros: por acción, por admin, por rango de fechas
- Sin paginación infinita, usar offset simple

---

## Predicción en partidos de eliminatoria

Los partidos de fase de grupos terminan siempre en 90'. Las eliminatorias pueden ir a prórroga o penaltis. La predicción tiene **dos partes**:

### Parte 1 — Resultado a 90' (obligatoria, igual que en grupos)
El usuario introduce `homeScore` y `awayScore` como siempre. En eliminatorias es perfectamente válido predecir empate (1-1, 0-0, etc.).

Puntuación base: igual que grupos — 3 pts exacto, 1 pt ganador/empate correcto, 0 fallo.

> Un partido que acaba 1-1 a 90' y luego España gana en penaltis → el usuario que predijo 1-1 **obtiene 1 punto** por el empate correcto, aunque no predijera quién avanza.

### Parte 2 — Predicción de avance (solo cuando homeScore == awayScore en la predicción)
Si el usuario predice empate a 90', aparece una sección adicional en el formulario:

```
¿Cómo se decide el partido?
  ○ Prórroga (ET)
  ○ Penaltis

¿Quién avanza?
  [ selector de equipo ]

Si marcaste Prórroga — ¿Cuál crees que será el marcador tras los 30'?
  Home: [__]  Away: [__]
  (marcador acumulado, ej. si hay 1-1 a 90' y metes 2-1 en ET → pon 2 y 1)
```

Estos campos son **opcionales si el usuario predice victoria directa** (homeScore ≠ awayScore), pero **requeridos si predice empate** en eliminatorias. El formulario lo valida en cliente y servidor.

### Puntuación bonus de eliminatoria

| Acierto | Bonus |
|---------|-------|
| Quién avanza (correcto) | +2 pts |
| Método correcto (ET o pens) | +1 pt |
| Marcador exacto tras ET | +3 pts |

Los bonuses son acumulables. Máximo: **+6 pts** en un partido de eliminatoria (empate a 90' correcto + avanzada + ET + marcador ET exacto = 1+2+1+3 = 7 pts totales).

El bonus **solo aplica si el usuario predijo empate a 90'** y efectivamente hubo empate a 90'. Si predijo 2-1 y el partido acaba 2-1 → solo 3 pts base, no hay knockout bonus.

### Formulario `/matches/[id]` — comportamiento para eliminatorias

```tsx
// components/prediction-form.tsx
// Si match.stage !== 'GROUP' && pred.homeScore === pred.awayScore → mostrar sección knockout
const isKnockout = match.stage !== 'GROUP';
const predictedDraw = homeScore === awayScore;

{isKnockout && predictedDraw && (
  <KnockoutPredictionSection
    teams={{ home: match.homeTeam, away: match.awayTeam }}
    onWinnerChange={setKnockoutWinner}
    onMethodChange={setKnockoutMethod}
    onEtScoreChange={setEtScore}
  />
)}
```

Cuando el usuario cambia los scores y deja de ser empate → ocultar la sección knockout y limpiar esos valores.

### Resultado admin para eliminatorias — `/admin/matches/[id]`

El formulario de resultado tiene sección adicional si `match.stage !== 'GROUP'`:

```
Resultado a 90'
  Local: [__]  Visitante: [__]  Estado: [selector]

━━━ Si hubo empate a 90' ━━━━━━━━━━━━━━━━━━━
Cómo se resolvió:
  ○ Prórroga (ET)
  ○ Penaltis directos

Quién avanzó: [ selector de equipo ]

Si Prórroga — marcador final tras 30':
  Local: [__]  Visitante: [__]
```

El admin rellena estos campos y pulsa "Guardar resultado". El sistema llama `resolveMatch(matchId)` automáticamente con todos los datos.

---

## Reglas de negocio completas

1. **Deadline predicción**: `effectiveDeadline(matchId, userId)` determina la ventana. Por defecto: kickoff - 60s. El admin puede extender por usuario o globalmente.

2. **Resolución de resultado**: Cuando el admin guarda un resultado (o el cron lo detecta via API), se ejecuta `resolveMatch(matchId)` automáticamente.

3. **Recálculo manual**: Botón en `/admin` → recalculateAll() — útil si el admin corrigió un resultado después de que ya se calcularon los puntos.

4. **Notificación post-partido**: Tras `resolveMatch`, se envía Telegram a cada usuario con predicción informando sus puntos desglosados (base + bonus KO + bonus favorito) y total acumulado.

5. **Recordatorio diario**: Cron 20:00 UTC → mensajes individuales por partido del día SIGUIENTE sin predicción del usuario.

6. **Equipo favorito**: Se elige una sola vez (primer submit), luego el campo es read-only para el usuario. El admin puede resetear desde `/admin/users/[id]`.

7. **Apuestas extra**: Abiertas hasta el inicio del primer partido (11 jun 2026 17:00 UTC). Después read-only. El admin las resuelve manualmente en `/admin/extras`.

8. **Usuarios**: Solo el admin crea cuentas. No hay registro público. El admin puede desactivar usuarios (no borrar, para preservar predicciones históricas).

9. **Partido sin equipos definidos** (eliminatorias): Match con homeTeamId/awayTeamId null. No se puede predecir hasta que el sync los rellene. El formulario muestra "Cruces pendientes de confirmación".

10. **Fase de grupos**: No hay campo knockout. El formulario es simple: local [n] - visitante [n].

---

## Cron jobs

```typescript
// lib/cron.ts — se inicializa en app/layout.tsx o en un route handler especial
import cron from 'node-cron';

// Sync resultados: cada 5 min entre las 14:00 y 23:59 UTC
cron.schedule('*/5 14-23 * * *', () =>
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/sync-results`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
);

// Recordatorio predicciones pendientes: 20:00 UTC diario
cron.schedule('0 20 * * *', () =>
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/reminders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
);

// Sync fixture (nuevos cruces eliminatorias): 03:00 UTC diario
cron.schedule('0 3 * * *', () =>
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/sync-fixture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
);
```

Proteger todos los `/api/cron/*` con middleware que valide `Authorization: Bearer ${CRON_SECRET}`.

---

## `lib/football-api.ts` — cliente con rate limit

```typescript
const BASE = 'https://api.football-data.org/v4';
const COMPETITION_ID = 2000; // FIFA World Cup

// Rate limit: 10 req/min en tier gratuito → esperar 6s entre llamadas si es necesario
let lastCall = 0;
async function apiFetch(path: string) {
  const now = Date.now();
  const elapsed = now - lastCall;
  if (elapsed < 6000) await new Promise(r => setTimeout(r, 6000 - elapsed));
  lastCall = Date.now();

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY! },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${path}`);
  return res.json();
}

export const fetchAllMatches   = () => apiFetch(`/competitions/${COMPETITION_ID}/matches`);
export const fetchMatch        = (id: string) => apiFetch(`/matches/${id}`);
export const fetchStandings    = () => apiFetch(`/competitions/${COMPETITION_ID}/standings`);
```

`syncMatchResults` (llamado por cron):
1. Obtener partidos de hoy con status SCHEDULED o LIVE desde DB
2. Para cada uno, `fetchMatch(externalId)` 
3. Si status === 'FINISHED' y tiene scores → actualizar Match en DB → `resolveMatch(matchId)`
4. Si status === 'IN_PLAY' → actualizar status a LIVE (no calcular puntos aún)

`syncFixture` (llamado por cron diario):
1. `fetchAllMatches()` → iterar todos los partidos
2. Upsert por `externalId`: actualizar kickoff, equipos, venue si han cambiado
3. Para eliminatorias con equipos ya definidos que en DB tienen null → rellenar

---

## `lib/telegram.ts`

```typescript
import TelegramBot from 'node-telegram-bot-api';

let _bot: TelegramBot | null = null;
function bot(): TelegramBot {
  if (!_bot) _bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: false });
  return _bot;
}

export type MatchResultNotif = {
  matchDesc: string;    // "España 2-1 Francia (ET)" o "España 2-1 Francia (Pen.)"
  predDesc: string;     // "Predijiste: 1-1 → España ET 2-1"
  basePoints: number;
  knockoutPoints: number;
  favBonus: number;
  totalPoints: number;  // acumulado total del usuario
};

export async function notifyMatchResult(chatId: string, n: MatchResultNotif): Promise<void> {
  const breakdown = [
    `Resultado base: *${n.basePoints} pts*`,
    n.knockoutPoints > 0 ? `Bonus eliminatoria: *+${n.knockoutPoints} pts*` : null,
    n.favBonus > 0       ? `Bonus favorito: *+${n.favBonus} pt*` : null,
  ].filter(Boolean).join('\n');

  await bot().sendMessage(
    chatId,
    `⚽ *${n.matchDesc}*\n_${n.predDesc}_\n\n${breakdown}\n\nTotal acumulado: *${n.totalPoints} pts*`,
    { parse_mode: 'Markdown' }
  );
}

export async function remindMissingPredictions(
  chatId: string,
  matches: Array<{ homeTeam: string; awayTeam: string; kickoff: Date; matchId: string }>
): Promise<void> {
  const lines = matches.map(m => {
    const time = m.kickoff.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    return `• ${m.homeTeam} vs ${m.awayTeam} — ${time}h`;
  });
  await bot().sendMessage(
    chatId,
    `⏰ Partidos de mañana sin tu predicción:\n\n${lines.join('\n')}\n\nhttps://mundial.joanmata.com/matches`,
    { parse_mode: 'Markdown' }
  );
}
```

---

## Telegram — vinculación de chat ID

Añadir handler `/start` al bot (solo en development o al arrancar):
```typescript
// Solo activar si TELEGRAM_LINK_MODE=true en .env
if (process.env.TELEGRAM_LINK_MODE === 'true') {
  bot().on('message', async (msg) => {
    if (msg.text === '/start') {
      await bot().sendMessage(msg.chat.id,
        `Tu chat ID es: \`${msg.chat.id}\`\nDáselo al admin para activar notificaciones.`,
        { parse_mode: 'Markdown' }
      );
    }
  });
}
```

El admin introduce el chat ID manualmente en `/admin/users/[id]`.

---

## Seguridad

- Passwords: `bcrypt` con saltRounds=12
- JWT: `AUTH_SECRET` mínimo 32 bytes (`openssl rand -base64 32`)
- Ownership: todos los endpoints de predicción verifican `session.user.id === userId`
- Cron secret: `Authorization: Bearer ${CRON_SECRET}` en todos los `/api/cron/*`
- Rate limiting en `/api/auth/login`: máximo 10 intentos por IP en 15 minutos (Map en memoria, suficiente para escala pequeña)
- Headers en `next.config.ts`:
  ```typescript
  headers: [{ key: 'X-Frame-Options', value: 'DENY' },
             { key: 'X-Content-Type-Options', value: 'nosniff' },
             { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }]
  ```
- Variables de entorno nunca en imagen Docker, montadas desde `.env` del host
- HTTPS obligatorio vía nginx-proxy + letsencrypt-nginx-proxy-companion

---

## Docker Compose

```yaml
# docker-compose.yml
services:
  mundial-app:
    build: .
    container_name: mundial
    restart: unless-stopped
    env_file: .env
    environment:
      - VIRTUAL_HOST=mundial.joanmata.com
      - LETSENCRYPT_HOST=mundial.joanmata.com
      - LETSENCRYPT_EMAIL=joan.mata.jmp@gmail.com
    networks:
      - proxy-net
      - mundial-internal
    depends_on:
      mundial-db:
        condition: service_healthy

  mundial-db:
    image: postgres:16-alpine
    container_name: mundial-db
    restart: unless-stopped
    env_file: .env
    environment:
      POSTGRES_DB: mundial
      POSTGRES_USER: mundial
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mundial_db_data:/var/lib/postgresql/data
    networks:
      - mundial-internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mundial"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  proxy-net:
    external: true
  mundial-internal:
    driver: bridge

volumes:
  mundial_db_data:
```

```dockerfile
# Dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## `.env.example`

```env
# Base de datos
DB_PASSWORD=change_me_32_chars_minimum

# Auth (genera con: openssl rand -base64 32)
AUTH_SECRET=

# football-data.org — registrarse en https://www.football-data.org/client/register
FOOTBALL_API_KEY=

# Telegram — crear bot con @BotFather, obtener token
TELEGRAM_TOKEN=
# Activar solo para vincular chat IDs, luego desactivar
TELEGRAM_LINK_MODE=false

# Cron secret (genera con: openssl rand -base64 32)
CRON_SECRET=

# URL pública
NEXT_PUBLIC_APP_URL=https://mundial.joanmata.com

# Admin inicial (usado en seed)
ADMIN_EMAIL=joan.mata.jmp@gmail.com
ADMIN_PASSWORD=change_me_strong
ADMIN_NAME=Joan
```

---

## `prisma/seed.ts`

```typescript
// 1. Verificar ADMIN_EMAIL/PASSWORD/NAME en process.env — lanzar error si faltan
// 2. Upsert admin user con bcrypt hash de ADMIN_PASSWORD
// 3. Llamar fetchAllMatches() de football-api.ts
// 4. Upsert cada equipo (id, name, group, flag emoji)
// 5. Upsert cada partido por externalId (stage, kickoff, homeTeamId, awayTeamId, venueCity, status)
// 6. Log del resultado: X equipos, Y partidos insertados/actualizados
```

---

## Rutas y acceso

| Ruta | Acceso | Qué hace |
|------|--------|----------|
| `/login` | público | Login email + password |
| `/dashboard` | user | Clasificación con puntos. Usuario propio destacado. |
| `/matches` | user | Lista todos los partidos. Badge: sin predicción / predicción enviada / cerrado |
| `/matches/[id]` | user | Detalle partido. Formulario si está abierto, resultado si está cerrado. Countdown al deadline. |
| `/bracket` | user | Árbol visual eliminatorios |
| `/extras` | user | Apuestas especiales. Bloqueadas tras primer partido. |
| `/profile` | user | Equipo favorito (read-only si ya elegido), chat ID telegram |
| `/admin` | admin | Panel principal + recálculo global + estado sistema |
| `/admin/users` | admin | Tabla usuarios, crear nuevo, desactivar |
| `/admin/users/[id]` | admin | Editar nombre/email/telegram, reset favorito, ver predicciones |
| `/admin/matches` | admin | Tabla partidos con estado. Botón forzar sync. |
| `/admin/matches/[id]` | admin | Resultado + prórrogas + predicciones recibidas |
| `/admin/extras` | admin | Resolver apuestas especiales |
| `/admin/audit` | admin | Log de acciones admin |

---

## Clasificación (`/dashboard`)

Tabla ordenada por puntos totales DESC. Para cada usuario:
- Nombre + equipo favorito (emoji bandera)
- Puntos totales = suma de `Prediction.points` de predicciones resueltas + ExtraBet points resueltos
- Columnas: #, Nombre, Pts totales, Exactos (3pts), Ganador (1pt), Bonus KO, Bonus Fav, Fallados, Pendientes
- El usuario propio va highlighted con fondo diferente
- Al expandir una fila (mobile: tap, desktop: hover) → mini tabla de sus últimas 5 predicciones con desglose
- La tabla se actualiza con SWR cada 30s

---

## Apuestas extra

| Tipo | Puntos | Deadline | Quién resuelve |
|------|--------|----------|---------------|
| Campeón del Mundial | 10 | Inicio primer partido | Admin tras final |
| Máximo goleador | 5 | Inicio primer partido | Admin tras final |
| Mejor portero | 3 | Inicio primer partido | Admin tras final |

La resolución es manual: admin va a `/admin/extras`, selecciona el valor correcto y pulsa "Resolver". Esto actualiza `ExtraBet.points` y `ExtraBet.resolved` para todos los usuarios.

---

## Orden de implementación (MVP primero)

**Fase 1 — Infraestructura base**
1. `npx create-next-app@latest . --typescript --tailwind --app --src-dir=false`
2. Instalar dependencias: `prisma`, `@prisma/client`, `next-auth@beta`, `bcryptjs`, `node-cron`, `node-telegram-bot-api`, `@types/bcryptjs`
3. Inicializar shadcn: `npx shadcn@latest init` — tema neutral, dark mode class
4. Escribir `prisma/schema.prisma` completo y `prisma/migrations`
5. `lib/db.ts` singleton Prisma
6. `lib/auth.ts` NextAuth credentials + Prisma adapter
7. `middleware.ts` — rutas protegidas + guard admin

**Fase 2 — Auth y usuarios**
8. `/login` — formulario email/password, redirect a `/dashboard`
9. `prisma/seed.ts` — admin user + 48 equipos + partidos via football-data.org
10. `/admin/users` + `/admin/users/[id]` — CRUD usuarios
11. `POST /api/admin/users` — crear usuario (admin only)

**Fase 3 — Core de predicciones**
12. `lib/deadline.ts` + `lib/points.ts` (incluye `baseMatchPoints`, `knockoutBonus`, `favTeamBonus`)
13. `/matches` — lista de partidos con badge estado
14. `/matches/[id]` — formulario predicción fase grupos (simple: homeScore/awayScore)
15. Añadir sección knockout al formulario: aparece si `stage !== GROUP` && predicción es empate
16. `POST /api/predictions` — crear/editar con validación deadline; validar que si es eliminatoria y empate, `knockoutWinnerId` no es null
17. `/profile` — equipo favorito + telegram chat id

**Fase 4 — Admin resultados y prórrogas**
18. `lib/recalculate.ts` — resolveMatch (con knockoutBonus) + recalculateAll
19. `/admin/matches` — tabla + sync manual
20. `/admin/matches/[id]` — sección resultado (90' + ET/penaltis para eliminatorias) + sección prórrogas
21. `PUT /api/admin/matches/[id]/result` — acepta también `knockoutWinnerId`, `knockoutMethod`, `etHomeScore`, `etAwayScore`
22. `POST/DELETE /api/admin/matches/[id]/extension`
23. `POST /api/admin/recalculate` — recálculo global
24. `/admin` — panel principal con botón recálculo + estado sistema
25. `lib/audit.ts` + `/admin/audit`

**Fase 5 — Clasificación y extras**
25. `/dashboard` — clasificación con SWR 30s
26. `/extras` — apuestas especiales
27. `/admin/extras` — resolver apuestas

**Fase 6 — Automatización**
28. `lib/football-api.ts` con rate limit
29. `/api/cron/sync-results` + `/api/cron/sync-fixture` + `/api/cron/reminders`
30. `lib/cron.ts` — inicialización en layout.tsx server component
31. `lib/telegram.ts` — notificaciones post-partido y recordatorios

**Fase 7 — Polish**
32. `/bracket` — árbol visual eliminatorios (SVG o CSS grid)
33. Dark mode, responsive mobile, iconos de equipos
34. Loading states, error boundaries, toasts (sonner)
35. `Dockerfile` + `docker-compose.yml`

---

## Comandos de deploy (primera vez)

```bash
# En el servidor
cd /path/to/mundial
cp .env.example .env
# Editar .env con valores reales

docker compose up -d --build
docker exec mundial npx prisma migrate deploy
docker exec mundial npx prisma db seed

# Verificar
docker logs mundial --tail 50
```

## Backup diario (añadir al crontab del host)

```bash
0 4 * * * docker exec mundial-db pg_dump -U mundial mundial | gzip > /backups/mundial_$(date +\%Y\%m\%d).sql.gz
```
