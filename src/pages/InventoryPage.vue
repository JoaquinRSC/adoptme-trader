<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">Mis Pets</div>
      <q-btn color="primary" icon="add" label="Agregar pet" @click="openAdd" />
    </div>

    <q-banner v-if="!inventory.pets.length" rounded class="bg-grey-2 text-grey-7">
      No tenés pets en tu inventario. Agregá uno con el botón de arriba.
    </q-banner>

    <div class="row q-gutter-md" v-else>
      <q-card
        v-for="pet in inventory.pets"
        :key="pet.id"
        class="pet-card"
        bordered
        flat
      >
        <q-card-section class="q-pb-xs">
          <div class="row items-center no-wrap">
            <div class="col text-weight-bold ellipsis">{{ pet.name }}</div>
            <q-badge :color="FORM_COLOR[pet.form]" class="q-ml-sm">
              {{ FORM_LABELS[pet.form] }}
            </q-badge>
          </div>
        </q-card-section>

        <q-card-section class="q-pt-xs q-pb-xs">
          <div class="row items-center q-gutter-sm">
            <span class="text-caption text-grey-6">Cantidad:</span>
            <q-btn
              dense flat round icon="remove" size="xs"
              @click="inventory.updateQuantity(pet.id, pet.quantity - 1)"
              :disable="pet.quantity <= 1"
            />
            <span class="text-body2 text-weight-medium">{{ pet.quantity }}</span>
            <q-btn
              dense flat round icon="add" size="xs"
              @click="inventory.updateQuantity(pet.id, pet.quantity + 1)"
            />
          </div>

          <!-- Value from AMVGG (fetched lazily) -->
          <div class="row items-center q-mt-xs q-gutter-xs">
            <q-icon name="monetization_on" size="xs" color="amber-7" />
            <span class="text-caption">
              AMVGG:
              <template v-if="loadingValue[pet.id]">
                <q-spinner size="xs" />
              </template>
              <template v-else-if="petValue[pet.id] !== null && petValue[pet.id] !== undefined">
                <strong>{{ petValue[pet.id] }}</strong>
              </template>
              <template v-else>
                <q-btn dense flat size="xs" label="Ver" @click="fetchValue(pet)" />
              </template>
            </span>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-actions align="right" class="q-pa-xs">
          <q-btn-dropdown flat dense size="sm" label="Forma" icon="tune">
            <q-list dense>
              <q-item
                v-for="(label, form) in FORM_LABELS"
                :key="form"
                clickable
                v-close-popup
                @click="changeForm(pet.id, form as PetForm)"
                :active="pet.form === form"
                active-class="text-primary"
              >
                <q-item-section>{{ label }}</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>

          <q-btn flat dense round icon="delete" color="negative" @click="confirmRemove(pet.id, pet.name)" />
        </q-card-actions>
      </q-card>
    </div>

    <!-- Add pet dialog -->
    <q-dialog v-model="showAdd" persistent>
      <q-card style="min-width: 340px">
        <q-card-section>
          <div class="text-h6">Agregar pet</div>
        </q-card-section>

        <q-card-section class="q-pt-none q-gutter-md">
          <q-input
            v-model="newPetName"
            label="Nombre del pet"
            outlined
            autofocus
            hint="Ej: Bat Dragon, Giraffe"
          />
          <q-select
            v-model="newPetForm"
            :options="formOptions"
            label="Forma"
            outlined
            emit-value
            map-options
          />
          <q-input
            v-model.number="newPetQty"
            type="number"
            label="Cantidad"
            outlined
            :min="1"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup />
          <q-btn
            color="primary"
            label="Agregar"
            :disable="!newPetName.trim()"
            @click="confirmAdd"
          />
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
import { FORM_LABELS, FORM_COLOR, type PetForm, type InventoryPet } from 'src/types'

const $q = useQuasar()
const inventory = useInventoryStore()
const values = useValuesStore()

// ── Add dialog state ──────────────────────────────────────────────────────────
const showAdd = ref(false)
const newPetName = ref('')
const newPetForm = ref<PetForm>('fr')
const newPetQty = ref(1)

const formOptions = Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))

function openAdd () {
  newPetName.value = ''
  newPetForm.value = 'fr'
  newPetQty.value = 1
  showAdd.value = true
}

function confirmAdd () {
  if (!newPetName.value.trim()) return
  inventory.addPet(newPetName.value.trim(), newPetForm.value, newPetQty.value)
  showAdd.value = false
}

// ── Value fetching ────────────────────────────────────────────────────────────
const petValue = reactive<Record<string, number | null>>({})
const loadingValue = reactive<Record<string, boolean>>({})

async function fetchValue (pet: InventoryPet) {
  loadingValue[pet.id] = true
  petValue[pet.id] = await values.getValue(pet.name, pet.form)
  loadingValue[pet.id] = false
}

// ── Actions ───────────────────────────────────────────────────────────────────
function changeForm (id: string, form: PetForm) {
  inventory.updateForm(id, form)
  // Clear cached value since form changed
  const pet = inventory.pets.find(p => p.id === id)
  if (pet) delete petValue[id]
}

function confirmRemove (id: string, name: string) {
  $q.dialog({
    title: 'Confirmar',
    message: `¿Eliminar "${name}" del inventario?`,
    cancel: true,
  }).onOk(() => inventory.removePet(id))
}
</script>

<style scoped>
.pet-card {
  width: 220px;
}
</style>
