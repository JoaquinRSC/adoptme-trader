# Plan: de herramienta personal a app pública

**v1 — cerrado julio 2026.** Este documento resume el diagnóstico y el roadmap
acordado para hacer AM Trader publicable, útil y sostenible. Regla de ejecución:
cerrar cada fase entera antes de empezar la siguiente — una app chica, fresca y
pulida le gana a una app grande a medio hacer. El backlog existe para anotar
sin comprometerse.

## Estado (última actualización: 2026-07-10)

**Fase 1 ✅ · Fase 1.5 ✅ · Fase 1.8 ✅ · Fase 2 ✅ · Fase 2.5 🚧 (en curso).**

Cerrado en la Fase 2: modo avanzado eliminado, errores amables, borradores
persistidos, fix del router SSR, tooltips + "How it works", contraste y
`max-width`, **componentes unificados** (`PetPicker`, `FormChips`,
`SourceToggle`), **fallback de imágenes** (`PetImage`), **undo al borrar**,
**skeletons** (`SkeletonBar`), **pasada responsive**, **hover/touch** (nada
escondido detrás de `:hover`), **touch targets de 44px**, **los 3 estados por
página** y **accesibilidad básica** (focus visible + ARIA). El **contraste AA**,
último pendiente, se cerró el 2026-07-10 junto con la primera pasada de la 2.5.

Sigue abierto un ítem que nunca fue bloqueante: el batch de demands de las
sugerencias (rendimiento, no corrección).

**Deployado el 2026-07-10** (`b38b0b0` diseño + `a4a5ad9` refactor). Verificado en
producción con el service worker desregistrado: Fredoka pinta los títulos, el
badge de forma peor medido da 7.08:1, la etiqueta peor medida 5.13:1, `.slot-meta`
es opaco, y `/trade-builder` y `/check-values` SSRean su propio contenido.

Siguiente en la 2.5, **en orden de impacto**: el re-skin "Premium" (dirección
elegida el 2026-07-10 — ver el ítem nuevo en la Fase 2.5, con tokens y camino
de implementación), y después logo/mascota, nombre final, microcopy y
emojis → Material. Detalle en "Primer paso concreto al retomar".

### Deuda técnica conocida (2026-07-10)

- **`vue-tsc` tira 2 errores de tipos preexistentes** (verificado contra HEAD con
  un stash, no los introdujo ninguna sesión reciente):
  `CheckValuesPage.vue` → `Type 'string | null' is not assignable to 'DemandLevel'`
  y `TradeBuilderPage.vue` → `Type 'number | null' is not assignable to 'number'`.
  Sobreviven porque **ni el build de Quasar ni el CI corren typecheck** — sólo
  lint + build. Arreglarlos y sumar `vue-tsc --noEmit` al CI van juntos.
- **Una ruta desconocida renderiza una página en blanco, no un 404.** Verificado
  el 2026-07-10 en local y en producción: `curl /trade` devuelve un shell de 2804
  bytes sin sidebar ni contenido (contra 10258 de `/inventory`), y el browser queda
  en negro. Las rutas reales son `/inventory`, `/check-values` y `/trade-builder`.
  No es el bug de hidratación del SSR (ese está arreglado) — es que no hay página
  de error. Importa para la Fase 3: las páginas SSR por pet van a generar URLs que
  alguien va a tipear mal.
- El markup del `.source-toggle` ya está unificado, pero `.panel-header`,
  `.panel-count`, `.clear-draft-btn` y `.page-head/.page-title/.page-sub` siguen
  copy-pasteados entre Check Values y Trade Builder. No urge; si la Fase 2.5 los
  va a tocar igual, conviene extraerlos ahí.

### Trampas del entorno (cuestan tiempo si se olvidan)

1. **`flyctl deploy` construye la imagen del árbol LOCAL.** Deployar estando
   detrás de `origin/master` pisa los `src/data/*.json` que el workflow de valores
   acaba de publicar. Pasó el 2026-07-09, y **volvió a estar a punto de pasar el
   2026-07-10**: en una sola sesión de trabajo el workflow metió `c1f75bb`. Como
   commitea cada 4 h, estar detrás es lo normal, no la excepción →
   **`git fetch` + rebase antes de cada deploy**, sin pensarlo.
2. **El service worker sirve CSS viejo** después de un deploy. Al verificar un
   cambio visual, desregistralo y limpiá `caches`, o medís el build anterior.
3. **Un server `dist/ssr` corriendo bloquea el directorio**: `rm -rf dist/ssr`
   falla y `npm run build` puede salir con exit 0 reusando el output viejo.
   Frenalo antes de rebuildear (`Get-NetTCPConnection -LocalPort <puerto>`).

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
- ⚠️ Tenía el "look IA/template por defecto": dark + violeta índigo, pills, sans
  genérica, dashboard con sidebar. Los usuarios no lo notan, pero anula el objetivo
  de ser "distinta a las demás". **Parcialmente resuelto el 2026-07-10**: la sans
  genérica dejó de serlo (Fredoka en los títulos) y las cards ahora hablan el
  idioma de las formas. Sigue faltando lo que más identifica a una app: logo,
  mascota y voz (ver Fase 2.5).
- ✅ **El hydration mismatch del SSR era real y está arreglado** (2026-07-08): el
  router era un singleton de módulo, así que con requests SSR concurrentes cada
  ruta renderizaba el contenido de otra. Se veía sólo bajo concurrencia, por eso
  un `curl` aislado parecía sano. Resuelto con `defineRouter()` (commit `f8544a7`).

**Problemas transversales** (estado al 2026-07-09):
- ✅ Valores estáticos → `refresh-values.yml` los refresca cada 4h y redeploya solo
  si cambiaron; snapshot diario a `src/data/history/`.
- ✅ Errores crudos en pantalla → toasts amables (`src/utils/notify.ts`).
- ✅ Jerga sin explicar → tooltips en AMV/Elve y fairness + "How it works" en el sidebar.
- ✅ Mobile: las dos páginas de dos lados apilan a ≤1000px y el grid de pet slots
  es fluido (`minmax(96px, 1fr)`), así que el valor ya no se sale del slot.
- ⏳ Inventario solo en localStorage (por dispositivo, se pierde) → sync con login (Fase 4).

## Roadmap (en orden)

### Fase 1 — Refresh automático de valores ✅
Sin confianza en los valores, nada más importa.

**Resuelto, pero con un diseño distinto al que está anotado abajo.** En vez de un
endpoint que refresca los Maps en memoria + un volumen de Fly, ganó el camino más
simple: `.github/workflows/refresh-values.yml` corre cada 4 h (`0 */4 * * *`),
hace el fetch **desde el runner**, commitea los JSON a master si cambiaron y
redeploya. El estado vive en git, no en un volumen.

- [x] Refresh automático cada 4 h, sin endpoint y sin token: el runner fetchea y
      commitea. Redeploya sólo si cambiaron los caches vivos (un cambio de sólo
      snapshot se commitea pero no deploya).
- [x] Nunca pisar el cache con datos vacíos: `snapshot-values.mjs` se niega a
      escribir si las dos fuentes vienen vacías, y los JSON commiteados son la
      semilla de arranque (`warmDetailsCache` / `warmElveCache`).
- [x] **Snapshots desde el día uno**: `src/data/history/YYYY-MM-DD.json`,
      idempotente por día UTC. Materia prima de las tendencias de la Fase 5.
      El server todavía no los lee.
- [x] Elvebredd desde el runner: `curl` bypasea el TLS fingerprint de Cloudflare
      (Node fetch da 403). Confirmado end-to-end.
- [~] ~~Endpoint `POST /api/refresh-values` con token~~ y ~~volumen de Fly~~:
      **no aplican** con este diseño. Se dejan anotados por si algún día el
      refresh tiene que ser en caliente (sin redeploy).

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
- [x] PWA instalable (manifest + service worker). Ya estaba: `quasar.config.ts`
      tiene `pwa: true`, el manifest vive en `src-pwa/manifest.json` y tanto
      `/manifest.json` como `/sw.js` responden 200 en producción. El ítem quedó
      sin tildar. ⚠️ Ese service worker sirve CSS viejo tras un deploy: al
      verificar cambios visuales, desregistralo y limpiá `caches` primero.
- [x] Verificar/arreglar el posible hydration mismatch del SSR (ver diagnóstico visual).
      **Era un bug real, no artefacto del headless.** `curl` al SSR mostraba cada ruta
      renderizando el componente de OTRA página, y el mapeo cambiaba entre corridas
      → cross-request state pollution. Causa: `src/router/index.ts` exportaba un router
      singleton (compartido entre requests SSR concurrentes con `createMemoryHistory`).
      Fix: envolver en `defineRouter(() => createRouter(...))` → router fresco por request.
- [x] Arreglar `npm run lint`. Ya está: existe `eslint.config.mjs` (flat config,
      `vue/flat/essential`), eslint está en devDependencies y el script corre limpio
      sobre `src/`, `src-ssr/` y `scripts/`. El ítem quedó sin tildar.

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
- [x] Extraer `SourceToggle.vue` (el switch AMV/Elve estaba copy-pasteado 3×:
      My Pets, Check Values, Trade Builder — markup Y CSS). `v-model:ValueSource`;
      `ValueSource` pasó de tipo privado de `drafts.ts` a `src/types.ts`. La
      extracción NO era mecánica: el `setSource()` de Inventory mezclaba la
      asignación con un efecto secundario (traer los valores de Elve al primer
      switch); con `v-model` la asignación es del componente y el efecto volvió a
      ser el `watch` que siempre fue. De paso: el padding había derivado
      (Inventory 6×14 vs 6×16) y `.source-btn--disabled` era CSS muerto.
      −130/+81 líneas. Verificado: fetch lazy de Elve dispara al primer switch y
      no vuelve a disparar al re-clickear.
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
- [x] ~~Browse Market~~ — el código se eliminó el 2026-07-08; no aplica.

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
- [x] Skeletons en vez de spinners al cargar valores: `src/components/SkeletonBar.vue`
      (barra con shimmer, alto = 1em, respeta `prefers-reduced-motion`). Reemplaza
      los 6 `q-spinner` de valores: total + card en My Pets, slots en Check Values,
      slot + los 2 totales del footer en Trade Builder. Los spinners de búsqueda
      y el del botón "Find matches" siguen: ahí sí hay una acción en curso.
- [x] 🐛 **Overflow del `.pet-slots-grid` (preexistente) — arreglado.** El grid
      estaba fijo en `repeat(4, 1fr)`: en paneles angostos el slot caía a ~48px y
      el `.slot-meta` (forma + estrellas + valor) desbordaba, dibujando el valor
      FUERA del slot. Diagnóstico corregido: el layout **sí** apilaba, pero recién
      a 599px (regla global en `app.scss`), así que entre 600 y 1100px los dos
      paneles quedaban angostos con 4 columnas fijas.
      Fix en tres partes:
      1. `repeat(auto-fill, minmax(96px, 1fr))`. El 96 está medido, no elegido:
         la parte incompresible del meta (3 estrellas + valor + padding) mide
         ~74px, y un código de forma (`MFR`, `NFR`) suma ~21px. Es el mismo piso
         que ya usaba el grid de `PetPicker.vue`. Desktop no cambia (4 columnas
         en las dos páginas, igual que antes).
      2. Los dos layouts apilan a **≤1000px** (antes: 820px Trade Builder,
         599px Check Values), que es donde el panel se vuelve más angosto que
         dos slots.
      3. El label de forma trunca con ellipsis (`Normal` → `Nor…`, `Strollers`)
         en vez de empujar el valor; estrellas y valor con `flex-shrink: 0`.
         Esta contención es la red real: aunque el contenido crezca, recorta
         adentro del slot en vez de dibujarse afuera.
      Además el grid de slots y **todo el bloque responsive de las dos páginas**
      viven una sola vez en `src/css/app.scss`: estaban copy-pasteados, y por eso
      se les habían desincronizado los breakpoints. Verificado en el build SSR en
      11 anchos (360→1920px) × 2 páginas: 0 overflow, 0 clipping de estrellas o
      valor, 0 scroll horizontal.
      ⚠️ Al verificar: el service worker sirve CSS viejo. Desregistrarlo y limpiar
      `caches` antes de medir, o se mide el build anterior (ver `project_sw_stale_deploy`).
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
- [x] **Los 3 estados en TODA página** (vacío con CTA / cargando con skeleton /
      error amable con reintentar). La auditoría encontró que el estado de error
      no existía como estado de página — sólo como toast, que se desvanece.
      Ahora hay un banner `.load-error` + `.btn-retry` (globales en `app.scss`,
      `role="alert"`) en Check Values y Trade Builder.
      Tres bugs reales que salieron de la auditoría:
      1. 🐛 `TradeBuilderPage.search()` no tenía `catch`: una búsqueda fallida
         dejaba el panel en su texto inicial, indistinguible de no haber apretado
         el botón. Ahora muestra el error con Retry.
      2. 🐛 `CheckValuesPage.refreshValues()` tampoco: un throw abandonaba el loop
         con las entradas restantes en `loading: true` → skeletons girando para
         siempre. Reescrito con `Promise.allSettled` sobre `refreshEntry()`: cada
         entrada se resuelve sola (una falla ya no abandona al resto) y N pets
         cuestan 1 round trip en vez de N en serie.
      3. 🐛 Los dos mensajes vacíos de Trade Builder se renderizaban **juntos**
         cuando una búsqueda no daba resultados ("Configure your offer…" encima de
         "No pets found"): al primero le faltaba excluir `searchDone`.
      El banner se limpia al borrar la entrada que falló o al hacer Clear
      (`loadError` / `searchError` se resetean con las mutaciones de la lista).
      Vacío: My Pets tiene empty-state con CTA; en CV/TB el slot `+` ES el CTA.
- [x] 🐛 **Controles escondidos detrás de `:hover` (touch) — arreglado.** En
      mobile no existe el hover, así que el botón de borrar de las cards de My
      Pets (`.pet-actions { opacity: 0 }`, revelado por `.pet-card:hover`) era un
      target **invisible pero tocable**: no se podía descubrir, solo activar sin
      querer. Igual la ✕ de los pet slots, que solo aparecía en hover.
      Ahora las 32 reglas `:hover` están envueltas en `@media (hover: hover)`
      (menos la del scrollbar), lo que además evita el *sticky hover* — el estado
      hover que en touch queda pegado tras el tap. En `@media (hover: none)` los
      controles se muestran siempre: el botón de borrar en la card, y un badge ✕
      chico en la esquina de cada slot lleno (los slots no tienen undo, así que
      el pet no puede desaparecer sin aviso). Ojo con las reglas que combinan
      `:hover` con `--active`: el resaltado de teclado ↑↓ queda FUERA del guard.
      Verificado con contextos touch (`hasTouch`) y mouse.
- [x] **Touch targets ≥44px** — hecho sin cambiar el dibujo. Mixin `touch-hit`
      en `app.scss`: un `::after` transparente y centrado agranda el área de
      toque (los eventos de un pseudo-elemento van a su elemento originario, así
      que no hay markup ni JS nuevo). Sólo bajo `@media (hover: none)`.
      Medido con hit-testing real (`elementFromPoint`) a 390px, antes → después:
      `.action-btn` 26→**44**, `.clear-draft-btn` 21→**45**, `.source-btn` 32→**44**,
      `.sort-btn` 32→**44**, `.btn-search` 36→**45**, `.picker-tab` 32→**44**,
      `.btn-ghost` 40→**45**. Los chips de forma ya medían 36px (el plan decía
      28: quedó viejo tras extraer `FormChips.vue`).
      Dos excepciones justificadas: `.theme-swatch` llega a 24×44 y no más —
      son 6 en fila en un drawer de 220px, y 6×44=264px no entran (24px cumple
      WCAG 2.2 AA de todos modos); y `.mobile-menu-btn` mide 38 de ancho porque
      el `.q-drawer__opener` de Quasar le pisa el borde — pero abre el mismo
      drawer, así que el tap hace lo mismo.
      ⚠️ Ojo: `.pet-card` tiene `overflow: hidden` y recortaba el área del botón
      de borrar; se resuelve moviendo el inset de `.pet-actions` a `padding`.
      Nota: el objetivo real de WCAG 2.2 AA (2.5.8) son **24px**, no 44 (eso es
      2.5.5, nivel AAA / HIG de Apple). Se apuntó a 44 igual porque salía gratis.
- [x] **Accesibilidad básica.** `:focus-visible` global (anillo de 2px con
      `--primary`; nada de anillo al clickear con el mouse). ARIA: `aria-pressed`
      + `role="group"` en los toggles AMV/Elve, chips de forma, chips de categoría
      y swatches de tema (que eran botones de puro color, sin nombre accesible);
      `aria-label` en los slots y en los botones `+`.
      Los pet slots eran `<div>` con `@click`: no se podían enfocar ni activar con
      teclado. Se convirtieron en `<button type="button">` — igual que el slot `+`
      de al lado, que ya lo era — así el foco, Enter y Space vienen gratis en vez
      de cablearse a mano. Hubo que resetear `padding`/`font` en `.pet-slot`, o el
      meta se renderizaba con la fuente del sistema.
      Los tabs del picker NO son `role="tablist"`: un tablist de verdad debe
      navegarse con flechas y roving tabindex, y media implementación es peor que
      ninguna. Quedan como grupo de botones con `aria-pressed`.
- [x] **Contraste AA** (2026-07-10, cerrado junto con la Fase 2.5).
      `--text-3` no era un tercer nivel de texto: era texto ilegible. Fallaba en
      los **6 temas** (1.88–2.28:1 contra el piso de 4.5:1) y lo usaban 35 lugares,
      entre ellos `.page-sub` (13px), `.empty-panel` (12px) y todas las etiquetas
      de valor. Subido a ≥4.5:1 en los 6 temas.
      El hallazgo incómodo: al corregirlo aterriza casi encima de `--text-2`
      (5.13 vs 5.56 en Midnight). **La rampa de 3 niveles sólo "funcionaba" porque
      el tercero no se leía.** La jerarquía ahora la cargan el tamaño, el peso y la
      mayúscula, que es donde corresponde. Los dos tokens sobreviven separados
      (5.5:1 vs 4.5:1) pero conviene fusionarlos en una pasada futura.
      Los otros tres fallos AA (leyenda, badges, `.slot-meta`) están en la 2.5.
      Verificado en el browser sobre el build de producción: 0 fallos en badges,
      chips ni etiquetas, en los 6 temas.

### Fase 2.5 — Identidad visual (que no parezca template/IA)
La ejecución ya está; falta punto de vista. Pocas decisiones, mucho efecto:
- [x] **Apropiarse del sistema de colores por forma (F/R/D/N/M)** (2026-07-10).
      Un solo origen de color por forma, con tres roles separados en `types.ts`:
      `FORM_COLOR_HEX` (relleno), `FORM_TEXT_HEX` (texto), `FORM_ON_HEX` (tinta
      sobre un relleno) y `FORM_RGB` (para variar el alfa en CSS; `color-mix()`
      no llega a los targets chrome87/safari13.1). Las pet cards con forma llevan
      borde `rgba(var(--form-rgb), .38)` y el `FORM_GRADIENT` lavado al 14% detrás
      del sprite; una card `normal` o un ítem no se tiñen — teñir todo es no teñir
      nada. Regla: **gradiente en superficies grandes sin texto encima; color plano
      en chips con texto; `FORM_TEXT_HEX` cuando la forma ES el texto.**
      Bugs reales que salieron de la pasada:
      1. 🐛 La leyenda del "How it works" enseñaba colores que las cards no
         pintaban: leía `FORM_COLOR_HEX` (R verde, N violeta) mientras los badges
         usaban un `LETTER_BG` privado (R rosa, N verde). `LETTER_BG` eliminado.
      2. 🐛 Los chips de la leyenda y los badges eran `color:#fff` sobre rellenos
         brillantes: **10 de 12 no llegaban ni al piso de 3:1** (1.67:1 sobre el
         ámbar de Mega). Resuelto con `FORM_ON_HEX`; el `text-shadow` que los
         sostenía sobra y se fue.
      3. 🐛 `.slot-meta` era `rgba(0,0,0,.65)` compuesto sobre un sprite
         arbitrario → contraste no determinístico. Sobre un pet claro fallaban
         **las 12 formas** (1.45:1 la peor). Ahora es una placa opaca `#0b0e18`.
      ⚠️ Consecuencia asumida del diseño elegido: los 4 neones y los 4 megas
      quedan casi indistinguibles entre sí (`n` vs `nfr` contrastan 1.03:1), y el
      verde de `ride` es el mismo que `--positive` y que las ★ de demand High —
      una card de Ride "se lee" como una card buena. Ver "Deuda de color".
- [x] Tipografía display sólo para títulos (2026-07-10): **Fredoka** 500/600/700
      para `.page-title`, `.dialog-title`, `.guide-title`, `.empty-title`,
      `.logo-name` y `.fairness-score`. El cuerpo sigue en Nunito.
      No se pudo "agregar una regla y listo": `* { font-family: … !important }`
      existe para ganarle a Quasar, así que una segunda familia perdía siempre.
      Un elemento se suma a la display **re-apuntando `--font-ui`** — las custom
      properties se resuelven por elemento, así que la propia regla `*` pinta
      Fredoka. Sin guerra de especificidad y hereda a los hijos.
      Medido en el browser: **no se usan numerales tabulares y es a propósito.**
      Los 10 dígitos de Nunito ya avanzan 9px a 15px/800 (las columnas no bailan),
      y Fredoka —que sí es proporcional— no trae la feature `tnum`, así que pedirla
      no cambiaba un píxel. Revisar si alguna vez se cambia una de las dos familias.
- [ ] Logo + mascota propia (reemplaza huellita + wordmark). Clave para los
      previews de Discord de la Fase 3 (se tiene que reconocer a 60px).
- [ ] Decidir el nombre final ("AM Trader"?) ANTES de comprar dominio.
      Ojo: hoy conviven "AdoptMe Trader" (`index.html`, `<title>`) y "AM Trader"
      (diálogo "How it works"). Unificar al decidir.
- [ ] Microcopy con voz de trader (es-AR/en), no texto funcional de IA:
      "Nadie está buscando tu Frost Dragon todavía — probá en un rato".
      Ya se corrigió el `<meta description>` + OG tags, que seguían vendiendo
      "a live market scanner" — feature borrada el 2026-07-08.
- [ ] Reemplazar emojis-como-íconos (🐾, 🦌, ⊘) por íconos Material (ya está el set).
- [ ] **Re-skin "Premium" (dirección elegida el 2026-07-10)** — terminación tipo
      Linear/Raycast sobre el sistema existente, SIN tocar templates de Vue.
      Maqueta aprobada: artifact "AM Trader — dirección premium" (v4) →
      https://claude.ai/code/artifact/95dc7f4d-a393-4061-93a1-c9dd5de8e204
      (las direcciones descartadas — sticker pastel, arcade cálido, minimal
      papel/grafito — quedaron en el historial de versiones del artifact).
      El diagnóstico que llevó acá: "moderno" no era ni pastel ni minimalismo de
      hairlines — es **acabado**: profundidad, luz y detalle sobre la estructura
      que ya existe.

      **Se respeta** (no negociable, ya decidido):
      - Colores por forma de `types.ts` con su regla de tres roles. En pills:
        `rgba(var(--form-rgb), .14)` de fondo, `.30` de borde, `FORM_TEXT_HEX`
        como texto.
      - La arista de forma en el thumb/avatar (heredera del form edge actual).
      - `--gold` #E7C368 para valores y total; **asciende a acento de marca**.
      - Demand en estrellas ★★☆, Fredoka en títulos/marca, Nunito en la UI,
        copy en inglés, logo 🐾 (hasta que llegue la mascota).

      **Cambia** (tokens, en `app.scss`):
      - Fondo: navy azulado → **negro neutro** `#0B0B0C→#121214` (degradé) con
        glow ambiental dorado `radial-gradient` al 10% desde arriba-derecha.
      - **Muere el índigo** `#7C6CF8`. CTA primario: degradé `#FFD479→#F0B53F`,
        texto `#201503`, sombra `0 4px 20px rgba(240,181,63,.35)` + inset top
        `rgba(255,255,255,.5)`.
      - **Luz de arriba**: hairline `rgba(255,255,255,.22)` en el borde superior
        de la pantalla (degradé horizontal) e `inset 0 1px 0 rgba(255,255,255,.06)`
        en cada panel. Es EL truco que separa plano de premium.
      - **Elevación**: paneles con degradé `rgba(255,255,255,.045)→.02` + borde
        `.08` + sombra exterior blanda — se apoyan, no se encierran.
      - **Controles táctiles**: el estado activo se "levanta" (degradé
        `#2A2A2E→#202023` + borde `.12` + sombra chica), no solo cambia de color.
      - Total de la oferta: el número más pesado de la pantalla, con gradiente
        de texto dorado `#FFE9B3→#E7C368` (`background-clip: text`).
      - Deltas financieros: verde `#4CD9A2` / rojo `#F2917E` — reservados para
        ganancia/pérdida, nunca decorativos.
      - **Temas: este oscuro reemplaza a los 6**; el selector de swatches se
        retira del sidebar (un par claro puede volver después si hace falta).

      **Camino de implementación** (pase de CSS puro):
      1. Tokens nuevos en `app.scss` (fondo, dorado primario, hairlines, sombras).
      2. Aplicar **solo en Trade Builder** y verificar en celular real
         (⚠️ service worker: desregistrar antes de medir, sirve CSS viejo).
      3. Extender a My Pets y Check Values; retirar el selector de temas.
      4. **Re-medir AA sobre el fondo nuevo** (el dorado sobre negro neutro rinde
         mejor que sobre navy, pero hay que verificarlo) y re-visitar la "Deuda
         de color": el verde de `ride` vs `--positive` puede leerse distinto
         sobre base neutra.

**Gradientes de forma en headers de trade — no se hizo, a propósito.** El plan lo
pedía, pero `TradeBuilderPage.search()` arma todos los candidatos con un único
`desiredForm`, así que **las 20 sugerencias comparten siempre la misma forma**: un
borde o un gradiente por forma ahí sería una constante, no información. El gradiente
se aplicó donde la forma sí varía (el thumb de las pet cards de My Pets).

### Deuda de color (abierta, decidida a conciencia el 2026-07-10)

`FORM_COLOR_HEX` asigna 12 colores a 12 combos, pero sólo discrimina 4:
- `n`/`nf`/`nr`/`nfr` contrastan entre sí 1.03–1.31:1 → "un violeta".
- `m`/`mf`/`mr`/`mfr` contrastan entre sí 1.05–1.68:1 → "un naranja".
- `ride` (#34d399) == `--positive` == el verde de demand High.

La alternativa evaluada era tratar la forma como **4 atributos que se apilan**
(M/N/F/R), que es como habla el jugador ("neon fly ride") y como ya funcionan los
badges. Se eligió mantener el sistema por combo. Si alguna vez molesta, el cambio
es acotado: los badges ya son composicionales y `FORM_*` está centralizado.

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

- [~] **CI mínimo**: `.github/workflows/ci.yml` corre **lint + build** en cada push
      y PR (saltea commits de sólo datos o sólo docs). Falta el **typecheck**:
      `vue-tsc --noEmit` no corre en ningún lado, y por eso los 2 errores de tipos
      de "Deuda técnica" sobreviven. Sumarlo junto con arreglarlos.
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

La Fase 2 está cerrada y la **Fase 2.5** va por la mitad: el sistema de color por
forma, la tipografía display y el contraste AA ya están (2026-07-10).

**Antes de escribir una línea de UI: correr la skill `/frontend-design`.**

Queda, en orden de impacto:

1. **Logo + mascota propia.** Es lo que más rinde de lo que falta: reemplaza la
   huellita + wordmark y es la pieza que tiene que reconocerse a 60px en los
   previews de Discord de la Fase 3. Hoy el logo es un emoji.
2. **Nombre final**, antes de comprar dominio. Y unificar: `index.html` dice
   "AdoptMe Trader", el diálogo de ayuda dice "AM Trader".
3. **Microcopy con voz de trader** (es-AR/en). El copy funcional ya está limpio;
   falta que tenga voz.
4. **Emojis-como-íconos → Material** (🐾 en el logo y el empty state, 📦 en los
   fallbacks de `PetImage`, ⊘). El set ya está instalado.

Al tocar color, el piso ya está medido y no se negocia: AA (4.5:1) para todo texto,
en los **6 temas**, y `.slot-meta` es una placa opaca justamente para que el
contraste no dependa del sprite que haya atrás. Hay un script de verificación de
contraste reproducible en el historial de esta sesión; rehacerlo es barato.
