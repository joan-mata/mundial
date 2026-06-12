# Setup & Deploy — Mundial 2026

Todo lo que hay que hacer, en orden, sin inspeccionar código.

---

## 1. Obtener credenciales externas (una sola vez)

### football-data.org (datos del Mundial)
1. Ir a https://www.football-data.org/client/register
2. Registrarse con cualquier email
3. Ir al email → confirmar cuenta
4. Volver a la web → "My Account" → copiar **API Token**
5. Guardarlo: es el valor de `FOOTBALL_API_KEY`

### Telegram Bot
1. Abrir Telegram → buscar `@BotFather`
2. Enviar `/newbot`
3. Nombre del bot: `Mundial 2026` (o el que quieras)
4. Username: `mundial2026_tuapellido_bot` (debe acabar en `_bot`)
5. BotFather responde con el token → guardarlo: es `TELEGRAM_TOKEN`
6. **Opcional — para vincular chat IDs de usuarios:**
   - Añadir `TELEGRAM_LINK_MODE=true` al `.env` temporalmente
   - Cada usuario escribe `/start` al bot → recibe su chat ID
   - El admin lo introduce en `/admin/users/[id]`
   - Volver a poner `TELEGRAM_LINK_MODE=false` cuando todos estén vinculados

---

## 2. Configurar el .env en el servidor

```bash
cd /ruta/al/mundial
cp .env.example .env
nano .env   # o vim, o el editor que uses
```

Rellenar **todos** estos valores:

```env
# Contraseña de la base de datos (inventa una fuerte, solo para Docker interno)
DB_PASSWORD=pon_aqui_algo_largo_y_aleatorio

# Secreto de NextAuth — genera con el comando de abajo
AUTH_SECRET=

# Token de football-data.org
FOOTBALL_API_KEY=el_token_que_copiaste

# Token del bot de Telegram
TELEGRAM_TOKEN=el_token_de_botfather
TELEGRAM_LINK_MODE=false

# Secreto para los cron jobs — genera con el comando de abajo
CRON_SECRET=

# URL pública del sitio (ya tienes el dominio)
NEXT_PUBLIC_APP_URL=https://mundial.joanmata.com

# Tu usuario admin (el que usarás para entrar)
ADMIN_EMAIL=joan.mata.jmp@gmail.com
ADMIN_PASSWORD=pon_una_contraseña_fuerte
ADMIN_NAME=Joan
```

**Generar AUTH_SECRET y CRON_SECRET** (ejecutar dos veces, uno para cada uno):
```bash
openssl rand -base64 32
```

La URL de la base de datos se deja tal cual — Docker la resuelve internamente:
```env
DATABASE_URL=postgresql://mundial:${DB_PASSWORD}@mundial-db:5432/mundial
```
> Si el .env.example ya tiene esa línea, no hay que cambiarla.

---

## 3. Primera vez: build y arranque

```bash
# Desde la carpeta /mundial en el servidor
docker compose up -d --build
```

Esperar a que termine (puede tardar 2-3 minutos la primera vez).

Verificar que los contenedores están corriendo:
```bash
docker ps | grep mundial
```
Deben aparecer `mundial` y `mundial-db` con estado `Up`.

---

## 4. Primera vez: migrar la base de datos y cargar datos

```bash
# Crear las tablas
docker exec mundial npx prisma migrate deploy

# Crear el usuario admin + cargar partidos y equipos desde football-data.org
docker exec mundial npm run db:seed
```

El seed imprime cuántos equipos y partidos se cargaron. Si `FOOTBALL_API_KEY` no está bien, imprime un aviso y continúa sin partidos (se pueden cargar después).

---

## 5. Verificar que funciona

```bash
# Ver logs en tiempo real
docker logs mundial -f

# Probar que responde
curl -I https://mundial.joanmata.com
```

Abrir https://mundial.joanmata.com en el navegador → debe aparecer el login.

Entrar con el email y contraseña del admin que pusiste en `.env`.

---

## 6. Cargar partidos si el seed no los cargó

Si el seed no pudo conectar a la API (imprimió un warning), cargar manualmente:

```bash
curl -X POST https://mundial.joanmata.com/api/cron/sync-fixture \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

Reemplazar `TU_CRON_SECRET` con el valor de `CRON_SECRET` del `.env`.

También se puede hacer desde el panel admin → botón "Forzar sync con API".

---

## 7. Crear usuarios para los amigos

Desde el panel admin → **Usuarios** → "Crear nuevo usuario":
- Nombre
- Email
- Contraseña inicial (se la mandas por WhatsApp/Telegram)

Cada usuario puede cambiar su contraseña desde `/profile` (si añades esa funcionalidad; si no, el admin la cambia desde el panel).

---

## 8. Vincular Telegram (opcional pero recomendado)

Para que los usuarios reciban notificaciones:

1. Poner `TELEGRAM_LINK_MODE=true` en `.env`
2. Reiniciar: `docker compose restart mundial-app`
3. Cada usuario escribe `/start` al bot → recibe un número (su chat ID)
4. El usuario le manda ese número al admin
5. Admin va a `/admin/users/[nombre]` → campo "Telegram Chat ID" → guardar
6. Cuando todos estén vinculados:
   - Poner `TELEGRAM_LINK_MODE=false` en `.env`
   - `docker compose restart mundial-app`

---

## Comandos de mantenimiento habituales

```bash
# Ver logs
docker logs mundial -f
docker logs mundial-db -f

# Reiniciar la app (ej. tras cambiar .env)
docker compose restart mundial-app

# Forzar sync de resultados manualmente
curl -X POST https://mundial.joanmata.com/api/cron/sync-results \
  -H "Authorization: Bearer TU_CRON_SECRET"

# Forzar sync del fixture (cruces eliminatorias, etc.)
curl -X POST https://mundial.joanmata.com/api/cron/sync-fixture \
  -H "Authorization: Bearer TU_CRON_SECRET"

# Backup manual de la base de datos
docker exec mundial-db pg_dump -U mundial mundial > backup_$(date +%Y%m%d_%H%M).sql

# Acceder a la base de datos directamente
docker exec -it mundial-db psql -U mundial -d mundial

# Recalcular todos los puntos (también disponible en el panel admin)
curl -X POST https://mundial.joanmata.com/api/admin/recalculate \
  -H "Cookie: next-auth.session-token=TU_SESSION_TOKEN"
  # (más fácil usar el botón del panel admin)
```

---

## Si hay que actualizar el código

```bash
cd /ruta/al/mundial
git pull   # si está en git

# Rebuild y reiniciar
docker compose up -d --build mundial-app

# Si hubo cambios en el schema de la base de datos
docker exec mundial npx prisma migrate deploy
```

---

## Backup automático (añadir al crontab del servidor host)

```bash
crontab -e
```

Añadir esta línea (backup a las 4:00 AM):
```
0 4 * * * docker exec mundial-db pg_dump -U mundial mundial | gzip > /backups/mundial_$(date +\%Y\%m\%d).sql.gz
```

Crear la carpeta si no existe:
```bash
mkdir -p /backups
```

---

## Apuestas extra al final del torneo

Cuando termine el Mundial, en el panel admin → **Apuestas Extra**:
1. Para cada tipo (Campeón, Goleador, Portero):
   - Escribir el valor correcto en el campo (ej. `ESP` para España, o `Mbappé`)
   - Pulsar "Resolver"
2. Los puntos se asignan automáticamente a quien acertó

---

## Resolución de resultados

**Automática (durante el torneo):** El cron se ejecuta cada 5 minutos entre las 14:00 y las 23:59 UTC y actualiza los resultados desde football-data.org.

**Manual (si la API falla o llega antes por mensaje):**
1. Panel admin → **Partidos** → click en el partido
2. Rellenar el marcador y cambiar estado a "Finalizado"
3. Pulsar "Guardar resultado"
4. Los puntos se calculan automáticamente y se envían notificaciones por Telegram

**Si se corrigió un resultado después de calcular los puntos:**
1. Corregir el resultado en el panel admin
2. Panel admin → inicio → "Recalcular ahora" → confirmar

---

## Prórrogas de predicción

Si alguien avisa por mensaje que no puede entrar antes del partido:

1. Panel admin → **Partidos** → click en el partido concreto
2. Sección "Prórrogas de predicción" → formulario
3. Seleccionar el usuario (o "Todos" si aplica a todos)
4. Poner el nuevo deadline (máximo kickoff + 2h)
5. Escribir el motivo (ej. "Avisó por WhatsApp que estaba en el tren")
6. Pulsar "Conceder prórroga"

El usuario verá en su formulario que el plazo está extendido.
