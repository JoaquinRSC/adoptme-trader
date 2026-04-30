<template>
  <q-page class="trade-page">

    <div class="page-head">
      <div>
        <div class="page-title">Trade Builder</div>
        <div class="page-sub">AMVGG values + demand cross-check</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
      <button class="btn-auto" @click="startAuto" :disabled="!inventory.pets.length">
        <q-icon :name="matAutoAwesome" size="15px" />
        Auto
      </button>
      <div class="source-toggle">
        <button
          class="source-btn"
          :class="{ 'source-btn--active': valueSource === 'amvgg' }"
          @click="valueSource = 'amvgg'"
        >AMV</button>
        <button
          class="source-btn"
          :class="{ 'source-btn--active': valueSource === 'elvebredd' }"
          @click="valueSource = 'elvebredd'"
        >Elve</button>
      </div>
      </div>
    </div>

    <div class="trade-layout">

      <!-- ── LEFT: offered pets ─────────────────────────────────────────────── -->
      <div class="trade-panel">
        <div class="panel-header">
          <q-icon :name="matUpload" size="16px" />
          <span>You offer</span>
          <span class="panel-count" v-if="offeredPets.length">{{ offeredPets.length }}</span>
        </div>

        <div class="panel-body">
          <div class="pet-slots-grid">
            <div class="pet-slot pet-slot--filled" v-for="item in offeredPets" :key="item.pet.id" @click="removeOffered(item.pet.id)" title="Click to remove">
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(item.pet.name)}.webp`"
                class="slot-img"
                @error="(e) => (e.target as HTMLImageElement).style.display='none'"
              />
              <div class="slot-meta">
                <span class="slot-form" :style="(!item.pet.category || item.pet.category === 'pet') ? { color: FORM_COLOR_HEX[item.pet.form] } : {}">{{ item.pet.category && item.pet.category !== 'pet' ? CATEGORY_LABELS[item.pet.category] : FORM_LABELS[item.pet.form] }}</span>
                <span v-if="item.demand" class="slot-demand" :class="`demand--${demandClass(item.demand)}`" :title="item.demand">{{ demandStars(item.demand) }}</span>
                <span class="slot-val">
                  <q-spinner v-if="item.loading" size="8px" />
                  <template v-else>{{ valueSource === 'elvebredd' ? (item.elveValue?.toFixed(2) ?? '') : (item.amvggValue ?? '') }}</template>
                </span>
              </div>
            </div>
            <button class="pet-slot pet-slot--add" @click="showInventoryPicker = true">
              <div class="slot-plus-circle">+</div>
            </button>
          </div>
        </div>

        <div class="panel-footer" v-if="offeredPets.length">
          <span class="footer-label">Total</span>
          <div class="footer-totals">
            <div class="footer-total-row">
              <span class="footer-src">AMV</span>
              <span class="footer-value">
                <q-spinner v-if="anyOfferedLoading" size="11px" />
                <template v-else>{{ totalOfferedAmvgg.toFixed(4) }}</template>
              </span>
            </div>
            <div class="footer-total-row">
              <span class="footer-src">Elve</span>
              <span class="footer-value">
                <q-spinner v-if="anyOfferedLoading" size="11px" />
                <template v-else>{{ totalOfferedElve.toFixed(2) }}</template>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── CENTER: controls ───────────────────────────────────────────────── -->
      <div class="trade-controls">
        <div class="swap-icon-wrap">
          <q-icon :name="matSwapHoriz" size="28px" style="color: var(--text-3)" />
        </div>

        <!-- Fairness indicator -->
        <div class="fairness-wrap" v-if="fairness !== null">
          <div class="fairness-score" :class="fairnessClass">
            {{ fairness >= 0 ? '+' : '' }}{{ fairness.toFixed(1) }}%
          </div>
          <div class="fairness-label">demand-adjusted</div>
          <div class="demand-warning" v-if="demandWarning">
            <q-icon :name="matWarning" size="12px" />
            {{ demandWarning }}
          </div>
        </div>

        <div class="control-label">Receive form</div>
        <q-select
          v-model="desiredForm"
          :options="formOptions"
          outlined dense
          emit-value map-options
          style="width: 130px"
        />

        <button
          class="btn-search"
          :disabled="!offeredPets.length || anyOfferedLoading || totalOfferedValue === 0"
          @click="search"
        >
          <q-spinner v-if="searching" size="16px" color="white" />
          <q-icon v-else :name="matSearch" size="16px" />
          <span>{{ searching ? 'Searching…' : 'Find matches' }}</span>
        </button>
      </div>

      <!-- ── RIGHT: suggestions ─────────────────────────────────────────────── -->
      <div class="trade-panel">
        <div class="panel-header">
          <q-icon :name="matAutoAwesome" size="16px" />
          <span>Suggestions</span>
          <span class="panel-count" v-if="suggestions.length">{{ suggestions.length }}</span>
          <button
            v-if="selectedSuggestion"
            class="publish-btn"
            @click="showPublish = true"
          >
            <q-icon :name="matPublish" size="14px" />
            Publish
          </button>
        </div>

        <div class="panel-body">
          <div class="empty-panel" v-if="!suggestions.length && !searching">
            Configure your offer and click "Find matches"
          </div>

          <div class="suggestions-grid" v-if="suggestions.length">
            <div
              class="suggestion-card"
              v-for="s in suggestions"
              :key="s.name"
              :class="[deltaCardClass(s.delta), { 'sug-card--selected': selectedSuggestion?.name === s.name }]"
              @click="selectedSuggestion = selectedSuggestion?.name === s.name ? null : s"
            >
              <div class="sug-thumb">
                <img
                  :src="`https://amvgg.com/items/${encodeURIComponent(s.name)}.webp`"
                  class="sug-thumb-img"
                  @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                />
              </div>
              <div class="sug-body">
                <div class="sug-name">{{ s.name }}</div>
                <div class="sug-meta">
                  <span class="form-pill" :style="{ color: FORM_COLOR_HEX[s.form] }">
                    {{ FORM_LABELS[s.form] }}
                  </span>
                  <span v-if="s.demand" class="demand-stars" :class="`stars--${demandClass(s.demand)}`" :title="s.demand">
                    {{ demandStars(s.demand) }}
                  </span>
                </div>
                <div class="sug-values">
                  <span class="sug-val-item"><span class="sug-src-lbl">AMV</span><span class="sug-val">{{ s.amvggValue ?? '—' }}</span></span>
                  <span class="sug-val-item"><span class="sug-src-lbl">Elve</span><span class="sug-val">{{ s.elveValue != null ? s.elveValue.toFixed(2) : '—' }}</span></span>
                </div>
              </div>
              <div class="delta-chip" :class="deltaChipClass(s.delta)">
                {{ s.delta > 0 ? '+' : '' }}{{ s.delta.toFixed(1) }}%
              </div>
            </div>
          </div>

          <div class="empty-panel" v-if="searchDone && !suggestions.length">
            No pets found within ±20% of your offer value
          </div>
        </div>
      </div>

    </div>

    <!-- Publish trade dialog -->
    <q-dialog v-model="showPublish" @hide="postResult = null; elvePostResult = null; elveTurnstile = ''">
      <q-card class="publish-card">
        <div class="pub-header">
          <div class="dialog-title">Publish to AMVGG</div>
          <div class="pub-summary" v-if="selectedSuggestion">
            <span class="pub-offering">{{ offeredPets.map(o => o.pet.name).join(', ') }}</span>
            <span class="pub-arrow">→</span>
            <span class="pub-wanting">{{ FORM_LABELS[selectedSuggestion.form] }} {{ selectedSuggestion.name }}</span>
          </div>
        </div>

        <!-- Success -->
        <div v-if="postResult?.ok" class="pub-body" style="align-items:center;text-align:center;padding:28px 20px">
          <div style="font-size:32px;color:var(--positive)">✓</div>
          <div style="font-size:15px;font-weight:800;color:var(--text-1);margin-top:4px">Trade posted!</div>
          <a href="https://amvgg.com/trades" target="_blank" rel="noopener" class="btn-sm-link" style="margin-top:6px">View on AMVGG ↗</a>
        </div>

        <!-- Error -->
        <div v-else-if="postResult?.ok === false" class="pub-body">
          <div style="font-size:13px;color:var(--negative);font-weight:600;line-height:1.5">
            Failed to post: {{ postResult.error }}
          </div>
          <button class="btn-search" style="width:auto;padding:8px 20px;margin-top:4px" @click="postResult = null">Try again</button>
        </div>

        <!-- Main form -->
        <div v-else class="pub-body">
          <div class="pub-platform">
            <div class="pub-plat-info">
              <span class="pub-plat-logo">🐾</span>
              <div>
                <div class="pub-plat-name">AMVGG</div>
                <div class="pub-plat-status" :class="amvggCookie ? 'status--on' : 'status--off'">
                  {{ amvggCookie ? 'Connected' : 'Not connected' }}
                </div>
              </div>
            </div>
            <button v-if="amvggCookie" class="btn-sm-link" style="color:var(--negative)" @click="disconnectAmvgg">Disconnect</button>
          </div>

          <template v-if="!amvggCookie">
            <div style="font-size:12px;color:var(--text-3);line-height:1.6">
              DevTools (F12) → <b>Application</b> → Cookies → <i>amvgg.com</i><br>
              Copiá el <b>Value</b> de cada cookie y pegalo abajo.
            </div>
            <q-input
              v-model="cookieSessionData"
              type="password"
              dense outlined
              label="session_data"
              placeholder="Value de __Secure-better-auth.session_data"
              style="font-size:12px"
            />
            <q-input
              v-model="cookieSessionToken"
              type="password"
              dense outlined
              label="session_token"
              placeholder="Value de __Secure-better-auth.session_token"
              style="font-size:12px"
            />
            <button class="btn-search" style="width:auto;padding:8px 20px;margin-top:0" :disabled="!cookieSessionData.trim() || !cookieSessionToken.trim()" @click="saveAmvggCookie">
              Save & Connect
            </button>
          </template>

          <!-- Elvebredd section -->
          <div class="pub-divider" />

          <div class="pub-platform">
            <div class="pub-plat-info">
              <span class="pub-plat-logo">🦌</span>
              <div>
                <div class="pub-plat-name">Elvebredd</div>
                <div class="pub-plat-status" :class="elveCookie ? 'status--on' : 'status--off'">
                  {{ elveCookie ? 'Connected' : 'Not connected' }}
                </div>
              </div>
            </div>
            <button v-if="elveCookie" class="btn-sm-link" style="color:var(--negative)" @click="disconnectElve">Disconnect</button>
          </div>

          <template v-if="!elveCookie">
            <div style="font-size:12px;color:var(--text-3);line-height:1.6">
              DevTools (F12) → <b>Application</b> → Cookies → <i>elvebredd.com</i><br>
              Copiá el encabezado <b>Cookie</b> completo del request (Network tab).
            </div>
            <q-input
              v-model="cookieElveInput"
              type="password"
              dense outlined
              label="Cookie de sesión"
              placeholder="Pegá el valor completo del header Cookie"
              style="font-size:12px"
            />
            <button class="btn-search" style="width:auto;padding:8px 20px;margin-top:0" :disabled="!cookieElveInput.trim()" @click="saveElveCookie">
              Save & Connect
            </button>
          </template>

          <template v-else>
            <div v-if="elvePostResult?.ok" style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--positive);font-weight:700">
              <span>✓</span> Trade publicado en Elvebredd
            </div>
            <div v-else-if="elvePostResult?.ok === false" style="font-size:12px;color:var(--negative);font-weight:600;line-height:1.5">
              Error: {{ elvePostResult.error }}
            </div>
            <template v-if="!elvePostResult?.ok">
              <div class="elve-bookmarklet-section">
                <div class="elve-bm-label">1. Arrastrá esto a tu barra de bookmarks:</div>
                <a :href="ELVE_BOOKMARKLET" class="elve-bookmarklet-link" draggable="true" @click.prevent>🔑 Get Elve Token</a>
                <div class="elve-bm-label">2. En cualquier tab de elvebredd.com, hacé click → token copiado al clipboard.</div>
                <div class="elve-bm-label">3. Pegá el token acá (válido ~5 min):</div>
              </div>
              <q-input
                v-model="elveTurnstile"
                dense outlined
                label="Turnstile token"
                style="font-size:12px"
                clearable
              />
              <button
                class="btn-search"
                style="width:auto;padding:8px 20px;margin-top:0"
                :disabled="postingElve || !elveTurnstile.trim()"
                @click="publishToElve"
              >
                <q-spinner v-if="postingElve" size="14px" color="white" />
                <span>{{ postingElve ? 'Publicando…' : 'Post a Elvebredd' }}</span>
              </button>
            </template>
          </template>
        </div>

        <div class="pub-footer">
          <button class="btn-ghost" @click="showPublish = false">{{ postResult?.ok ? 'Close' : 'Cancel' }}</button>
          <button
            v-if="!postResult && amvggCookie"
            class="btn-search"
            style="width:auto;padding:8px 20px"
            :disabled="posting"
            @click="publishTrade"
          >
            <q-spinner v-if="posting" size="14px" color="white" />
            <span>{{ posting ? 'Posting…' : 'Post Trade' }}</span>
          </button>
        </div>
      </q-card>
    </q-dialog>

    <!-- Inventory picker dialog -->
    <q-dialog v-model="showInventoryPicker" @hide="resetPicker">
      <q-card class="picker-card">
        <q-card-section class="q-pb-sm">
          <div class="dialog-title">Add to offer</div>
          <div class="picker-tabs">
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': pickerTab === 'mine' }"
              @click="pickerTab = 'mine'"
            >My Pets</button>
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': pickerTab === 'other' }"
              @click="pickerTab = 'other'"
            >Other</button>
          </div>
        </q-card-section>
        <q-separator style="border-color: var(--border)" />

        <!-- My Pets tab -->
        <q-card-section v-if="pickerTab === 'mine'">
          <div class="empty-panel" v-if="!availableInventory.length">
            No pets available — add some in My Pets first.
          </div>
          <div class="picker-grid" v-else>
            <div
              class="picker-card-item"
              :class="{ 'picker-card-item--excluded': excludedPetIds.includes(pet.id) }"
              v-for="pet in sortedAvailableInventory"
              :key="pet.id"
              @click="addOffered(pet); showInventoryPicker = false"
            >
              <button
                class="picker-exclude-btn"
                :class="{ 'picker-exclude-btn--active': excludedPetIds.includes(pet.id) }"
                :title="excludedPetIds.includes(pet.id) ? 'Include in Auto' : 'Exclude from Auto'"
                @click.stop="toggleExcluded(pet.id)"
              >⊘</button>
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(pet.name)}.webp`"
                class="picker-card-img"
                @error="(e) => (e.target as HTMLImageElement).style.display='none'"
              />
              <div class="picker-card-name">{{ pet.name }}</div>
              <div class="picker-card-bottom">
                <span class="picker-card-form" :style="(!pet.category || pet.category === 'pet') ? { color: FORM_COLOR_HEX[pet.form] } : {}">
                  {{ pet.category && pet.category !== 'pet' ? CATEGORY_LABELS[pet.category] : FORM_LABELS[pet.form] }}
                </span>
                <span class="picker-card-val" v-if="values.getCached(pet.name, pet.form) != null">
                  {{ values.getCached(pet.name, pet.form) }}
                </span>
              </div>
            </div>
          </div>
        </q-card-section>

        <!-- Other tab -->
        <q-card-section v-else class="other-section">
          <!-- Category picker -->
          <div class="cat-picker-row">
            <button class="cat-picker-btn" :class="{ 'cat-picker-btn--active': pickerCategory === 'pet' }" @click="pickerCategory = 'pet'; petSearch = ''; searchResults = []">Pets</button>
            <button
              v-for="opt in itemCatOptions"
              :key="opt.value"
              class="cat-picker-btn"
              :class="{ 'cat-picker-btn--active': pickerCategory === opt.value }"
              @click="pickerCategory = opt.value; petSearch = ''; searchResults = []"
            >{{ opt.label }}</button>
          </div>

          <!-- Form chips — only for pets -->
          <template v-if="pickerCategory === 'pet'">
            <div class="form-section-label">Form</div>
            <div class="form-grid">
              <button class="form-chip" :class="{'form-chip--active': otherFly}" :style="otherFly ? {background: otherFlyGrad} : {}" @click="otherFly = !otherFly">F</button>
              <button class="form-chip" :class="{'form-chip--active': otherRide}" :style="otherRide ? {background: otherRideGrad} : {}" @click="otherRide = !otherRide">R</button>
              <button class="form-chip" :class="{'form-chip--active': otherIsNormal}" :style="otherIsNormal ? {background: otherNormGrad} : {}" @click="otherResetForm()">D</button>
              <button class="form-chip" :class="{'form-chip--active': otherNm === 'n'}" :style="otherNm === 'n' ? {background: otherNGrad} : {}" @click="otherNm = otherNm === 'n' ? 'none' : 'n'">N</button>
              <button class="form-chip" :class="{'form-chip--active': otherNm === 'm'}" :style="otherNm === 'm' ? {background: otherMGrad} : {}" @click="otherNm = otherNm === 'm' ? 'none' : 'm'">M</button>
            </div>
          </template>

          <q-input
            v-model="petSearch"
            dense outlined
            :placeholder="pickerCategory === 'pet' ? 'Search pet…' : `Search ${CATEGORY_LABELS[pickerCategory]}…`"
            :debounce="250"
            clearable
            style="margin-top: 10px"
          >
            <template #prepend><q-icon :name="matSearch" size="16px" style="color:var(--text-3)" /></template>
          </q-input>
          <div class="results-panel">
            <div class="results-state" v-if="!petSearch.trim()">Start typing to search</div>
            <div class="results-state" v-else-if="searchLoading"><q-spinner size="14px" color="primary" /><span>Searching…</span></div>
            <div class="results-state" v-else-if="!searchResults.length">No results for "{{ petSearch }}"</div>
            <div
              v-else
              class="result-item"
              v-for="name in searchResults"
              :key="name"
              @mousedown.prevent="addOtherPet(name)"
            >
              <div class="result-img-wrap">
                <img
                  :src="`https://amvgg.com/items/${encodeURIComponent(name)}.webp`"
                  class="result-img"
                  @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                />
                <div class="result-img-placeholder">🐾</div>
              </div>
              <span class="result-name">{{ name }}</span>
              <span v-if="pickerCategory === 'pet'" class="form-pill" :style="{ color: FORM_COLOR_HEX[otherPickerForm], marginLeft: 'auto' }">{{ FORM_LABELS[otherPickerForm] }}</span>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <button class="btn-ghost" @click="showInventoryPicker = false">Close</button>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Auto Publish dialog -->
    <q-dialog v-model="showAutoDialog" @hide="() => { if (!autoPublishing) { autoTrades.value = []; autoGenError.value = '' } }">
      <q-card class="auto-card">
        <div class="pub-header">
          <div class="dialog-title">Auto Publish</div>
          <div class="auto-platform-toggles">
            <button
              class="auto-platform-toggle"
              :class="{ 'auto-platform-toggle--on': autoEnableAmv }"
              :disabled="autoGenerating || autoPublishing"
              @click="autoEnableAmv = !autoEnableAmv"
            >AMV</button>
            <button
              class="auto-platform-toggle auto-platform-toggle--elve"
              :class="{ 'auto-platform-toggle--on': autoEnableElve }"
              :disabled="autoGenerating || autoPublishing"
              @click="autoEnableElve = !autoEnableElve"
            >Elve</button>
          </div>
          <div class="auto-form-row">
            <span class="control-label" style="font-size:11px">Want form</span>
            <q-select v-model="desiredForm" :options="formOptions" outlined dense emit-value map-options style="width:110px" :disable="autoGenerating || autoPublishing" />
          </div>
        </div>

        <div v-if="autoGenerating" class="auto-generating">
          <q-spinner size="22px" color="primary" />
          <span>Finding fair trades…</span>
        </div>

        <div v-else-if="autoGenError" class="auto-error">{{ autoGenError }}</div>

        <div v-else-if="autoTrades.length" class="auto-trades-list">
          <div class="auto-trade-row" v-for="(trade, i) in autoTrades" :key="i"
            :class="trade.platform === 'elvebredd' ? 'auto-trade-row--elve' : ''"
          >
            <div class="auto-side auto-side--offered">
              <div class="auto-offered-list">
                <div class="auto-offered-pet" v-for="p in trade.offered" :key="p.id">
                  <img
                    :src="`https://amvgg.com/items/${encodeURIComponent(p.name)}.webp`"
                    class="auto-pet-img"
                    @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                  />
                  <div class="auto-offered-info">
                    <span class="auto-offered-name">{{ p.name }}</span>
                    <span class="auto-offered-form" :style="{ color: FORM_COLOR_HEX[p.form] }">{{ FORM_LABELS[p.form] }}</span>
                  </div>
                </div>
              </div>
              <span class="auto-val">{{ trade.offeredAmv.toFixed(4) }}</span>
            </div>

            <div class="auto-arrow">→</div>

            <div class="auto-side">
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(trade.wanted.name)}.webp`"
                class="auto-pet-img"
                @error="(e) => (e.target as HTMLImageElement).style.display='none'"
              />
              <div class="auto-wanted-info">
                <span class="auto-wanted-name">{{ trade.wanted.name }}</span>
                <span class="auto-wanted-form" :style="{ color: FORM_COLOR_HEX[trade.wanted.form] }">{{ FORM_LABELS[trade.wanted.form] }}</span>
              </div>
              <span class="auto-val">{{ trade.wantedAmv.toFixed(4) }}</span>
              <button
                class="auto-exclude-btn"
                :class="{ 'auto-exclude-btn--active': excludedWantedNames.includes(trade.wanted.name) }"
                :title="excludedWantedNames.includes(trade.wanted.name) ? 'Remove from excluded' : 'Exclude from Auto'"
                @click="toggleExcludedWanted(trade.wanted.name)"
              >⊘</button>
            </div>

            <div class="auto-deltas">
              <span class="auto-delta-chip" :class="trade.amvDelta >= -1 ? 'chip--green' : 'chip--amber'">
                AMV {{ trade.amvDelta.toFixed(1) }}%
              </span>
              <span v-if="trade.elveDelta != null" class="auto-delta-chip" :class="trade.elveDelta >= -1 ? 'chip--green' : 'chip--amber'">
                Elve {{ trade.elveDelta.toFixed(1) }}%
              </span>
            </div>

            <div class="auto-status">
              <q-spinner v-if="trade.status === 'posting'" size="14px" color="primary" />
              <span v-else-if="trade.status === 'ok'" class="status-ok">✓</span>
              <span v-else-if="trade.status === 'error'" class="status-err" :title="trade.error">✗</span>
            </div>
            <span class="auto-plat-badge" :class="trade.platform === 'amvgg' ? 'badge--amv' : 'badge--elve'">
              {{ trade.platform === 'amvgg' ? 'AMV' : 'Elve' }}
            </span>
          </div>

          <!-- Elve error note -->
          <div v-if="autoElveGenError" class="auto-elve-note">{{ autoElveGenError }}</div>

          <!-- Elve publish section -->
          <div v-if="autoEnableElve && pendingElveCount > 0 && !autoLoop && !autoPublishing" class="auto-elve-publish">
            <div class="auto-elve-publish-label">
              Publicar {{ pendingElveCount }} trades en Elvebredd — pegá un token del bookmarklet:
            </div>
            <div class="auto-elve-publish-row">
              <q-input
                v-model="autoElveTurnstile"
                dense outlined
                label="Turnstile token"
                style="flex:1;font-size:12px"
                clearable
              />
              <button
                class="btn-search"
                style="width:auto;padding:8px 16px;white-space:nowrap"
                :disabled="!elveCookie || !autoElveTurnstile.trim()"
                @click="publishElveAutoTrades"
              >
                Publish {{ pendingElveCount }} Elve
              </button>
            </div>
            <div v-if="!elveCookie" style="font-size:11px;color:var(--negative)">
              Conectá Elvebredd en el diálogo Publish primero.
            </div>
          </div>
        </div>

        <div class="pub-footer">
          <button class="btn-ghost" :disabled="autoGenerating || autoPublishing" @click="showAutoDialog = false">Close</button>
          <div v-if="autoLoop && loopCountdown > 0" class="loop-countdown">
            Next in {{ loopCountdownLabel }}
          </div>
          <button v-if="autoLoop" class="btn-ghost loop-stop" @click="clearLoop" :disabled="autoGenerating || autoPublishing">
            Stop Loop
          </button>
          <template v-if="!autoLoop">
            <button v-if="!autoGenerating && autoTrades.length && !autoPublishing" class="btn-ghost" @click="generateAutoTrades">
              Regenerate
            </button>
            <button
              v-if="!autoGenerating && autoEnableAmv && pendingAmvCount > 0"
              class="btn-search" style="width:auto;padding:8px 20px"
              :disabled="autoPublishing || !amvggCookie"
              @click="publishAutoTrades"
            >
              <q-spinner v-if="autoPublishing" size="14px" color="white" />
              <span>{{ autoPublishing ? 'Publishing…' : `Publish ${pendingAmvCount} AMV` }}</span>
            </button>
            <button
              v-if="!autoGenerating && autoTrades.length && amvggCookie"
              class="btn-search btn-loop" style="width:auto;padding:8px 20px"
              :disabled="autoPublishing"
              @click="startAutoLoop"
            >
              <q-icon :name="matAutoAwesome" size="14px" />
              <span>Start Loop</span>
            </button>
          </template>
        </div>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  matUpload, matAdd, matMonetizationOn, matClose, matSwapHoriz,
  matAutoAwesome, matAddCircleOutline, matSearch, matWarning, matPublish,
} from '@quasar/extras/material-icons'

interface AutoTrade {
  platform:     'amvgg' | 'elvebredd'
  offered:      InventoryPet[]
  offeredAmv:   number
  offeredElve:  number | null
  wanted:       { name: string; form: PetForm }
  wantedAmv:    number
  wantedElve:   number | null
  amvDelta:     number
  elveDelta:    number | null
  status:       'pending' | 'posting' | 'ok' | 'error'
  error?:       string
}
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { useFormPicker } from 'src/composables/useFormPicker'
import {
  FORM_LABELS, FORM_COLOR_HEX, CATEGORY_LABELS,
  type PetForm, type InventoryPet, type ItemCategory, type PetSuggestion,
} from 'src/types'

const inventory = useInventoryStore()
const values    = useValuesStore()

// ── State ─────────────────────────────────────────────────────────────────────
interface OfferedItem {
  pet: InventoryPet
  amvggValue: number | null
  elveValue: number | null
  demand: DemandLevel
  loading: boolean
}

interface SuggestionWithDemand extends PetSuggestion {
  demand: DemandLevel
  elveValue: number | null
}

const offeredPets         = ref<OfferedItem[]>([])
const desiredForm         = ref<PetForm>('fr')
const suggestions         = ref<SuggestionWithDemand[]>([])
const showInventoryPicker = ref(false)
const searching           = ref(false)
const searchDone          = ref(false)

const valueSource         = ref<'amvgg' | 'elvebredd'>('amvgg')

const excludedPetIds = ref<string[]>(JSON.parse(localStorage.getItem('excluded_pet_ids') ?? '[]'))

function toggleExcluded (petId: string) {
  const idx = excludedPetIds.value.indexOf(petId)
  if (idx !== -1) excludedPetIds.value.splice(idx, 1)
  else excludedPetIds.value.push(petId)
  localStorage.setItem('excluded_pet_ids', JSON.stringify(excludedPetIds.value))
}

const excludedWantedNames = ref<string[]>(JSON.parse(localStorage.getItem('excluded_wanted_names') ?? '[]'))

function toggleExcludedWanted (name: string) {
  const idx = excludedWantedNames.value.indexOf(name)
  if (idx !== -1) excludedWantedNames.value.splice(idx, 1)
  else excludedWantedNames.value.push(name)
  localStorage.setItem('excluded_wanted_names', JSON.stringify(excludedWantedNames.value))
}

// Picker state
const pickerTab      = ref<'mine' | 'other'>('mine')
const pickerCategory = ref<ItemCategory>('pet')
const petSearch      = ref('')
const searchResults  = ref<string[]>([])
const searchLoading  = ref(false)

const itemCatOptions = [
  { label: 'Pet Wear',  value: 'petWear'  },
  { label: 'Eggs',      value: 'egg'      },
  { label: 'Strollers', value: 'stroller' },
  { label: 'Food',      value: 'food'     },
  { label: 'Vehicles',  value: 'vehicle'  },
  { label: 'Toys',      value: 'toy'      },
  { label: 'Gifts',     value: 'gift'     },
  { label: 'Stickers',  value: 'sticker'  },
  { label: 'Houses',    value: 'house'    },
]

const {
  flyPick: otherFly, ridePick: otherRide, nmPick: otherNm,
  form: otherPickerForm, reset: otherResetForm, isNormal: otherIsNormal,
  flyGrad: otherFlyGrad, rideGrad: otherRideGrad, normGrad: otherNormGrad,
  nGrad: otherNGrad, mGrad: otherMGrad,
} = useFormPicker()

watch(petSearch, async (q) => {
  if (!q.trim()) { searchResults.value = []; return }
  searchLoading.value = true
  try {
    const url = pickerCategory.value === 'pet'
      ? `/api/pets/search?q=${encodeURIComponent(q)}`
      : `/api/items/search?q=${encodeURIComponent(q)}&category=${pickerCategory.value}`
    const res = await fetch(url)
    searchResults.value = await res.json() as string[]
  } finally {
    searchLoading.value = false
  }
})

function resetPicker () {
  pickerTab.value      = 'mine'
  pickerCategory.value = 'pet'
  petSearch.value      = ''
  searchResults.value  = []
  otherResetForm()
}

function addOtherPet (name: string) {
  const synthetic: InventoryPet = {
    id:       `${name}-${pickerCategory.value}-${Date.now()}`,
    name,
    form:     pickerCategory.value === 'pet' ? otherPickerForm.value : 'normal',
    category: pickerCategory.value,
  }
  addOffered(synthetic)
  showInventoryPicker.value = false
}

const formOptions = Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))

const availableInventory = computed(() =>
  inventory.pets.filter(p => !offeredPets.value.some(o => o.pet.id === p.id))
)

const sortedAvailableInventory = computed(() =>
  [...availableInventory.value].sort((a, b) => {
    const va = values.getCached(a.name, a.form) ?? -1
    const vb = values.getCached(b.name, b.form) ?? -1
    return vb - va
  })
)

watch(showInventoryPicker, async (open) => {
  if (open && inventory.pets.length) {
    await values.getBatch(inventory.pets.map(p => ({ name: p.name, form: p.form })))
  }
})

const totalOfferedAmvgg = computed(() =>
  offeredPets.value.reduce((acc, item) => acc + (item.amvggValue ?? 0), 0)
)

const totalOfferedElve = computed(() =>
  offeredPets.value.reduce((acc, item) => acc + (item.elveValue ?? 0), 0)
)

const totalOfferedValue = computed(() =>
  valueSource.value === 'elvebredd' ? totalOfferedElve.value : totalOfferedAmvgg.value
)

const anyOfferedLoading = computed(() => offeredPets.value.some(o => o.loading))

// ── Demand helpers ─────────────────────────────────────────────────────────────
const DEMAND_MULT: Record<string, number> = {
  'High': 1.0, 'Medium': 0.88, 'Low': 0.70, 'Very Low': 0.50,
}

function demandMult (d: DemandLevel) {
  return DEMAND_MULT[d ?? 'Medium'] ?? 0.88
}

function demandClass (d: DemandLevel) {
  if (d === 'High') return 'high'
  if (d === 'Medium') return 'medium'
  return 'low'
}

function demandStars (d: DemandLevel): string {
  const n = d === 'High' ? 3 : d === 'Medium' ? 2 : d === 'Low' ? 1 : d === 'Very Low' ? 1 : 0
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}

function getFormDemand (details: { demands: Record<string, string | null> }, form: PetForm): DemandLevel {
  return (details.demands[form] ?? null) as DemandLevel
}

// ── Fairness ──────────────────────────────────────────────────────────────────
const fairness = computed<number | null>(() => {
  if (!offeredPets.value.length || totalOfferedValue.value === 0) return null
  if (suggestions.value.length === 0) return null
  const top = suggestions.value[0]
  if (top.value === null) return null
  const offeredAdjusted = offeredPets.value.reduce((acc, item) => {
    return acc + (item.amvggValue ?? 0) * demandMult(item.demand)
  }, 0)
  const receivedAdjusted = (top.amvggValue ?? 0) * demandMult(top.demand)
  if (receivedAdjusted === 0) return null
  return ((receivedAdjusted - offeredAdjusted) / offeredAdjusted) * 100
})

const fairnessClass = computed(() => {
  const f = fairness.value
  if (f === null) return ''
  if (f >= -5) return 'fair--good'
  if (f >= -20) return 'fair--warn'
  return 'fair--bad'
})

const demandWarning = computed(() => {
  if (!offeredPets.value.length || !suggestions.value.length) return null
  const topSug = suggestions.value[0]
  const highDemandOffered = offeredPets.value.some(i => i.demand === 'High')
  const lowDemandReceived = topSug.demand === 'Low' || topSug.demand === 'Very Low'
  if (highDemandOffered && lowDemandReceived) return 'Giving High for Low demand'
  return null
})

// ── Actions ───────────────────────────────────────────────────────────────────
async function addOffered (pet: InventoryPet) {
  const item: OfferedItem = { pet, amvggValue: null, elveValue: null, demand: null, loading: true }
  offeredPets.value.push(item)

  try {
    if (pet.category && pet.category !== 'pet') {
      const res  = await fetch(`/api/item/details?name=${encodeURIComponent(pet.name)}&category=${pet.category}`)
      const data = await res.json() as { value: number | null; demand: string | null; elveValue: number | null }
      const found = offeredPets.value.find(o => o.pet.id === pet.id)
      if (found) { found.amvggValue = data.value; found.elveValue = data.elveValue; found.demand = data.demand as DemandLevel }
      return
    }

    const [detailsResult, elveResult] = await Promise.allSettled([
      fetch(`/api/pet/details?name=${encodeURIComponent(pet.name)}`).then(r => r.json()) as Promise<{ values: Record<string, number | null>; demands: Record<string, string | null> }>,
      values.getElveValue(pet.name, pet.form),
    ])
    const found = offeredPets.value.find(o => o.pet.id === pet.id)
    if (!found) return

    if (detailsResult.status === 'fulfilled') {
      found.demand = getFormDemand(detailsResult.value, pet.form)
      found.amvggValue = detailsResult.value.values[pet.form] ?? null
    } else {
      found.amvggValue = await values.getValue(pet.name, pet.form)
    }

    if (elveResult.status === 'fulfilled') found.elveValue = elveResult.value
  } finally {
    const found = offeredPets.value.find(o => o.pet.id === pet.id)
    if (found) found.loading = false
  }
}

function removeOffered (id: string) {
  const idx = offeredPets.value.findIndex(o => o.pet.id === id)
  if (idx !== -1) offeredPets.value.splice(idx, 1)
  suggestions.value = []
  searchDone.value  = false
}

// ── Search ────────────────────────────────────────────────────────────────────
const TOLERANCE = 0.02

async function search () {
  if (!offeredPets.value.length || totalOfferedValue.value === 0) return
  searching.value   = true
  searchDone.value  = false
  suggestions.value = []

  try {
    await values.loadAllPets()

    const target     = totalOfferedValue.value
    const form       = desiredForm.value
    const candidates = values.allPets.filter(
      p => !offeredPets.value.some(o => o.pet.name === p.name)
    )

    const batchRequests = candidates.map(p => ({ name: p.name, form }))
    const [amvBatch, elveBatch] = await Promise.all([
      values.getBatch(batchRequests),
      values.getElveBatch(batchRequests),
    ])

    const elveMap = new Map(elveBatch.map(r => [`${r.name}|${r.form}`, r.value]))
    const primaryBatch = valueSource.value === 'elvebredd' ? elveBatch : amvBatch

    const results: SuggestionWithDemand[] = []
    for (const req of batchRequests) {
      const val = primaryBatch.find(r => r.name === req.name && r.form === req.form)?.value
      if (val === null || val === undefined) continue
      const delta = ((val - target) / target) * 100
      if (Math.abs(delta) <= TOLERANCE * 100) {
        const amvEntry = amvBatch.find(r => r.name === req.name && r.form === req.form)
        results.push({
          name: req.name,
          form,
          amvggValue: amvEntry?.value ?? null,
          elveValue: elveMap.get(`${req.name}|${req.form}`) ?? null,
          delta,
          demand: null,
        })
      }
    }

    results.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    const top20 = results.slice(0, 20)

    await Promise.all(top20.map(async s => {
      try {
        const res     = await fetch(`/api/pet/details?name=${encodeURIComponent(s.name)}`)
        const details = await res.json() as { demands: Record<string, string | null> }
        s.demand = getFormDemand(details, s.form as PetForm)
      } catch { /* demand stays null */ }
    }))

    suggestions.value = top20
    searchDone.value  = true
  } finally {
    searching.value = false
  }
}

// ── Publish trade ─────────────────────────────────────────────────────────────

const selectedSuggestion = ref<SuggestionWithDemand | null>(null)
const showPublish        = ref(false)
const amvggCookie        = ref('')
const cookieSessionData  = ref('')
const cookieSessionToken = ref('')
const posting            = ref(false)
const postResult         = ref<{ ok: boolean; error?: string } | null>(null)

const elveCookie      = ref('')
const cookieElveInput = ref('')
const postingElve     = ref(false)
const elvePostResult  = ref<{ ok: boolean; error?: string } | null>(null)
const elveTurnstile   = ref('')

// eslint-disable-next-line no-useless-escape
const ELVE_BOOKMARKLET = `javascript:(async()=>{if(!window.turnstile){alert('Abrí esto en elvebredd.com');return;}window.turnstile.execute();let t='',n=0;while(!t&&n<50){await new Promise(r=>setTimeout(r,200));t=window.turnstile.getResponse();n++;}if(!t){alert('Token fallido, intentá de nuevo');return;}await navigator.clipboard.writeText(t);alert('Token copiado al clipboard!');})();`

onMounted(() => {
  amvggCookie.value = localStorage.getItem('amvgg_cookie') ?? ''
  elveCookie.value  = localStorage.getItem('elve_cookie') ?? ''
})

function saveAmvggCookie () {
  const combined = `__Secure-better-auth.session_data=${cookieSessionData.value.trim()}; __Secure-better-auth.session_token=${cookieSessionToken.value.trim()}`
  amvggCookie.value = combined
  localStorage.setItem('amvgg_cookie', combined)
  cookieSessionData.value  = ''
  cookieSessionToken.value = ''
}

function disconnectAmvgg () {
  amvggCookie.value = ''
  localStorage.removeItem('amvgg_cookie')
}

function saveElveCookie () {
  elveCookie.value = cookieElveInput.value.trim()
  localStorage.setItem('elve_cookie', elveCookie.value)
  cookieElveInput.value = ''
}

function disconnectElve () {
  elveCookie.value = ''
  localStorage.removeItem('elve_cookie')
}

async function publishToElve () {
  if (!selectedSuggestion.value || !elveCookie.value) return
  postingElve.value    = true
  elvePostResult.value = null
  try {
    const res  = await fetch('/api/trade/post-elve', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookie:         elveCookie.value,
        offered:        offeredPets.value.map(o => ({ name: o.pet.name, form: o.pet.form })),
        wanted:         [{ name: selectedSuggestion.value!.name, form: selectedSuggestion.value!.form }],
        turnstileToken: elveTurnstile.value.trim() || undefined,
      }),
    })
    const data = await res.json() as { ok: boolean; error?: string }
    elvePostResult.value = data
  } catch (e) {
    elvePostResult.value = { ok: false, error: String(e) }
  } finally {
    postingElve.value = false
  }
}

async function publishTrade () {
  if (!selectedSuggestion.value || !amvggCookie.value) return
  posting.value    = true
  postResult.value = null
  try {
    const res = await fetch('/api/trade/post-amvgg', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookie:  amvggCookie.value,
        offered: offeredPets.value.map(o => ({
          name:         o.pet.name,
          form:         o.pet.form,
          itemCategory: o.pet.category,
        })),
        wanted: [{
          name: selectedSuggestion.value!.name,
          form: selectedSuggestion.value!.form,
        }],
      }),
    })
    const data = await res.json() as { ok: boolean; error?: string }
    postResult.value = data
    if (!data.ok && data.error?.includes('401')) disconnectAmvgg()
  } catch (e) {
    postResult.value = { ok: false, error: String(e) }
  } finally {
    posting.value = false
  }
}

// ── Auto Publish ──────────────────────────────────────────────────────────────

const showAutoDialog    = ref(false)
const autoGenerating    = ref(false)
const autoPublishing    = ref(false)
const autoTrades        = ref<AutoTrade[]>([])
const autoGenError      = ref('')
const autoElveGenError  = ref('')
const autoElveTurnstile = ref('')
const autoLoop          = ref(false)
const autoEnableAmv     = ref(true)
const autoEnableElve    = ref(true)

const pendingAmvCount  = computed(() => autoTrades.value.filter(t => t.platform === 'amvgg'      && t.status === 'pending').length)
const pendingElveCount = computed(() => autoTrades.value.filter(t => t.platform === 'elvebredd'  && t.status === 'pending').length)
const loopCountdown   = ref(0)
let   _loopTimer:      ReturnType<typeof setTimeout>  | null = null
let   _countdownTimer: ReturnType<typeof setInterval> | null = null

const LOOP_INTERVAL_S = 150

const loopCountdownLabel = computed(() => {
  const m = Math.floor(loopCountdown.value / 60)
  const s = loopCountdown.value % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
})

function clearLoop () {
  autoLoop.value = false
  if (_loopTimer)      { clearTimeout(_loopTimer);      _loopTimer      = null }
  if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null }
  loopCountdown.value = 0
}

function scheduleNextLoop () {
  if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null }
  if (_loopTimer)      { clearTimeout(_loopTimer);       _loopTimer      = null }
  loopCountdown.value = LOOP_INTERVAL_S
  _countdownTimer = setInterval(() => {
    loopCountdown.value--
    if (loopCountdown.value <= 0 && _countdownTimer) {
      clearInterval(_countdownTimer)
      _countdownTimer = null
    }
  }, 1000)
  _loopTimer = setTimeout(async () => {
    if (!autoLoop.value) return
    await generateAutoTrades()
    if (!autoLoop.value) return
    if (autoGenError.value || !autoTrades.value.length) { clearLoop(); return }
    if (autoEnableAmv.value) await publishAutoTrades()
    if (autoLoop.value && autoEnableElve.value && elveCookie.value && autoElveTurnstile.value.trim()) await publishElveAutoTrades()
    if (autoLoop.value) scheduleNextLoop()
  }, LOOP_INTERVAL_S * 1000)
}

async function startAutoLoop () {
  autoLoop.value = true
  if (autoEnableAmv.value) await publishAutoTrades()
  if (autoLoop.value && autoEnableElve.value && elveCookie.value && autoElveTurnstile.value.trim()) await publishElveAutoTrades()
  if (autoLoop.value) scheduleNextLoop()
}

watch(showAutoDialog, (open) => { if (!open) clearLoop() })
onUnmounted(() => clearLoop())

function startAuto () {
  if (!amvggCookie.value) { showPublish.value = true; return }
  showAutoDialog.value = true
  autoTrades.value     = []
  autoGenError.value   = ''
  void generateAutoTrades()
}

async function generateAutoTrades () {
  autoGenerating.value  = true
  autoTrades.value      = []
  autoGenError.value    = ''
  autoElveGenError.value = ''
  try {
    await values.loadAllPets()

    const invReqs = inventory.pets.map(p => ({ name: p.name, form: p.form }))
    const [invAmvBatch, invElveBatch] = await Promise.all([
      values.getBatch(invReqs),
      values.getElveBatch(invReqs),
    ])
    const invAmvMap  = new Map(invAmvBatch.map(r  => [`${r.name}|${r.form}`, r.value]))
    const invElveMap = new Map(invElveBatch.map(r => [`${r.name}|${r.form}`, r.value]))

    const allDemands = await fetch('/api/pets/demands')
      .then(r => r.json()) as Record<string, Record<string, DemandLevel>>

    const valued = inventory.pets.filter(p => {
      if (excludedPetIds.value.includes(p.id)) return false
      const v = invAmvMap.get(`${p.name}|${p.form}`)
      return v != null && v > 0
    })
    if (valued.length < 2) { autoGenError.value = 'Need at least 2 inventory pets with known values.'; return }

    const wantReqs = values.allPets.map(p => ({ name: p.name, form: desiredForm.value }))
    const [wantAmvBatch, wantElveBatch] = await Promise.all([
      values.getBatch(wantReqs),
      values.getElveBatch(wantReqs),
    ])
    const wantAmvMap  = new Map(wantAmvBatch.map(r  => [r.name, r.value]))
    const wantElveMap = new Map(wantElveBatch.map(r => [r.name, r.value]))

    const usedWanted = new Set<string>()

    if (autoEnableAmv.value) {
      let attempts = 0
      while (autoTrades.value.length < 5 && attempts < 300) {
        attempts++

        const shuffled = [...valued].sort(() => Math.random() - 0.5)
        const count    = Math.min(Math.floor(Math.random() * 4) + 2, shuffled.length)
        const offered  = shuffled.slice(0, count)

        const offeredAmv = offered.reduce((s, p) => s + (invAmvMap.get(`${p.name}|${p.form}`) ?? 0), 0)
        const elveVals   = offered.map(p => invElveMap.get(`${p.name}|${p.form}`) ?? null)
        const allHaveElve = elveVals.every(v => v != null)
        const offeredElve = allHaveElve ? elveVals.reduce<number>((s, v) => s + (v ?? 0), 0) : null

        if (offeredAmv === 0) continue

        const candidates = values.allPets.filter(p => {
          if (usedWanted.has(p.name)) return false
          if (excludedWantedNames.value.includes(p.name)) return false
          if (offered.some(o => o.name === p.name)) return false
          const wa = wantAmvMap.get(p.name)
          if (!wa || wa === 0) return false
          const ratio = wa / offeredAmv
          if (ratio < 0.97 || ratio > 1.0) return false
          const wd = allDemands[p.name]?.[desiredForm.value] ?? null
          if (wd === 'Low' || wd === 'Very Low') return false
          if (offeredElve != null && offeredElve > 0) {
            const we = wantElveMap.get(p.name)
            if (we != null && we / offeredElve < 0.98) return false
          }
          return true
        })

        if (!candidates.length) continue

        const wanted     = candidates[Math.floor(Math.random() * candidates.length)]!
        const wantedAmv  = wantAmvMap.get(wanted.name)!
        const wantedElve = wantElveMap.get(wanted.name) ?? null
        usedWanted.add(wanted.name)

        autoTrades.value.push({
          platform: 'amvgg',
          offered, offeredAmv, offeredElve,
          wanted: { name: wanted.name, form: desiredForm.value },
          wantedAmv, wantedElve,
          amvDelta:  ((wantedAmv - offeredAmv) / offeredAmv) * 100,
          elveDelta: offeredElve != null && wantedElve != null
            ? ((wantedElve - offeredElve) / offeredElve) * 100 : null,
          status: 'pending',
        })
      }

      if (!autoTrades.value.some(t => t.platform === 'amvgg')) {
        autoGenError.value = 'No matching trades found. Try a different form or add more pets.'
      }
    }

    // ── Elve trades (10, criteria: 0% elve loss, max -1% amv loss) ──────────
    if (autoEnableElve.value) {
      const elveValued = inventory.pets.filter(p => {
        if (excludedPetIds.value.includes(p.id)) return false
        const va = invAmvMap.get(`${p.name}|${p.form}`)
        const ve = invElveMap.get(`${p.name}|${p.form}`)
        return va != null && va > 0 && ve != null && ve > 0
      })

      if (elveValued.length >= 2) {
        let elveAttempts = 0
        while (autoTrades.value.filter(t => t.platform === 'elvebredd').length < 10 && elveAttempts < 400) {
          elveAttempts++
          const shuffled   = [...elveValued].sort(() => Math.random() - 0.5)
          const count      = Math.min(Math.floor(Math.random() * 4) + 2, shuffled.length)
          const offered    = shuffled.slice(0, count)
          const offeredAmv  = offered.reduce((s, p) => s + (invAmvMap.get(`${p.name}|${p.form}`) ?? 0), 0)
          const offeredElve = offered.reduce((s, p) => s + (invElveMap.get(`${p.name}|${p.form}`) ?? 0), 0)
          if (offeredAmv === 0 || offeredElve === 0) continue

          const candidates = values.allPets.filter(p => {
            if (usedWanted.has(p.name)) return false
            if (excludedWantedNames.value.includes(p.name)) return false
            if (offered.some(o => o.name === p.name)) return false
            const wa = wantAmvMap.get(p.name)
            if (!wa || wa === 0) return false
            if (wa / offeredAmv < 0.99) return false
            const we = wantElveMap.get(p.name)
            if (we == null || we === 0) return false
            if (we / offeredElve < 1.0) return false
            const wd = allDemands[p.name]?.[desiredForm.value] ?? null
            if (wd === 'Low' || wd === 'Very Low') return false
            return true
          })

          if (!candidates.length) continue
          const wanted     = candidates[Math.floor(Math.random() * candidates.length)]!
          const wantedAmv  = wantAmvMap.get(wanted.name)!
          const wantedElve = wantElveMap.get(wanted.name)!
          usedWanted.add(wanted.name)

          autoTrades.value.push({
            platform: 'elvebredd',
            offered, offeredAmv, offeredElve,
            wanted: { name: wanted.name, form: desiredForm.value },
            wantedAmv, wantedElve,
            amvDelta:  ((wantedAmv - offeredAmv) / offeredAmv) * 100,
            elveDelta: ((wantedElve - offeredElve) / offeredElve) * 100,
            status: 'pending',
          })
        }
        if (!autoTrades.value.some(t => t.platform === 'elvebredd'))
          autoElveGenError.value = 'No Elve trades found (0% Elve loss + max -1% AMV). Try another form.'
      } else {
        autoElveGenError.value = elveValued.length === 0
          ? 'No inventory pets with Elve values — Elve trades skipped.'
          : 'Need at least 2 inventory pets with Elve values for Elve trades.'
      }
    }
  } catch (e) {
    autoGenError.value = String(e)
  } finally {
    autoGenerating.value = false
  }
}

async function publishAutoTrades () {
  autoPublishing.value = true
  for (const trade of autoTrades.value) {
    if (trade.platform !== 'amvgg' || trade.status !== 'pending') continue
    if (!amvggCookie.value) break
    trade.status = 'posting'
    try {
      const res  = await fetch('/api/trade/post-amvgg', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie:  amvggCookie.value,
          offered: trade.offered.map(o => ({ name: o.name, form: o.form, itemCategory: o.category })),
          wanted:  [{ name: trade.wanted.name, form: trade.wanted.form }],
        }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      trade.status = data.ok ? 'ok' : 'error'
      trade.error  = data.error
      if (!data.ok && data.error?.includes('401')) disconnectAmvgg()
    } catch (e) {
      trade.status = 'error'
      trade.error  = String(e)
    }
  }
  autoPublishing.value = false
}

async function publishElveAutoTrades () {
  if (!elveCookie.value) return
  autoPublishing.value = true
  const token = autoElveTurnstile.value.trim() || undefined
  for (const trade of autoTrades.value) {
    if (trade.platform !== 'elvebredd' || trade.status !== 'pending') continue
    trade.status = 'posting'
    try {
      const res  = await fetch('/api/trade/post-elve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie:         elveCookie.value,
          offered:        trade.offered.map(o => ({ name: o.name, form: o.form })),
          wanted:         [{ name: trade.wanted.name, form: trade.wanted.form }],
          turnstileToken: token,
        }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      trade.status = data.ok ? 'ok' : 'error'
      trade.error  = data.error
    } catch (e) {
      trade.status = 'error'
      trade.error  = String(e)
    }
  }
  autoPublishing.value = false
}

// ── Delta helpers ─────────────────────────────────────────────────────────────
function deltaCardClass (delta: number) {
  if (Math.abs(delta) < 5)  return 'sug-card--green'
  if (Math.abs(delta) < 15) return 'sug-card--amber'
  return 'sug-card--red'
}

function deltaChipClass (delta: number) {
  if (Math.abs(delta) < 5)  return 'chip--green'
  if (Math.abs(delta) < 15) return 'chip--amber'
  return 'chip--red'
}
</script>

<style scoped>
.trade-page {
  padding: 28px;
  min-height: 100vh;
}

.page-head    { margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
.page-title   { font-size: 26px; font-weight: 800; color: var(--text-1); letter-spacing: -0.5px; }
.page-sub     { font-size: 13px; font-weight: 600; color: var(--text-3); margin-top: 3px; }

.source-toggle {
  display: flex;
  gap: 4px;
  background: var(--surface-2);
  border-radius: 8px;
  padding: 3px;
}

.source-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  color: var(--text-2);
  transition: background 0.15s, color 0.15s;
}

.source-btn--active {
  background: var(--primary);
  color: #fff;
}

.trade-layout {
  display: grid;
  grid-template-columns: 1fr 148px 1fr;
  gap: 16px;
  align-items: start;
}

/* Panel */
.trade-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.panel-count {
  margin-left: auto;
  background: var(--surface-3);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 700;
  border-radius: 20px;
  padding: 1px 8px;
}

.panel-body {
  padding: 12px;
  flex: 1;
  min-height: 200px;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
}

.footer-label { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.8px; }
.footer-totals { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.footer-total-row { display: flex; align-items: baseline; gap: 5px; }
.footer-src { font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; }
.footer-value { font-size: 14px; font-weight: 800; color: var(--gold); }

/* Controls */
.trade-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 40px;
}

.swap-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Fairness */
.fairness-wrap {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.fairness-score {
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.5px;
}

.fair--good { color: var(--positive); }
.fair--warn { color: var(--gold); }
.fair--bad  { color: var(--negative); }

.fairness-label {
  font-size: 10px;
  color: var(--text-3);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.demand-warning {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--negative);
  margin-top: 2px;
  text-align: center;
}

.control-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.btn-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border: none;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  width: 100%;
  justify-content: center;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-search:hover:not(:disabled) { opacity: 0.88; }
.btn-search:active:not(:disabled) { transform: scale(0.97); }
.btn-search:disabled { opacity: 0.35; cursor: not-allowed; }

/* Demand stars */
.demand-stars {
  font-size: 11px;
  letter-spacing: 1px;
  line-height: 1;
}
.stars--high   { color: #34d399; }
.stars--medium { color: #f0b429; }
.stars--low    { color: #f87171; }

/* Offered pets – slot grid */
.empty-panel {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
  text-align: center;
  padding: 20px 0;
}

.no-data { font-size: 11px; color: var(--text-3); }

.form-pill {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

/* Pet slot grid (shared with CheckValues) */
.pet-slots-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  padding: 8px;
  background: rgba(255,255,255,0.02);
  border-radius: 14px;
  border: 1px solid var(--border);
}

.pet-slot {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.slot-img {
  width: 80%;
  height: 80%;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}

.slot-meta {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.65);
  border-radius: 0 0 9px 9px;
  padding: 3px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slot-form {
  font-size: 10px;
  font-weight: 800;
}

.slot-demand {
  font-size: 10px;
  line-height: 1;
}
.demand--high   { color: #34d399; }
.demand--medium { color: #f0b429; }
.demand--low    { color: #f87171; }

.slot-val {
  font-size: 10px;
  color: var(--gold);
  font-weight: 700;
}

.pet-slot--filled {
  cursor: pointer;
}
.pet-slot--filled::after {
  content: '✕';
  position: absolute;
  inset: 0;
  border-radius: 9px;
  background: rgba(239, 68, 68, 0.0);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  z-index: 5;
}
.pet-slot--filled:hover::after {
  opacity: 1;
  background: rgba(239, 68, 68, 0.72);
}

.pet-slot--add {
  background: transparent;
  border: 1.5px dashed var(--border-hi);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.pet-slot--add:hover {
  background: var(--primary-dim);
  border-color: var(--primary);
}

.slot-plus-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--text-3);
  font-weight: 300;
  line-height: 1;
  transition: background 0.15s, color 0.15s;
}
.pet-slot--add:hover .slot-plus-circle {
  background: var(--primary-dim);
  color: var(--primary);
}

/* Suggestions */
.suggestions-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.suggestion-card {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}
.suggestion-card:hover { border-color: var(--border-hi); }

.sug-card--green { background: rgba(52, 211, 153, 0.06); }
.sug-card--amber { background: rgba(240, 180, 41, 0.06); }
.sug-card--red   { background: rgba(248, 113, 113, 0.06); }

.sug-thumb {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.sug-thumb-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sug-body { flex: 1; min-width: 0; }
.sug-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sug-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 1px;
}
.sug-values {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}
.sug-val-item {
  display: flex;
  align-items: baseline;
  gap: 3px;
}
.sug-src-lbl {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.sug-val {
  font-size: 10px;
  font-weight: 700;
  color: var(--gold);
}

.delta-chip {
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 20px;
  flex-shrink: 0;
}
.chip--green { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.chip--amber { background: rgba(240, 180, 41, 0.15);  color: #f0b429; }
.chip--red   { background: rgba(248, 113, 113, 0.15); color: #f87171; }

.sug-card--selected {
  border-color: var(--primary) !important;
  background: var(--primary-dim) !important;
}
.suggestion-card { cursor: pointer; }

.publish-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.publish-btn:hover { opacity: 0.85; }

/* Publish dialog */
.publish-card { width: 420px; max-width: 92vw; }

.pub-header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}

.pub-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-2);
  flex-wrap: wrap;
}
.pub-offering, .pub-wanting { font-weight: 700; color: var(--text-1); }
.pub-arrow { color: var(--text-3); }

.pub-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pub-platform {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--surface-2);
  border-radius: 10px;
  border: 1px solid var(--border);
}

.pub-plat-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pub-plat-logo { font-size: 18px; }
.pub-plat-name { font-size: 13px; font-weight: 700; color: var(--text-1); }
.pub-plat-status { font-size: 10px; font-weight: 700; }
.status--on  { color: var(--positive); }
.status--off { color: var(--text-3); }

.pub-plat-right { display: flex; align-items: center; gap: 8px; }

.btn-sm-link {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.pub-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--surface-3);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.pub-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
}
.pub-result-icon { font-size: 14px; }

.pub-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 4px 0;
}

.elve-bookmarklet-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.elve-bm-label {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.5;
}
.elve-bookmarklet-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: var(--surface-3);
  border: 1.5px dashed var(--border-hi);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  cursor: grab;
  user-select: none;
  text-decoration: none;
  width: fit-content;
  transition: background 0.15s, border-color 0.15s;
}
.elve-bookmarklet-link:hover {
  background: var(--primary-dim);
  border-color: var(--primary);
}

.pub-footer {
  padding: 12px 20px 16px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid var(--border);
}

/* Dialog */
.picker-card { min-width: 400px; max-width: 520px; }
.dialog-title { font-size: 16px; font-weight: 800; color: var(--text-1); margin-bottom: 10px; }

.picker-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-3);
  border-radius: 8px;
  padding: 3px;
}

.picker-tab {
  flex: 1;
  padding: 5px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.picker-tab--active {
  background: var(--surface-1);
  color: var(--text-1);
}
.picker-tab:hover:not(.picker-tab--active) { color: var(--text-2); }


.picker-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  max-height: 380px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}

.picker-card-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-3);
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.picker-card-item:hover { border-color: var(--primary); background: var(--primary-dim); }
.picker-card-item--excluded { opacity: 0.4; }
.picker-card-item--excluded:hover { border-color: var(--border-hi); background: var(--surface-3); opacity: 0.65; }

.picker-exclude-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-3);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.15s, background 0.15s;
  z-index: 2;
}
.picker-exclude-btn:hover { color: var(--negative); background: rgba(248,113,113,0.15); }
.picker-exclude-btn--active { color: var(--negative); }

.picker-card-img {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.picker-card-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  line-height: 1.2;
  word-break: break-word;
}

.picker-card-bottom {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.picker-card-form {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.picker-card-val {
  font-size: 10px;
  font-weight: 700;
  color: var(--gold);
}

/* Other tab */
.other-section { padding-top: 12px; }

.form-section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 6px;
}

.form-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.form-chip {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 99px;
  border: 1.5px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1;
}
.form-chip:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.85); }
.form-chip--active { box-shadow: 0 3px 12px rgba(0,0,0,0.45); color: #fff; border-color: transparent; }

.results-panel {
  margin-top: 10px;
  max-height: 240px;
  overflow-y: auto;
}

.results-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  font-size: 12px;
  color: var(--text-3);
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}
.result-item:hover { background: var(--surface-2); }

.result-img-wrap {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}
.result-img { width: 100%; height: 100%; object-fit: contain; }
.result-img-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: -1;
}
.result-name { font-size: 13px; font-weight: 600; color: var(--text-1); }

.btn-ghost {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border: 1px solid var(--border-hi);
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.btn-ghost:hover { background: var(--surface-3); color: var(--text-1); }

/* Auto button */
.btn-auto {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--primary);
  border-radius: 10px;
  background: var(--primary-dim);
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.btn-auto:hover:not(:disabled) { background: var(--primary); color: #fff; }
.btn-auto:disabled { opacity: 0.35; cursor: not-allowed; }

/* Auto dialog */
.auto-card { width: 580px; max-width: 95vw; }
.auto-form-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }

.auto-platform-toggles { display: flex; gap: 6px; margin-top: 10px; }
.auto-platform-toggle {
  padding: 3px 12px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  letter-spacing: 0.04em;
}
.auto-platform-toggle:disabled { opacity: 0.4; cursor: not-allowed; }
.auto-platform-toggle--on { background: var(--primary); border-color: var(--primary); color: #fff; }
.auto-platform-toggle--elve.auto-platform-toggle--on { background: #0d9488; border-color: #0d9488; }
.auto-generating { display: flex; align-items: center; gap: 10px; padding: 24px 20px; color: var(--text-2); font-size: 14px; }
.auto-error { padding: 16px 20px; color: var(--negative); font-size: 13px; font-weight: 600; }
.auto-trades-list { padding: 10px 16px; display: flex; flex-direction: column; gap: 6px; max-height: 380px; overflow-y: auto; }
.auto-trade-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface-2);
  border-radius: 10px;
  border: 1px solid var(--border);
}
.auto-side { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.auto-side--offered { align-items: flex-start; flex-direction: column; gap: 4px; }
.auto-offered-list { display: flex; flex-direction: column; gap: 3px; width: 100%; }
.auto-offered-pet { display: flex; align-items: center; gap: 5px; }
.auto-offered-info { display: flex; flex-direction: column; min-width: 0; }
.auto-offered-name { font-size: 10px; font-weight: 700; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
.auto-offered-form { font-size: 9px; font-weight: 800; letter-spacing: 0.3px; }
.auto-pet-img { width: 28px; height: 28px; object-fit: contain; border-radius: 4px; background: var(--surface-3); flex-shrink: 0; }
.auto-val { font-size: 10px; font-weight: 700; color: var(--gold); flex-shrink: 0; }
.auto-arrow { color: var(--text-3); font-size: 16px; flex-shrink: 0; }
.auto-wanted-info { flex: 1; min-width: 0; }
.auto-wanted-name { font-size: 11px; font-weight: 700; color: var(--text-1); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.auto-wanted-form { font-size: 10px; font-weight: 800; }
.auto-deltas { display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; }
.auto-delta-chip { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 99px; }
.auto-status { width: 20px; text-align: center; flex-shrink: 0; font-size: 15px; font-weight: 700; }

.auto-exclude-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-3);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.15s, background 0.15s;
}
.auto-exclude-btn:hover { color: var(--negative); background: rgba(248,113,113,0.15); }
.auto-exclude-btn--active { color: var(--negative); }
.status-ok  { color: var(--positive); }
.status-err { color: var(--negative); }

.auto-trade-row--elve { border-color: rgba(99, 210, 190, 0.25); }

.auto-plat-badge {
  flex-shrink: 0;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 2px 5px;
  border-radius: 4px;
  text-transform: uppercase;
}
.badge--amv  { background: rgba(99, 132, 255, 0.2); color: #6384ff; }
.badge--elve { background: rgba(99, 210, 190, 0.2); color: #63d2be; }

.auto-elve-note {
  font-size: 11px;
  color: var(--text-3);
  padding: 6px 4px 2px;
  font-weight: 600;
}

.auto-elve-publish {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(99, 210, 190, 0.06);
  border: 1px solid rgba(99, 210, 190, 0.2);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.auto-elve-publish-label { font-size: 11px; color: var(--text-2); font-weight: 600; }
.auto-elve-publish-row { display: flex; gap: 8px; align-items: center; }

.loop-countdown {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  margin-right: auto;
  letter-spacing: 0.3px;
}
.loop-stop {
  border-color: var(--negative);
  color: var(--negative);
}
.loop-stop:hover { background: rgba(248,113,113,0.1); }
.btn-loop {
  background: var(--positive);
  gap: 5px;
}
.btn-loop:hover:not(:disabled) { opacity: 0.85; }

/* Category picker row */
.cat-picker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}
.cat-picker-btn {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: transparent;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.cat-picker-btn:hover { border-color: var(--border-hi); color: var(--text-2); }
.cat-picker-btn--active { background: var(--primary); border-color: var(--primary); color: #fff; }
</style>
