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

**Diagnóstico visual** (verificado con screenshots del build en desktop 1440px y mobile 390px):
- ✅ Base sólida, por encima del promedio del nicho: sistema coherente (dark navy +
  violeta, cards, chips consistentes), sidebar profesional, empty states cuidados,
  5 temas de color. Mobile ya colapsa a una columna con hamburger (mejor de lo temido).
- ⚠️ Tiene el "look IA/template por defecto": dark + violeta índigo, pills, sans
  genérica, dashboard con sidebar. Los usuarios no lo notan, pero anula el objetivo
  de ser "distinta a las demás". La ejecución está bien; falta capa de identidad
  (ver Fase 2.5).
- 🐛 **Verificar posible hydration mismatch del SSR**: en renders en frío
  (`/trade-builder` directo, incógnito) el header muestra el título de OTRA página
  y quedan controles sin estilos. Puede ser artefacto del headless usado para los
  screenshots, pero si se reproduce en navegador real es prioridad de Fase 2:
  el SEO de la Fase 3 depende del primer render en frío.

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

### Fase 1 — Refresh automático de valores 🔴 prioridad máxima
Sin confianza en los valores, nada más importa.
- [ ] Endpoint `POST /api/refresh-values` protegido con token secreto (env var):
      re-ejecuta la lógica de `fetch-values` en el server y reemplaza los Maps en memoria.
- [ ] Nunca pisar el cache con datos parciales/vacíos: si el fetch falla, se conserva
      el último cache bueno. Los JSON commiteados quedan como semilla/fallback de arranque.
- [ ] Cron de GitHub Actions (gratis) cada 3-4 h que pegue al endpoint.
      Despierta la máquina, refresca, la máquina se vuelve a dormir → compatible con
      scale-to-zero, costo ~cero.
- [ ] Persistir el último fetch exitoso en un volumen de Fly (~US$0.15/mes por GB)
      para que un reinicio no vuelva a los valores del último deploy.
- [ ] Probar Elvebredd desde la IP de Fly (curl ya bypasea el TLS fingerprint,
      pero Cloudflare puede tratar distinto a IPs de datacenter). Backoff + fallback.
- [ ] **Guardar snapshots desde el día uno** (fecha + valores): es la materia prima
      del historial de tendencias de la Fase 5, se acumula solo mientras tanto.

### Fase 2 — Limpieza para público
- [ ] Ocultar Publish / Auto / Loop detrás de un flag (p. ej. `localStorage.advanced_mode`).
- [ ] Cache server-side de `/api/trade/browse` por `(pet, form)`, TTL 2-5 min.
- [ ] Mensajes de error amables (nada de errores crudos en monospace).
- [ ] Responsive/mobile: Trade Builder colapsa a una columna; revisar todas las páginas.
- [ ] Tooltips + página corta de "cómo funciona" (formas, fuentes, demand, fairness).
- [ ] PWA instalable (manifest + service worker básico).
- [ ] Verificar/arreglar el posible hydration mismatch del SSR (ver diagnóstico visual).
- [ ] Arreglar `npm run lint` (no hay config de ESLint en el repo y eslint no está
      en devDependencies — está roto).

**Pulido visual** (un día de trabajo, no un rediseño):
- [ ] Subir tipografía y densidad ~20%: las cards usan 9-11px, hostil para
      adolescentes en tablet/celu. Touch targets más grandes (chips F/R/D/N/M).
- [ ] Más contraste entre fondo ↔ surface ↔ borde: hoy todo está tan cerca en
      luminancia que en pantallas baratas se ve barroso.
- [ ] Contenedor `max-width: ~1150px` centrado: en 1440px+ los controles se
      estiran de borde a borde y queda espacio muerto.

### Fase 2.5 — Identidad visual (que no parezca template/IA)
La ejecución ya está; falta punto de vista. Pocas decisiones, mucho efecto:
- [ ] **Apropiarse del sistema de colores por forma (F/R/D/N/M)** como lenguaje
      visual central: bordes/tints de card por forma, gradientes de forma en
      headers de trade. Es conocimiento del dominio — ninguna otra app lo tiene.
- [ ] Tipografía display con carácter solo para títulos (redondeada/gordita,
      onda Nunito/Baloo — pega con Adopt Me); el cuerpo queda sans limpia.
- [ ] Logo + mascota propia (reemplaza huellita + wordmark). Clave para los
      previews de Discord de la Fase 3 (se tiene que reconocer a 60px).
- [ ] Decidir el nombre final ("AM Trader"?) ANTES de comprar dominio.
- [ ] Microcopy con voz de trader (es-AR/en), no texto funcional de IA:
      "Nadie está buscando tu Frost Dragon todavía — probá en un rato".
- [ ] Reemplazar emojis-como-íconos (🐾, 🦌, ⊘) por íconos Material (ya está el set).

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
