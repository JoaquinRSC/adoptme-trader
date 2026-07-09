# Plan: de herramienta personal a app pública

**v1 — cerrado julio 2026.** Este documento resume el diagnóstico y el roadmap
acordado para hacer AM Trader publicable, útil y sostenible. Regla de ejecución:
cerrar cada fase entera antes de empezar la siguiente — una app chica, fresca y
pulida le gana a una app grande a medio hacer. El backlog existe para anotar
sin comprometerse.

## Diagnóstico

**Lo que ya está listo para público (modo consulta):**
- My Pets (inventario) ✅
- Check Values ✅
- Trade Builder — la mitad consultiva (armar oferta → Find matches → sugerencias) ✅

**Lo que NO va en la versión pública:**
- **Publish a AMVGG**: requiere que el usuario copie sus cookies de sesión desde
  DevTools, y esas cookies pasan por nuestro server (`api.ts` → `amvgg.com/api/createPost`).
  Pedirle la sesión a un desconocido es inviable; AMVGG no tiene OAuth ni API pública.
- **Publish a Elvebredd**: pegar un script en la consola del navegador (patrón self-XSS).
- **Auto + Loop**: publicar trades en bucle con la sesión del usuario = botting.
  A escala pública: cuentas baneadas + IP de Fly bloqueada.
- **Browse Market** (decisión estratégica, no técnica): scrapea el *feed de trades*
  de AMVGG/Elvebredd en vivo por cada búsqueda de cada usuario y republica su
  marketplace dentro de nuestra UI — es espejarles el producto central, con tráfico
  proporcional a nuestro éxito, quitándoles las pageviews con las que monetizan.
  Distinto de los *valores* (referencia, pocas veces al día, tolerado en el nicho):
  es la única feature con riesgo de relación con las fuentes de las que dependemos.
  La UX está bien; queda como herramienta personal.

**Decisión** (actualizada 2026-07-08): originalmente se separó en dos modos —
público consultivo + modo avanzado personal detrás de un flag. Ese modo avanzado
(Publish/Auto/Loop + Browse Market) se **eliminó por completo el 2026-07-08**:
quedó una sola versión pública para todos. El código vive en el historial de git.
- *Versión pública (única)* = My Pets + Check Values + Trade Builder consultivo
  (sidebar de 3 secciones). Identidad: todo propio, nada espejado.
- El motor de crecimiento (Fase 3) y los diferenciadores (Fase 5) no dependen
  del feed de trades — no se pierde nada estratégico.

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
- [x] ~~Ocultar Publish / Auto / Loop y Browse Market detrás de un flag~~ →
      **eliminados por completo (2026-07-08)**. Primero se ocultaron detrás de
      `localStorage.advanced_mode`; después se decidió borrarlos del todo. La
      sidebar pública queda con 3 secciones (My Pets, Check Values, Trade Builder).
- [x] ~~Rate-limit/auth en `/api/trade/browse`~~ → endpoint eliminado con el resto.
- [x] Mensajes de error amables (nada de errores crudos en monospace).
      Ya no había errores crudos (los `catch` caían a `null` en silencio → un fallo
      de red se veía igual que "sin valor"). Se agregó `notifyLoadError()`
      (`src/utils/notify.ts`, throttled + SSR-safe) cableado en el chokepoint del
      store (`apiFetch`/`apiPost`) y en los `fetch` de detalles de las páginas →
      toast amable "Couldn't load the latest values…" en vez de blanco silencioso.
- [x] Responsive/mobile: Trade Builder colapsa a una columna; revisar todas las páginas.
      Auditado a 390px (Playwright sobre el sitio live): My Pets, Check Values (YOU/THEM
      apilados), Trade Builder (1 columna) y los pickers OK. Único bug: el diálogo Add
      Pet/Add Item de Inventory no apilaba (base `.add-*` declarada DESPUÉS del `@media`
      → ganaba por orden de fuente); arreglado con `!important` en los overrides mobile.
- [x] Tooltips + página corta de "cómo funciona" (formas, fuentes, demand, fairness).
      Diálogo "How it works" en la sidebar + tooltips en el toggle AMV/Elve y en el
      fairness score (las ★ de demand ya tenían `title`). Los chips F/R/D/N/M quedan
      explicados en el diálogo; sus tooltips por-botón se agregan al unificar en
      `FormChips.vue` (evita tocar las 25 copias actuales).
- [ ] PWA instalable (manifest + service worker básico).
- [x] Verificar/arreglar el posible hydration mismatch del SSR (ver diagnóstico visual).
      **Era un bug real, no artefacto del headless.** `curl` al SSR mostraba cada ruta
      renderizando el componente de OTRA página, y el mapeo cambiaba entre corridas
      → cross-request state pollution. Causa: `src/router/index.ts` exportaba un router
      singleton (compartido entre requests SSR concurrentes con `createMemoryHistory`).
      Fix: envolver en `defineRouter(() => createRouter(...))` → router fresco por request.
- [ ] Arreglar `npm run lint` (no hay config de ESLint en el repo y eslint no está
      en devDependencies — está roto).

**Pulido visual** (un día de trabajo, no un rediseño):
- [~] Subir tipografía y densidad ~20%: RECONSIDERADO. El diagnóstico era pesimista
      — el contenido primario de las cards (nombre + valor) ya es 15px, legible. Los
      9-11px son eyebrows en MAYÚSCULA y badges intencionales; inflarlos empeoraría.
      Los touch targets de los chips F/R/D/N/M (~28px, aceptable) se agrandan al
      unificar en `FormChips.vue`, para no tocar las 6 copias ahora. Sin cambios netos.
- [x] Más contraste entre fondo ↔ surface ↔ borde: ramp ensanchado en el tema default
      (bg más profundo, surfaces levantadas) + bordes subidos (0.07→0.10, hi 0.13→0.17)
      y en los 6 temas (0.08→0.12). Las cards ahora se leen como capas (antes casi
      invisibles). Verificado con screenshots antes/después.
- [x] Contenedor `max-width: 1180px` centrado en `.inv/.cv/.trade-page`: a ≥1600px el
      contenido se centra en vez de estirarse de borde a borde. Verificado a 1920px.

**Unificar el selector de pets — componente único `<PetPicker>`** 🎯
Hoy hay 5-6 implementaciones copy-pasteadas (Inventory pet + item, Check Values
YOU + THEM, Trade Builder, Browse Market), cada una con interacción distinta:
teclado y autofocus solo en algunas, chips de forma en 3 posiciones diferentes,
My Pets como tab / tira / ausente. Peor: en Trade Builder y Check Values el
dialog SE CIERRA tras cada pet agregado → armar una oferta de 5 pets = abrirlo
5 veces. Reemplazar todo por un componente compartido con esta spec:
- [x] `src/components/PetPicker.vue` configurable por props (`mine` opcional →
      con/sin tabs, `categories`, `forms`, textos). Emite `add` con
      `PickerSelection` (`src/types.ts`); notifica el toast y precarga los valores
      del inventario por sí solo. Adoptado por Trade Builder + Check Values
      YOU/THEM (3 pickers → 1 componente). El add-pet/add-item de Inventory NO lo
      usa: es un formulario (elegir → cantidad → confirmar), no un picker.
      `single/multi` no se implementó — ningún consumidor lo necesita.
- [x] Extraer `FormChips.vue` (el bloque F/R/D/N/M estaba copy-pasteado 4×:
      Inventory add-pet, Check Values YOU + THEM, Trade Builder). Ahora es un
      componente único con `v-model:PetForm` (encapsula `useFormPicker`), tooltips
      con el nombre de cada forma, y touch targets más grandes. Verificado end-to-end
      (Normal→N→NF→MF, badge de preview refleja el v-model).
- [x] Interacción idéntica SIEMPRE: autofocus al abrir (o al pasar a "Other"),
      ↑↓ navega con resaltado, Enter agrega el resaltado, Esc cierra, debounce 250
      compartido. La búsqueda descarta respuestas viejas con un token, así que una
      request lenta ya no pisa resultados nuevos. Verificado en navegador.
- [x] **No cerrar al agregar** en Trade Builder + Check Values: el picker queda
      abierto, cada add dispara un toast `notifyAdded()` con contador de grupo
      (Quasar `group` colapsa adds rápidos en un toast con count), y el botón pasó
      de "Close" a "Done". Verificado en Trade Builder (add×2 sin cerrar, contador,
      Done cierra). Aún sin componente único — hecho sobre los pickers actuales.
- [x] Chips de forma: misma posición siempre, touch targets grandes, tooltip
      con el nombre (Fly/Ride/Default/Neon/Mega) para novatos. → hecho en `FormChips.vue`.
- [x] **Sección "Recientes"** antes de tipear (últimos 8 pets usados,
      localStorage): store `recent.ts` (SSR-safe, hydrate-on-mount) + componente
      `RecentChips.vue`. Se registra al agregar cualquier pet (Inventory confirmAdd,
      Trade Builder addOffered, Check Values addPetToSide) y se muestra en el
      empty-state de los pickers cuando la búsqueda está vacía. En Inventory rellena
      el nombre; en TB/CV agrega directo. Verificado end-to-end (agregar→persistir→
      mostrar→click re-agrega).
- [x] My Pets siempre igual donde aplique: primer tab, ordenado por valor, con
      filtro de categorías cuando hay más de una y el valor cacheado en cada card
      (Check Values no tenía ni filtro ni valores; ahora sí).
- [x] Mobile: el dialog pasa a sheet full-screen (`maximized` bajo 600px). Hubo
      que borrar un `.picker-card { width: 94vw !important }` global de `app.scss`
      que le ganaba al sheet. Verificado a 390×760.
- [ ] ~~Browse Market~~ — el código se eliminó el 2026-07-08; no aplica.

**Estado y consistencia (última pasada de revisión):**
- [x] 🐛 **Tolerancia inconsistente en Trade Builder**: resuelto exponiendo el
      control en la UI (±5/10/20%, default 20, persistido en localStorage).
- [x] **Persistir borradores**: la oferta del Trade Builder y los lados de Check
      Values viven en `src/stores/drafts.ts` (Pinia + localStorage, `hydrate()` on
      mount). Cada página tiene su botón "Clear".
- [x] **Redefinir el fairness score**: ahora es la fairness de la sugerencia
      seleccionada (o la mejor como fallback) y respeta la fuente activa AMV/Elve.
- [ ] Batch de demands en sugerencias: las top-20 disparan 20 GET individuales
      a `/api/pet/details` → un endpoint batch (o incluir demands en `pet/batch`).

**UX transversal** (los detalles que hacen que se sienta "bien pensado"):
- [ ] Skeletons (cards fantasma) en vez de spinners al cargar valores —
      la app se siente el doble de rápida sin serlo.
- [x] Fallback de imágenes: `src/components/PetImage.vue` reemplaza los 7 `<img>`
      inline. Intenta la URL directa; si 404ea, resuelve con `/api/pet/image`
      (que scrapea y cachea); recién ahí muestra el emoji, que conserva la caja en
      vez de colapsarla. Antes el inventario pedía `/api/pet/image` para TODOS los
      pets al montar; ahora sólo para los que fallan. Suma `alt` en cada imagen.
- [x] Undo en vez de confirmación: borrar del inventario es instantáneo + toast
      "Undo" de 5 s que restaura el pet en su posición original
      (`inventory.removePet` devuelve `{pet,index}`, `insertPet` lo reinserta).
      Cada borrado tiene su propio toast (`group: false`). Se eliminó el plugin
      `Dialog` de Quasar: era su único uso.
- [ ] Los 3 estados en TODA página: vacío (con CTA), cargando (skeleton),
      error (mensaje amable + reintentar). Auditar página por página.
- [ ] Accesibilidad básica: contraste AA (se solapa con pulido visual), focus
      visible, touch targets ≥44px, alt/aria en controles. Parcial: `PetImage`
      pone `alt`/`aria-label` y el botón de borrar tiene `aria-label`.

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
- [ ] **Quick WFL pública**: página mínima "¿Win, Fair o Lose?" sin inventario ni
      contexto — el punto de entrada natural de los share links.
- [ ] **Páginas SSR públicas por pet** (`/pet/frost-dragon`): valor AMV + ELV + demand
      (+ tendencia cuando exista). SEO para "X pet value adopt me" → tráfico orgánico.
      Ya tenemos SSR, es casi gratis. + sitemap.xml y meta descriptions.
- [ ] i18n español + inglés (comunidad hispanohablante gigante y desatendida).
- [ ] Dominio propio + Cloudflare gratis adelante (cache de estáticos, protección,
      analytics). Analytics livianos y cookieless (Plausible/Umami — sin banner
      de cookies).
- [ ] **Legal pack** (obligatorio antes de ads, importante antes de publicitar):
      página de privacidad + términos + disclaimer "no afiliado a Roblox/Uplift
      Games". Con audiencia <13, cuidado extra (COPPA).
- [ ] Botón de feedback (link a Discord propio o form tipo Tally): el roadmap
      post-lanzamiento lo escriben los usuarios.

### Fase 4 — Login + sync
- [ ] Supabase (o similar): auth + Postgres, free tier. NO hacer auth artesanal.
- [ ] Proveedores: Google (universal) + Discord (la comunidad vive ahí).
- [ ] **Login with Roblox** (OAuth2 oficial, segunda iteración): da identidad
      verificada — username real, ID y avatar — para el perfil del trader y los
      share links. ⚠️ NO da acceso al inventario de pets: los pets viven en los
      DataStores privados de Uplift Games, no en Roblox. Ninguna API pública
      los expone (ver "Carga de inventario" abajo).
- [ ] **Login opcional**: la app funciona 100% como invitado con localStorage.
      Al loguearse, merge del inventario local a la cuenta.
- [ ] Sync de inventario entre dispositivos.

**Carga de inventario sin fricción** (el dolor real: cargar pets de a uno):
- [ ] **Carga masiva** (barato, resuelve el 80%): picker de Add Pet con
      multi-select/checkboxes — buscar, tildar N pets con sus formas, un solo
      "Agregar". Puede adelantarse a Fase 2 si el onboarding lo pide.
- [ ] **Export/import JSON** del inventario: backup contra pérdida de
      localStorage + pasar entre dispositivos antes del login.
- Detección automática directa: **imposible por diseño** (datos privados de
  Uplift, sin API). No perder tiempo buscándole la vuelta por Roblox OAuth.
- Import por screenshot → backlog (experimental, ver abajo).

### Fase 5 — Diferenciadores (la identidad de la app)
> "El copiloto del trader: dos fuentes de valores, tu inventario, y tendencias."
- [ ] Historial/tendencias de valor por pet (gráfico, flechitas ↑↓ en cards)
      usando los snapshots de la Fase 1.
- [ ] **Página "Trending"**: los que más subieron/bajaron esta semana. Sale gratis
      de los snapshots y es máquina de contenido compartible/googleable semanal.
- [ ] "Valor total de tu inventario en el tiempo".
- [ ] Alertas de valor/demand (post-login): "avisame si mi Shadow Dragon cambia".
- [ ] **Watchlist**: pets que querés conseguir; Browse Market resalta trades que
      los incluyen y las alertas tienen objetivo natural.
- [ ] **Trade log personal** (post-login): registrar trades hechos y ver
      ganancia/pérdida de valor en el tiempo. Nadie del nicho lo tiene.
- [ ] Badge de discrepancia AMV vs ELV (>25% de diferencia → "⚠ las fuentes no
      coinciden"): convierte mostrar dos valores en dar un consejo.

## Transversal — calidad e infra (lo invisible que evita incendios)

- [ ] **CI mínimo**: GitHub Action con build + typecheck en cada push/PR.
      Hoy nada avisa si un commit rompe el deploy.
- [ ] Error tracking con Sentry (free tier): enterarse de los errores de usuarios
      reales sin esperar que alguien los reporte.
- [ ] Uptime monitor gratis (UptimeRobot) apuntando a `/api/ping`.
- [ ] Security headers básicos (CSP razonable, X-Frame-Options, etc.).
- [ ] Changelog "What's new" visible en la app: barato, construye confianza.

## Backlog lejano (anotado para no perderlo, NO es prioridad)

- Bot de Discord de valores (canal de crecimiento enorme, pero es otro producto).
- Comparador de pets ("Frost Dragon vs Shadow Dragon").
- Login with Roblox (OAuth2) como diferenciador de la Fase 4, segunda iteración.
- Re-evaluar Browse Market público: si la app crece, escribirles a AMVGG y
  preguntar si les molesta (argumento: el "View ↗" les manda tráfico). El código
  se eliminó el 2026-07-08 — rehabilitarlo es reconstruir desde el historial de
  git; des-quemar una IP bloqueada o una mala relación, no.
- **Import de inventario por screenshot** (experimental, feature "wow" que nadie
  tiene): el usuario sube capturas de su inventario in-game y el server matchea
  los íconos contra el set de sprites de pets ya conocido (imágenes de amvgg).
  Diseño "best effort" obligatorio: la app propone lo reconocido y el usuario
  corrige en una pantalla de revisión. Limitaciones conocidas: capturas de
  calidad variable, y la forma no siempre se ve en el ícono (neon/mega sí se
  distinguen; fly/ride no → confirmar a mano). Prototipar antes de prometer.

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
