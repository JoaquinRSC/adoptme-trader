<template>
  <q-page padding>
    <div class="text-h5 q-mb-lg">Armar Trade</div>

    <div class="row q-col-gutter-lg">
      <!-- LEFT: what you offer ──────────────────────────────────────────────── -->
      <div class="col-12 col-md-5">
        <q-card flat bordered>
          <q-card-section class="bg-blue-1">
            <div class="text-subtitle1 text-weight-bold text-blue-9">
              <q-icon name="upload" /> Lo que ofrecés
            </div>
          </q-card-section>
          <q-separator />

          <q-card-section>
            <q-btn
              outline color="primary" icon="add" label="Agregar del inventario"
              size="sm" class="q-mb-md full-width"
              @click="showInventoryPicker = true"
            />

            <q-banner v-if="!offeredPets.length" class="bg-grey-1 text-grey-6 rounded-borders">
              Seleccioná pets de tu inventario para ofrecer.
            </q-banner>

            <q-list separator v-else>
              <q-item v-for="item in offeredPets" :key="item.pet.id + item.pet.form" dense>
                <q-item-section>
                  <q-item-label>
                    {{ item.pet.name }}
                    <q-badge :color="FORM_COLOR[item.pet.form]" class="q-ml-xs">
                      {{ FORM_LABELS[item.pet.form] }}
                    </q-badge>
                  </q-item-label>
                  <q-item-label caption>
                    AMVGG:
                    <q-spinner v-if="item.loading" size="xs" />
                    <strong v-else-if="item.value !== null">{{ item.value }}</strong>
                    <span v-else class="text-negative">sin datos</span>
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn flat dense round icon="close" size="xs" @click="removeOffered(item.pet.id)" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>

          <!-- Total offered value -->
          <q-separator v-if="offeredPets.length" />
          <q-card-section v-if="offeredPets.length" class="q-py-sm">
            <div class="row items-center justify-between">
              <span class="text-caption text-grey-7">Valor total (AMVGG)</span>
              <span class="text-h6 text-blue-9">
                <q-spinner v-if="loadingValues" size="sm" />
                <template v-else>{{ totalOfferedValue.toFixed(3) }}</template>
              </span>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- CENTER: arrow + config ─────────────────────────────────────────────── -->
      <div class="col-12 col-md-2 flex flex-center column q-gutter-sm">
        <q-icon name="swap_horiz" size="40px" color="grey-5" />

        <div class="text-caption text-grey-6 text-center">Forma que querés recibir</div>
        <q-select
          v-model="desiredForm"
          :options="formOptions"
          outlined dense
          emit-value map-options
          style="min-width: 110px"
        />

        <q-btn
          color="primary" icon="search" label="Buscar"
          :disable="!offeredPets.length || loadingValues || totalOfferedValue === 0"
          :loading="searching"
          @click="search"
        />
      </div>

      <!-- RIGHT: suggestions ─────────────────────────────────────────────────── -->
      <div class="col-12 col-md-5">
        <q-card flat bordered>
          <q-card-section class="bg-green-1">
            <div class="text-subtitle1 text-weight-bold text-green-9">
              <q-icon name="download" /> Sugerencias para pedir
            </div>
          </q-card-section>
          <q-separator />

          <q-card-section>
            <q-banner v-if="!suggestions.length && !searching" class="bg-grey-1 text-grey-6 rounded-borders">
              Configurá tu oferta y hacé click en "Buscar".
            </q-banner>

            <q-list separator v-if="suggestions.length">
              <q-item
                v-for="s in suggestions"
                :key="s.name"
                class="rounded-borders q-my-xs"
                :class="deltaClass(s.delta)"
              >
                <q-item-section>
                  <q-item-label class="text-weight-medium">
                    {{ s.name }}
                    <q-badge :color="FORM_COLOR[s.form]" class="q-ml-xs">
                      {{ FORM_LABELS[s.form] }}
                    </q-badge>
                  </q-item-label>
                  <q-item-label caption>
                    AMVGG: <strong>{{ s.amvggValue }}</strong>
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-chip
                    dense
                    :color="Math.abs(s.delta) < 5 ? 'green' : Math.abs(s.delta) < 15 ? 'amber' : 'red'"
                    text-color="white"
                    :label="`${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)}%`"
                  />
                </q-item-section>
              </q-item>
            </q-list>

            <div v-if="searchDone && !suggestions.length" class="text-grey-6 text-center q-mt-md">
              No se encontraron pets con valor similar.
            </div>
          </q-card-section>
        </q-card>

        <!-- Cross-check notice (Phase 2: Elvebredd) -->
        <q-banner class="q-mt-md bg-amber-1 text-amber-9 rounded-borders" dense>
          <template #avatar><q-icon name="info" color="amber-8" /></template>
          El cross-check con Elvebredd se habilitará en la próxima fase.
        </q-banner>
      </div>
    </div>

    <!-- Inventory picker dialog ─────────────────────────────────────────────── -->
    <q-dialog v-model="showInventoryPicker">
      <q-card style="min-width: 360px; max-width: 500px">
        <q-card-section>
          <div class="text-h6">Seleccionar del inventario</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <q-banner v-if="!availableInventory.length" class="bg-grey-1 text-grey-6">
            No hay pets disponibles en el inventario.
          </q-banner>
          <q-list separator v-else>
            <q-item
              v-for="pet in availableInventory"
              :key="pet.id"
              clickable
              v-ripple
              @click="addOffered(pet)"
              v-close-popup
            >
              <q-item-section>
                <q-item-label>{{ pet.name }}</q-item-label>
                <q-item-label caption>{{ FORM_LABELS[pet.form] }} · x{{ pet.quantity }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge :color="FORM_COLOR[pet.form]">{{ FORM_LABELS[pet.form] }}</q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cerrar" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore } from 'src/stores/values'
import { FORM_LABELS, FORM_COLOR, type PetForm, type InventoryPet, type PetSuggestion } from 'src/types'

const inventory = useInventoryStore()
const values = useValuesStore()

// ── State ─────────────────────────────────────────────────────────────────────
interface OfferedItem { pet: InventoryPet; value: number | null; loading: boolean }
const offeredPets = ref<OfferedItem[]>([])
const desiredForm = ref<PetForm>('fr')
const suggestions = ref<PetSuggestion[]>([])
const showInventoryPicker = ref(false)
const searching = ref(false)
const searchDone = ref(false)
const loadingValues = ref(false)

const formOptions = Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))

// Pets in inventory not already in offered list
const availableInventory = computed(() =>
  inventory.pets.filter(p => !offeredPets.value.some(o => o.pet.id === p.id))
)

const totalOfferedValue = computed(() =>
  offeredPets.value.reduce((acc, item) => acc + (item.value ?? 0), 0)
)

// ── Actions ───────────────────────────────────────────────────────────────────
async function addOffered (pet: InventoryPet) {
  const item: OfferedItem = { pet, value: null, loading: true }
  offeredPets.value.push(item)

  const val = await values.getValue(pet.name, pet.form)
  const found = offeredPets.value.find(o => o.pet.id === pet.id)
  if (found) { found.value = val; found.loading = false }
}

function removeOffered (id: string) {
  const idx = offeredPets.value.findIndex(o => o.pet.id === id)
  if (idx !== -1) offeredPets.value.splice(idx, 1)
  suggestions.value = []
  searchDone.value = false
}

// ── Search suggestions ────────────────────────────────────────────────────────
const TOLERANCE = 0.20 // ±20% value range

async function search () {
  if (!offeredPets.value.length || totalOfferedValue.value === 0) return
  searching.value = true
  searchDone.value = false
  suggestions.value = []

  // Load all pets list if not loaded yet
  await values.loadAllPets()

  const target = totalOfferedValue.value
  const form = desiredForm.value

  const candidates = values.allPets
    .filter(p => !offeredPets.value.some(o => o.pet.name === p.name))

  // Fetch values for candidates in the desired form (batch)
  const batchRequests = candidates.map(p => ({ name: p.name, form }))
  const batchResult = await values.getBatch(batchRequests)

  const results: PetSuggestion[] = []
  for (const req of batchRequests) {
    const val = batchResult.find(r => r.name === req.name && r.form === req.form)?.value
    if (val === null || val === undefined) continue
    const delta = ((val - target) / target) * 100
    if (Math.abs(delta) <= TOLERANCE * 100) {
      results.push({ name: req.name, form, amvggValue: val, delta })
    }
  }

  // Sort by closest value
  results.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
  suggestions.value = results.slice(0, 20)
  searchDone.value = true
  searching.value = false
}

function deltaClass (delta: number) {
  if (Math.abs(delta) < 5) return 'bg-green-1'
  if (Math.abs(delta) < 15) return 'bg-amber-1'
  return 'bg-red-1'
}
</script>
