<template>
  <q-page class="inv-page">

    <!-- Page header -->
    <div class="page-head">
      <div>
        <div class="page-title">My Pets</div>
        <div class="page-sub" v-if="inventory.pets.length">
          {{ inventory.pets.length }} {{ inventory.pets.length === 1 ? 'pet' : 'pets' }} in inventory
        </div>
      </div>
      <button class="btn-primary" @click="openAdd">
        <q-icon name="add" size="16px" />
        Add Pet
      </button>
    </div>

    <!-- Empty state -->
    <div class="empty-state" v-if="!inventory.pets.length">
      <div class="empty-paw">🐾</div>
      <div class="empty-title">No pets yet</div>
      <div class="empty-sub">Add your first pet to start building trades</div>
      <button class="btn-primary" @click="openAdd">Add Pet</button>
    </div>

    <!-- Pet grid -->
    <div class="pet-grid" v-else>
      <div class="pet-card" v-for="pet in inventory.pets" :key="pet.id">

        <!-- Thumbnail -->
        <div class="pet-thumb" :style="{ background: FORM_GRADIENT[pet.form] }">
          <span class="thumb-emoji">🐾</span>
          <span
            class="thumb-badge"
            :style="{ color: FORM_COLOR_HEX[pet.form], borderColor: FORM_COLOR_HEX[pet.form] + '44' }"
          >
            {{ FORM_LABELS[pet.form] }}
          </span>
        </div>

        <!-- Card body -->
        <div class="pet-body">
          <div class="pet-name" :title="pet.name">{{ pet.name }}</div>

          <!-- Quantity -->
          <div class="qty-row">
            <button
              class="qty-btn"
              @click="inventory.updateQuantity(pet.id, pet.quantity - 1)"
              :disabled="pet.quantity <= 1"
            >−</button>
            <span class="qty-val">{{ pet.quantity }}</span>
            <button class="qty-btn" @click="inventory.updateQuantity(pet.id, pet.quantity + 1)">+</button>
          </div>

          <!-- AMVGG value -->
          <div class="value-row">
            <span class="value-lbl">AMVGG</span>
            <q-spinner v-if="loadingValue[pet.id]" size="13px" />
            <span
              v-else-if="petValue[pet.id] !== null && petValue[pet.id] !== undefined"
              class="value-num"
            >{{ petValue[pet.id] }}</span>
            <button v-else class="value-fetch" @click="fetchValue(pet)">Fetch</button>
          </div>
        </div>

        <!-- Hover actions -->
        <div class="pet-actions">
          <q-btn-dropdown flat dense size="xs" icon="tune" class="action-btn" no-icon-animation>
            <q-list dense style="min-width: 100px">
              <q-item
                v-for="(label, form) in FORM_LABELS"
                :key="form"
                clickable v-close-popup
                @click="changeForm(pet.id, form as PetForm)"
                :active="pet.form === form"
                active-class="text-primary"
              >
                <q-item-section>{{ label }}</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>

          <button class="action-btn action-del" @click="confirmRemove(pet.id, pet.name)">
            <q-icon name="delete_outline" size="15px" />
          </button>
        </div>

      </div>
    </div>

    <!-- Add pet dialog -->
    <q-dialog v-model="showAdd" persistent>
      <q-card class="add-card">
        <q-card-section class="q-pb-sm">
          <div class="dialog-title">Add Pet</div>
        </q-card-section>

        <q-card-section class="q-pt-sm q-gutter-sm">
          <q-input
            v-model="newPetName"
            label="Pet name"
            outlined dense autofocus
            hint="e.g. Bat Dragon, Giraffe"
          />
          <q-select
            v-model="newPetForm"
            :options="formOptions"
            label="Form"
            outlined dense
            emit-value map-options
          />
          <q-input
            v-model.number="newPetQty"
            type="number"
            label="Quantity"
            outlined dense
            :min="1"
          />
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <button class="btn-ghost" @click="showAdd = false">Cancel</button>
          <button
            class="btn-primary"
            :disabled="!newPetName.trim()"
            @click="confirmAdd"
          >Add</button>
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useQuasar } from 'quasar'
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore } from 'src/stores/values'
import {
  FORM_LABELS, FORM_GRADIENT, FORM_COLOR_HEX,
  type PetForm, type InventoryPet,
} from 'src/types'

const $q = useQuasar()
const inventory = useInventoryStore()
const values = useValuesStore()

// ── Add dialog ────────────────────────────────────────────────────────────────
const showAdd    = ref(false)
const newPetName = ref('')
const newPetForm = ref<PetForm>('fr')
const newPetQty  = ref(1)

const formOptions = Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))

function openAdd () {
  newPetName.value = ''
  newPetForm.value = 'fr'
  newPetQty.value  = 1
  showAdd.value    = true
}

function confirmAdd () {
  if (!newPetName.value.trim()) return
  inventory.addPet(newPetName.value.trim(), newPetForm.value, newPetQty.value)
  showAdd.value = false
}

// ── Value fetching ────────────────────────────────────────────────────────────
const petValue    = reactive<Record<string, number | null>>({})
const loadingValue = reactive<Record<string, boolean>>({})

async function fetchValue (pet: InventoryPet) {
  loadingValue[pet.id] = true
  petValue[pet.id] = await values.getValue(pet.name, pet.form)
  loadingValue[pet.id] = false
}

// ── Actions ───────────────────────────────────────────────────────────────────
function changeForm (id: string, form: PetForm) {
  inventory.updateForm(id, form)
  const pet = inventory.pets.find(p => p.id === id)
  if (pet) delete petValue[id]
}

function confirmRemove (id: string, name: string) {
  $q.dialog({
    title: 'Remove pet',
    message: `Remove "${name}" from inventory?`,
    cancel: true,
    ok: { label: 'Remove', color: 'negative', flat: true },
  }).onOk(() => inventory.removePet(id))
}
</script>

<style scoped>
.inv-page {
  padding: 28px 28px 28px;
  min-height: 100vh;
}

/* Page header */
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: -0.5px;
}

.page-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  margin-top: 2px;
}

/* Buttons */
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
  transition: opacity 0.15s, transform 0.1s;
}
.btn-primary:hover   { opacity: 0.88; }
.btn-primary:active  { transform: scale(0.97); }
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
.btn-ghost:hover { background: var(--surface-3); color: var(--text-1); }

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 80px 0;
  text-align: center;
}
.empty-paw   { font-size: 52px; line-height: 1; margin-bottom: 6px; }
.empty-title { font-size: 18px; font-weight: 800; color: var(--text-1); }
.empty-sub   { font-size: 13px; color: var(--text-2); margin-bottom: 8px; }

/* Pet grid */
.pet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 16px;
}

/* Pet card */
.pet-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
}
.pet-card:hover {
  border-color: var(--border-hi);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.pet-card:hover .pet-actions { opacity: 1; }

/* Thumbnail */
.pet-thumb {
  position: relative;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pet-thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35));
}
.thumb-emoji {
  font-size: 40px;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
  position: relative;
  z-index: 1;
}
.thumb-badge {
  position: absolute;
  bottom: 7px;
  right: 8px;
  z-index: 2;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 20px;
  border: 1px solid currentColor;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

/* Card body */
.pet-body {
  padding: 10px 12px 12px;
}
.pet-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}

/* Quantity */
.qty-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.qty-btn {
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-hi);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qty-btn:hover:not(:disabled) { background: var(--surface-3); color: var(--text-1); }
.qty-btn:disabled              { opacity: 0.3; cursor: not-allowed; }
.qty-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  min-width: 20px;
  text-align: center;
}

/* Value */
.value-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.value-lbl {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.8px;
  text-transform: uppercase;
}
.value-num {
  font-size: 13px;
  font-weight: 800;
  color: var(--gold);
}
.value-fetch {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-dim);
  border: none;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  transition: background 0.12s;
}
.value-fetch:hover { background: rgba(124, 108, 248, 0.2); }

/* Hover actions */
.pet-actions {
  position: absolute;
  top: 7px;
  right: 7px;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.action-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 7px;
  background: rgba(12, 14, 26, 0.75);
  backdrop-filter: blur(6px);
  color: var(--text-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.action-btn:hover { background: var(--surface-3); color: var(--text-1); }
.action-del:hover { color: var(--negative); }

/* Dialog */
.add-card {
  min-width: 340px;
}
.dialog-title {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-1);
}
</style>
