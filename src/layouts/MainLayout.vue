<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-primary">
      <q-toolbar>
        <q-btn flat dense round icon="menu" @click="drawer = !drawer" />
        <q-toolbar-title>AdoptMe Trader</q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawer" show-if-above bordered :width="200">
      <q-list padding>
        <q-item-label header class="text-grey-7 text-caption">MENÚ</q-item-label>

        <q-item clickable v-ripple :to="{ name: 'inventory' }" active-class="text-primary">
          <q-item-section avatar><q-icon name="pets" /></q-item-section>
          <q-item-section>Inventario</q-item-section>
        </q-item>

        <q-item clickable v-ripple :to="{ name: 'trade-builder' }" active-class="text-primary">
          <q-item-section avatar><q-icon name="swap_horiz" /></q-item-section>
          <q-item-section>Armar Trade</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const drawer = ref(false)
</script>
