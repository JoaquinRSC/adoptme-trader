<template>
  <q-page class="trades-page">

    <div class="page-head">
      <div>
        <div class="page-title">My Trades</div>
        <div class="page-sub">Manage your connected accounts and published trades</div>
      </div>
    </div>

    <!-- Published trades list -->
    <div class="section-title" style="margin-top: 28px">Published Trades</div>

    <div class="empty-state" v-if="!publishedTrades.length">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No trades published yet</div>
      <div class="empty-sub">Go to Trade Builder, find a match, and publish your first trade</div>
      <router-link :to="{ name: 'trade-builder' }">
        <button class="btn-primary">Open Trade Builder</button>
      </router-link>
    </div>

    <div class="trades-list" v-else>
      <div class="trade-row" v-for="t in publishedTrades" :key="t.id">
        <div class="trade-platform-badge" :class="`badge--${t.platform}`">
          {{ t.platform === 'amvgg' ? 'AMV' : 'Elve' }}
        </div>
        <div class="trade-pets">
          <div class="trade-side">
            <span class="trade-side-lbl">Offering</span>
            <span class="trade-pet" v-for="p in t.offering" :key="p.name">
              {{ p.name }} <span class="pet-form-pill">{{ p.form.toUpperCase() }}</span>
            </span>
          </div>
          <div class="trade-arrow">→</div>
          <div class="trade-side">
            <span class="trade-side-lbl">Wanting</span>
            <span class="trade-pet" v-for="p in t.lookingFor" :key="p.name">
              {{ p.name }} <span class="pet-form-pill">{{ p.form.toUpperCase() }}</span>
            </span>
          </div>
        </div>
        <div class="trade-meta">
          <div class="trade-id">#{{ t.id }}</div>
          <div class="trade-date">{{ formatDate(t.publishedAt) }}</div>
        </div>
      </div>
    </div>

  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface PublishedTrade {
  id: string
  platform: 'amvgg' | 'elvebredd'
  offering: Array<{ name: string; form: string }>
  lookingFor: Array<{ name: string; form: string }>
  publishedAt: string
}

const TRADES_KEY = 'published-trades'

const publishedTrades = ref<PublishedTrade[]>(
  JSON.parse(localStorage.getItem(TRADES_KEY) ?? '[]')
)

function formatDate (iso: string) {
  return new Date(iso).toLocaleString()
}
</script>

<style scoped>
.trades-page {
  padding: 28px;
  min-height: 100vh;
}

.page-head    { margin-bottom: 24px; }
.page-title   { font-size: 26px; font-weight: 800; color: var(--text-1); letter-spacing: -0.5px; }
.page-sub     { font-size: 13px; font-weight: 600; color: var(--text-3); margin-top: 3px; }

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 12px;
}

/* Accounts */
.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 8px;
}

.account-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.account-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.account-logo {
  font-size: 28px;
  line-height: 1;
}

.account-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
}

.account-status {
  font-size: 11px;
  font-weight: 700;
  margin-top: 2px;
}
.status--on  { color: var(--positive); }
.status--off { color: var(--text-3); }

.account-actions { display: flex; gap: 8px; }

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
.btn-ghost:hover:not(:disabled) { background: var(--surface-3); color: var(--text-1); }
.btn-ghost--danger:hover:not(:disabled) { color: var(--negative); border-color: var(--negative); }
.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

/* Empty state */
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
.empty-sub   { font-size: 13px; color: var(--text-2); margin-bottom: 6px; }

/* Trades list */
.trades-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trade-row {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.trade-platform-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 20px;
  flex-shrink: 0;
}
.badge--amvgg     { background: rgba(124,108,248,0.15); color: var(--primary); }
.badge--elvebredd { background: rgba(52,211,153,0.15);  color: #34d399; }

.trade-pets {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  flex-wrap: wrap;
}

.trade-side {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.trade-side-lbl {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.trade-pet {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: 4px;
}

.pet-form-pill {
  font-size: 9px;
  font-weight: 800;
  color: var(--primary);
  background: var(--primary-dim);
  border-radius: 4px;
  padding: 1px 4px;
}

.trade-arrow { font-size: 16px; color: var(--text-3); }

.trade-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.trade-id   { font-size: 11px; font-weight: 700; color: var(--text-3); }
.trade-date { font-size: 10px; color: var(--text-3); }
</style>
