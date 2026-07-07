# Plan: de herramienta personal a app pública

Estado del análisis: julio 2026. Este documento resume el diagnóstico y el roadmap
acordado para hacer AM Trader publicable, útil y sostenible.

## Diagnóstico

**Lo que ya está listo para público (modo consulta):**
- My Pets (inventario) ✅
- Check Values ✅
- Trade Builder — la mitad consultiva (armar oferta → Find matches → sugerencias) ✅
- Browse Market — la UX está bien, el problema es el backend (ver abajo)

**Lo que NO es shippeable a usuario final (y no tiene arreglo legítimo):**
- **Publish a AMVGG**: requiere que el usuario copie sus cookies de sesión desde
  DevTools, y esas cookies pasan por nuestro server (`api.ts` → `amvgg.com/api/createPost`).
  Pedirle la sesión a un desconocido es inviable; AMVGG no tiene OAuth ni API pública.
- **Publish a Elvebredd**: pegar un script en la consola del navegador (patrón self-XSS).
- **Auto + Loop**: publicar trades en bucle con la sesión del usuario = botting.
  A escala pública: cuentas baneadas + IP de Fly bloqueada (mataría Browse Market).

**Decisión**: separar en dos modos.
- *Versión pública* = solo consulta (Publish/Auto ocultos).
- *Modo avanzado personal* = Publish/Auto detrás de un flag (localStorage o setting oculto).

**Problemas transversales:**
- Valores estáticos: se actualizan solo con `npm run fetch-values` + commit + deploy.
  Los valores cambian seguido → riesgo de recomendar trades malos. **Prioridad #1.**
- Browse Market hace scraping en vivo por cada búsqueda desde la única IP de Fly.
  Con N usuarios: 429s, bloqueo de Cloudflare, un usuario intenso rompe todo.
  Arreglo: cache server-side por `(pet, form)` de 2-5 min.
- Errores crudos en pantalla (monospace) → mensajes amables.
- Inventario solo en localStorage (por dispositivo, se pierde) → sync con login (fase 4).
- Mobile: audiencia mayormente celular/tablet; Trade Builder es 3 columnas desktop.
- Jerga sin explicar (F/R/D/N/M, AMV vs Elve, demand ★, % fairness) → tooltips + mini "cómo funciona".

## Roadmap (en orden)

### Fase 1 — Refresh automático de valores 🔴 prioridad máxima — ✅ IMPLEMENTADA
Sin confianza en los valores, nada más importa.

**Arquitectura final** (mejor que la idea original: ya existía un workflow diario
`refresh-values.yml` que fetchea desde GitHub Actions, commitea y deployaba):

```
GitHub Actions (cada 4 h, runners de GitHub — sin riesgo de IP de Fly)
  └─ fetch-values.mjs          → fetchea AMVGG + Elvebredd
  └─ commit si cambió          → historial de git = archivo de snapshots (Fase 5)
  └─ push-values.mjs           → POST /api/refresh-values (hot-swap, SIN redeploy)
  └─ flyctl deploy             → SOLO como fallback si el push falla
```

- [x] Endpoint `POST /api/refresh-values` (Bearer token, env `REFRESH_TOKEN`):
      recibe los 4 JSON y reemplaza los Maps en memoria en caliente.
- [x] Guardrails: rechaza (422) cualquier sección vacía/parcial (mínimos absolutos
      + no menos de la mitad del cache actual). Nunca pisa un cache bueno.
- [x] Cron de GitHub Actions cada 4 h (`0 */4 * * *`). El push despierta la
      máquina auto-stopped y después vuelve a dormir → compatible con scale-to-zero.
- [x] Persistencia: lo refrescado se escribe en `APP_DATA_DIR` (o `/data` si hay
      volumen de Fly, o `.runtime-data/` local). Al arrancar, el server prefiere
      eso sobre los JSON bundleados → un stop/start no pierde frescura.
- [x] `GET /api/refresh-status` para monitorear (lastRefreshAt + counts).
- [x] Snapshots: cada refresh con cambios queda commiteado en git → el historial
      de `src/data/*.json` es la serie temporal para la Fase 5. (Cuando llegue
      Supabase, migrar a filas en DB.)
- [x] Elvebredd desde IP de Fly: evitado por diseño — el fetch corre en los
      runners de GitHub, no en Fly.
- [x] Smoke test end-to-end: push aplica 750 pets / 735 elve / 666 items,
      payload roto → 422 sin tocar el cache, reinicio carga lo persistido.

**⚙️ Setup pendiente (manual, una sola vez):**
1. Generar token: `openssl rand -hex 32`
2. En Fly: `flyctl secrets set REFRESH_TOKEN=<token>` (esto redeploya solo)
3. En GitHub: Settings → Secrets and variables → Actions → new secret
   `REFRESH_TOKEN` con el mismo valor.
4. (Opcional) Volumen para persistencia total entre deploys:
   `flyctl volumes create data --size 1 --region gru` + `[mounts]` en fly.toml
   (`source="data"`, `destination="/data"`). Sin volumen igual funciona: el peor
   caso tras un deploy es ≤ 4 h de staleness hasta el próximo push.
5. Probar: Actions → "Refresh values" → Run workflow, y verificar
   `https://amtrader.fly.dev/api/refresh-status`.

**Nota**: `npm run lint` está roto (no hay config de ESLint en el repo y eslint
no está en devDependencies — preexistente). Arreglarlo en la Fase 2.

### Fase 2 — Limpieza para público
- [ ] Ocultar Publish / Auto / Loop detrás de un flag (p. ej. `localStorage.advanced_mode`).
- [ ] Cache server-side de `/api/trade/browse` por `(pet, form)`, TTL 2-5 min.
- [ ] Mensajes de error amables (nada de errores crudos en monospace).
- [ ] Responsive/mobile: Trade Builder colapsa a una columna; revisar todas las páginas.
- [ ] Tooltips + página corta de "cómo funciona" (formas, fuentes, demand, fairness).
- [ ] PWA instalable (manifest + service worker básico).

### Fase 3 — Motor de crecimiento (antes que el login: primero tráfico, después retención)
- [ ] **Links de trade compartibles**: armar un trade → link público + imagen OG linda
      para preview en Discord. "¿Es fair este trade?" = loop viral gratis.
- [ ] **Páginas SSR públicas por pet** (`/pet/frost-dragon`): valor AMV + ELV + demand
      (+ tendencia cuando exista). SEO para "X pet value adopt me" → tráfico orgánico.
      Ya tenemos SSR, es casi gratis.
- [ ] i18n español + inglés (comunidad hispanohablante gigante y desatendida).
- [ ] Dominio propio + Cloudflare gratis adelante (cache de estáticos, protección,
      analytics). Analytics livianos (Plausible/Umami).

### Fase 4 — Login + sync
- [ ] Supabase (o similar): auth + Postgres, free tier. NO hacer auth artesanal.
- [ ] Proveedores: Google (universal) + Discord (la comunidad vive ahí).
      Roblox OAuth2 como diferenciador en segunda iteración.
- [ ] **Login opcional**: la app funciona 100% como invitado con localStorage.
      Al loguearse, merge del inventario local a la cuenta.
- [ ] Sync de inventario entre dispositivos.

### Fase 5 — Diferenciadores (la identidad de la app)
> "El copiloto del trader: dos fuentes de valores, tu inventario, y tendencias."
- [ ] Historial/tendencias de valor por pet (gráfico, flechitas ↑↓ en cards)
      usando los snapshots de la Fase 1.
- [ ] "Valor total de tu inventario en el tiempo".
- [ ] Alertas de valor/demand (post-login): "avisame si mi Shadow Dragon cambia".

## Costos (Fly.io)

El pay-per-use da menos miedo de lo que parece: **Fly cobra segundos de máquina + egress,
no requests**. La config actual ya es la más barata:
- `auto_stop_machines='stop'` + `min_machines_running=0` → duerme sin tráfico.
- 1 máquina shared-cpu-1x 512MB → techo absoluto ~US$3-4/mes encendida 24/7.
  Fly no agrega máquinas solo; mientras haya 1 máquina y 1 región, la factura es ~fija.
- Egress mínimo: la app sirve HTML/JS chico y las imágenes se hotlinkean de amvgg.com
  (no pasan por nuestra factura).
- Cloudflare gratis adelante = seguro contra abuso + menos egress.

**Escenario realista: US$2-5/mes** incluso con crecimiento decente.

## Monetización (objetivo: que el proyecto se pague solo)

Realismo: la audiencia son chicos/adolescentes sin tarjeta → nada de paywalls al dato.
**Regla de oro: nunca paywallear la consulta de valores; se cobra conveniencia.**

En orden:
1. **Donaciones desde el día uno** (Ko-fi / Buy Me a Coffee, botón discreto en sidebar).
   Con 2-3 donaciones/mes, Fly está pago.
2. **Ads cuando haya tráfico**: AdSense primero; redes gaming (Venatus/Playwire) pagan
   mejor pero piden decenas de miles de pageviews/mes. Las páginas SSR por pet son la
   fuente de pageviews. ⚠️ COPPA: configurar anuncios **no personalizados** / sitio
   dirigido a niños en AdSense.
3. **Tier Pro** (recién después de login + historial): alertas, historial largo, sin ads,
   temas exclusivos. US$1-2/mes simbólico. Ingreso menor; su valor real es darle destino
   al botón de donar.
4. **Comunidad**: server de Discord propio + creadores de contenido de Adopt Me
   (especialmente hispanohablantes: muchas audiencias, cero herramientas en español).

La cadena se retroalimenta: refresh automático → confianza → share/SEO → tráfico →
ads → Fly pago con margen.

## Primer paso concreto al retomar

Fase 1: endpoint `/api/refresh-values` + cron de GitHub Actions + snapshots.
Resuelve la preocupación principal (valores viejos) sin subir la factura de Fly.
