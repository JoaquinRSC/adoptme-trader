<template>
  <section class="adv-panel">
    <header class="adv-head">
      <span class="adv-tag">{{ $t('trade.advanced.title') }}</span>
    </header>

    <!-- AMVGG -->
    <div class="adv-row">
      <div class="adv-plat">
        <span class="adv-plat-name">{{ $t('trade.advanced.amvgg') }}</span>
        <span class="adv-status" :class="amvggCookie ? 'is-on' : 'is-off'">
          {{ amvggCookie ? $t('trade.advanced.connected') : $t('trade.advanced.notConnected') }}
        </span>
      </div>
      <button v-if="amvggCookie" class="adv-link" @click="disconnectAmvgg">
        {{ $t('trade.advanced.disconnect') }}
      </button>
    </div>

    <template v-if="!amvggCookie">
      <p class="adv-hint">{{ $t('trade.advanced.cookieHint') }}</p>
      <input
        v-model="cookieSessionData"
        type="password"
        class="adv-input"
        :placeholder="$t('trade.advanced.sessionData')"
        autocomplete="off"
      >
      <input
        v-model="cookieSessionToken"
        type="password"
        class="adv-input"
        :placeholder="$t('trade.advanced.sessionToken')"
        autocomplete="off"
      >
      <button
        class="adv-btn"
        :disabled="!cookieSessionData.trim() || !cookieSessionToken.trim()"
        @click="saveAmvggCookie"
      >{{ $t('trade.advanced.connect') }}</button>
    </template>

    <template v-else>
      <button class="adv-btn" :disabled="posting || !ready" @click="publishTrade">
        <q-spinner v-if="posting" size="14px" />
        <span>{{ posting ? $t('trade.advanced.publishing') : $t('trade.advanced.publish') }}</span>
      </button>
      <p v-if="!ready" class="adv-hint">{{ $t('trade.advanced.needBothSides') }}</p>
    </template>

    <p v-if="postOk" class="adv-result is-ok">
      ✓ {{ $t('trade.advanced.posted') }} —
      <a href="https://amvgg.com/trades" target="_blank" rel="noopener">{{ $t('trade.advanced.viewOnAmvgg') }} ↗</a>
    </p>
    <p v-else-if="postError" class="adv-result is-err">{{ postError }}</p>

    <div class="adv-divider" />

    <!-- Elvebredd -->
    <div class="adv-row">
      <span class="adv-plat-name">{{ $t('trade.advanced.elve') }}</span>
    </div>
    <p class="adv-hint">{{ $t('trade.advanced.elveHint') }}</p>
    <button class="adv-btn" :disabled="elveLoading || !ready" @click="copyElveScript">
      <q-spinner v-if="elveLoading" size="14px" />
      <span>{{ elveCopied ? '✓ ' + $t('trade.advanced.elveCopied')
        : elveLoading ? $t('trade.advanced.elveGenerating')
        : $t('trade.advanced.copyElve') }}</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdvancedMode } from 'src/composables/useAdvancedMode'
import type { SideEntry } from 'src/stores/drafts'

const props = defineProps<{ offered: SideEntry[]; wanted: SideEntry[] }>()

const { t } = useI18n()
const { authHeaders } = useAdvancedMode()

// Both publish paths need pets on both sides.
const ready = computed(() => props.offered.length > 0 && props.wanted.length > 0)

// ── AMVGG session cookie (stored locally, only ever forwarded to AMVGG) ───────
const COOKIE_KEY = 'amvgg_cookie'
const amvggCookie        = ref('')
const cookieSessionData  = ref('')
const cookieSessionToken = ref('')

onMounted(() => { amvggCookie.value = localStorage.getItem(COOKIE_KEY) ?? '' })

function saveAmvggCookie () {
  const combined = `__Secure-better-auth.session_data=${cookieSessionData.value.trim()}; __Secure-better-auth.session_token=${cookieSessionToken.value.trim()}`
  amvggCookie.value = combined
  localStorage.setItem(COOKIE_KEY, combined)
  cookieSessionData.value  = ''
  cookieSessionToken.value = ''
  postError.value = ''
}

function disconnectAmvgg () {
  amvggCookie.value = ''
  localStorage.removeItem(COOKIE_KEY)
}

// ── Publish to AMVGG ─────────────────────────────────────────────────────────
const posting   = ref(false)
const postOk    = ref(false)
const postError = ref('')

async function publishTrade () {
  if (!amvggCookie.value || !ready.value) return
  posting.value = true
  postOk.value = false
  postError.value = ''
  try {
    const res = await fetch('/api/trade/post-amvgg', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        cookie:  amvggCookie.value,
        offered: props.offered.map(e => ({ name: e.name, form: e.form, itemCategory: e.category })),
        wanted:  props.wanted.map(e => ({ name: e.name, form: e.form, itemCategory: e.category })),
      }),
    })
    const data = await res.json() as { ok: boolean; error?: string }
    if (data.ok) {
      postOk.value = true
    } else if (res.status === 401) {
      disconnectAmvgg()
      postError.value = t('trade.advanced.sessionExpired')
    } else {
      postError.value = typeof data.error === 'string' ? data.error : 'Failed'
    }
  } catch (e) {
    postError.value = String(e)
  } finally {
    posting.value = false
  }
}

// ── Elvebredd listing script ─────────────────────────────────────────────────
const elveLoading = ref(false)
const elveCopied  = ref(false)

// The console script pasted at elvebredd.com/create-listing: it reads the live
// Turnstile token + csrf cookie from that page and POSTs each listing.
function buildElveScript (payloads: unknown[]): string {
  const p = JSON.stringify(payloads)
  return `(async()=>{if(!window.turnstile){alert('Run this on elvebredd.com/create-listing');return;}const csrf=document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('csrfToken='))?.replace('csrfToken=','')||'';const token=window.turnstile.getResponse();if(!token){alert('No token — reload the page');return;}const payloads=${p};let ok=0,fail=0;for(const p of payloads){p.turnstileToken=token;try{const r=await fetch('/api/create-listing',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','x-csrf-token':csrf},body:JSON.stringify(p)});const d=await r.json();if(d.id||d.success){ok++;console.log('OK',p.ownerGet[0]?.name);}else{fail++;console.error('FAIL',d);}}catch(e){fail++;console.error(e);}}alert('Done: '+ok+' ok, '+fail+' failed');})();`
}

async function copyElveScript () {
  if (!ready.value) return
  elveLoading.value = true
  try {
    const res = await fetch('/api/trade/elve-build-payloads', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        trades: [{
          offered: props.offered.map(e => ({ name: e.name, form: e.form })),
          wanted:  props.wanted.map(e => ({ name: e.name, form: e.form })),
        }],
      }),
    })
    const data = await res.json() as { ok: boolean; payloads?: unknown[] }
    if (!data.ok || !data.payloads?.length) return
    await navigator.clipboard.writeText(buildElveScript(data.payloads))
    elveCopied.value = true
    setTimeout(() => { elveCopied.value = false }, 4000)
  } finally {
    elveLoading.value = false
  }
}
</script>

<style scoped>
.adv-panel {
  background: var(--elev-fill);
  border: 1px dashed var(--border-hi);
  border-radius: 16px;
  box-shadow: var(--elev-shadow);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.adv-head { display: flex; align-items: center; }

.adv-tag {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--text-2);
}

.adv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.adv-plat { display: flex; align-items: center; gap: 8px; }

.adv-plat-name { font-size: 13px; font-weight: 800; color: var(--text-1); }

.adv-status { font-size: 11px; font-weight: 700; }
.adv-status.is-on  { color: var(--positive); }
.adv-status.is-off { color: var(--text-3); }

.adv-hint { font-size: 12px; color: var(--text-3); line-height: 1.5; margin: 0; }

.adv-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-hi);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-1);
  font-size: 12px;
}

.adv-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: 1px solid rgba(231, 195, 104, 0.4);
  border-radius: 8px;
  background: var(--primary-dim);
  color: var(--gold);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.15s, opacity 0.15s;
}
.adv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
@media (hover: hover) {
  .adv-btn:not(:disabled):hover { border-color: var(--gold); }
}

.adv-link {
  border: none;
  background: none;
  color: var(--negative);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.adv-result { font-size: 12px; font-weight: 600; line-height: 1.5; margin: 0; }
.adv-result.is-ok  { color: var(--positive); }
.adv-result.is-err { color: var(--negative); }
.adv-result a { color: inherit; }

.adv-divider { height: 1px; background: var(--border); margin: 4px 0; }
</style>
