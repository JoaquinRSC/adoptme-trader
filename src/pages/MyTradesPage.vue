<template>
  <q-page class="trades-page">

    <div class="page-head">
      <div>
        <div class="page-title">My Trades</div>
        <div class="page-sub">Active listings on AMVGG</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="conn-status" :class="amvggCookie ? 'conn-status--on' : 'conn-status--off'">
          {{ amvggCookie ? 'Connected' : 'Not connected' }}
        </div>
        <button class="btn-primary" @click="fetchTrades" :disabled="!amvggCookie || loading">
          <q-spinner v-if="loading" size="14px" color="white" />
          <span>{{ loading ? 'Loading…' : 'Refresh' }}</span>
        </button>
      </div>
    </div>

    <!-- Not connected -->
    <div class="empty-state" v-if="!amvggCookie">
      <div class="empty-icon">🔑</div>
      <div class="empty-title">AMVGG not connected</div>
      <div class="empty-sub">Connect your account in Trade Builder → Publish to see your active trades</div>
    </div>

    <!-- Loading -->
    <div class="empty-state" v-else-if="loading">
      <q-spinner size="32px" color="primary" />
    </div>

    <!-- Error -->
    <div class="empty-state" v-else-if="error">
      <div class="empty-icon">⚠️</div>
      <div class="empty-title">Failed to load trades</div>
      <div class="empty-sub">{{ error }}</div>
      <button class="btn-primary" @click="fetchTrades">Retry</button>
    </div>

    <!-- No trades -->
    <div class="empty-state" v-else-if="fetched && !trades.length">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No active trades</div>
      <div class="empty-sub">Go to Trade Builder and publish some trades</div>
    </div>

    <!-- Trades list -->
    <div v-else-if="trades.length">
      <div class="trades-count">{{ trades.length }} active listing{{ trades.length !== 1 ? 's' : '' }}</div>
      <div class="trades-list">
        <div class="trade-card" v-for="t in trades" :key="t.id">

          <!-- Offering side -->
          <div class="trade-side">
            <div class="trade-side-lbl">Offering</div>
            <div class="trade-pets-row">
              <div class="trade-pet-item" v-for="p in t.offering" :key="p.name + p.form">
                <img
                  :src="`https://amvgg.com/items/${encodeURIComponent(p.name)}.webp`"
                  class="trade-pet-img"
                  @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                />
                <div class="trade-pet-info">
                  <span class="trade-pet-name">{{ p.name }}</span>
                  <span class="trade-pet-form">{{ p.form }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="trade-arrow">→</div>

          <!-- Looking for side -->
          <div class="trade-side">
            <div class="trade-side-lbl">Looking for</div>
            <div class="trade-pets-row">
              <div class="trade-pet-item" v-for="p in t.lookingFor" :key="p.name + p.form">
                <img
                  :src="`https://amvgg.com/items/${encodeURIComponent(p.name)}.webp`"
                  class="trade-pet-img"
                  @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                />
                <div class="trade-pet-info">
                  <span class="trade-pet-name">{{ p.name }}</span>
                  <span class="trade-pet-form">{{ p.form }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Meta -->
          <div class="trade-meta">
            <div class="trade-date">{{ formatDate(t.publishedAt) }}</div>
            <a :href="`https://amvgg.com/trade/${t.id}`" target="_blank" rel="noopener" class="trade-link">View ↗</a>
          </div>

        </div>
      </div>
    </div>

    <!-- Initial state -->
    <div class="empty-state" v-else-if="amvggCookie && !fetched">
      <div class="empty-icon">📋</div>
      <div class="empty-title">Ready to load</div>
      <div class="empty-sub">Click Refresh to fetch your active trades from AMVGG</div>
    </div>

  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface TradePet {
  name: string
  form: string
}

interface AmvTrade {
  id: string
  offering:   TradePet[]
  lookingFor: TradePet[]
  publishedAt: string
}

const amvggCookie = ref('')
const trades      = ref<AmvTrade[]>([])
const loading     = ref(false)
const fetched     = ref(false)
const error       = ref('')

onMounted(() => {
  amvggCookie.value = localStorage.getItem('amvgg_cookie') ?? ''
  if (amvggCookie.value) void fetchTrades()
})

async function fetchTrades () {
  if (!amvggCookie.value) return
  loading.value = true
  error.value   = ''
  try {
    const res  = await fetch('/api/my-amv-trades', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cookie: amvggCookie.value }),
    })
    const data = await res.json() as { ok: boolean; trades?: unknown[]; error?: string }
    if (!data.ok) { error.value = data.error ?? 'Unknown error'; return }
    trades.value  = parseTrades(data.trades ?? [])
    fetched.value = true
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

function parseTrades (raw: unknown[]): AmvTrade[] {
  return raw.map((t: unknown) => {
    const trade = t as Record<string, unknown>
    return {
      id:          String(trade.id ?? trade._id ?? ''),
      publishedAt: String(trade.createdAt ?? trade.publishedAt ?? trade.created_at ?? ''),
      offering:    parsePets(trade.leftGridItems ?? trade.offering ?? trade.offered ?? []),
      lookingFor:  parsePets(trade.rightGridItems ?? trade.lookingFor ?? trade.wanted ?? []),
    }
  }).filter(t => t.id)
}

function parsePets (raw: unknown): TradePet[] {
  if (!Array.isArray(raw)) return []
  return raw.map((p: unknown) => {
    const pet = p as Record<string, unknown>
    const name = String(pet.name ?? pet.petName ?? pet.itemName ?? '')
    const form = String(pet.form ?? pet.petForm ?? pet.tag ?? '')
    return { name, form }
  }).filter(p => p.name)
}

function formatDate (iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}
</script>

<style scoped>
.trades-page {
  padding: 28px;
  min-height: 100vh;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.page-title { font-size: 26px; font-weight: 800; color: var(--text-1); letter-spacing: -0.5px; }
.page-sub   { font-size: 13px; font-weight: 600; color: var(--text-3); margin-top: 3px; }

.conn-status {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
}
.conn-status--on  { background: rgba(52,211,153,0.12); color: #34d399; }
.conn-status--off { background: var(--surface-2); color: var(--text-3); }

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.trades-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 12px;
}

.trades-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trade-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.trade-side {
  flex: 1;
  min-width: 0;
}

.trade-side-lbl {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.trade-pets-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.trade-pet-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 8px;
}

.trade-pet-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 4px;
}

.trade-pet-info {
  display: flex;
  flex-direction: column;
}

.trade-pet-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.2;
}

.trade-pet-form {
  font-size: 10px;
  font-weight: 800;
  color: var(--primary);
  letter-spacing: 0.3px;
}

.trade-arrow {
  font-size: 20px;
  color: var(--text-3);
  padding-top: 18px;
  flex-shrink: 0;
}

.trade-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  padding-top: 18px;
  flex-shrink: 0;
}

.trade-date {
  font-size: 10px;
  color: var(--text-3);
  white-space: nowrap;
}

.trade-link {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  text-decoration: none;
}
.trade-link:hover { text-decoration: underline; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 0;
  text-align: center;
}
.empty-icon  { font-size: 48px; }
.empty-title { font-size: 17px; font-weight: 800; color: var(--text-1); }
.empty-sub   { font-size: 13px; color: var(--text-2); margin-bottom: 6px; max-width: 340px; }
</style>
