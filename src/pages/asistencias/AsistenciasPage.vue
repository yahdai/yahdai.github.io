<script setup lang="ts">
import { ref } from 'vue'
import TabMarcadoRapido from './TabMarcadoRapido.vue'
import TabSesionesDia from './TabSesionesDia.vue'

const tabActivo = ref<'marcado' | 'sesiones'>('marcado')

const tabs = [
  { id: 'marcado', label: 'Marcado', labelMobile: 'Marcar', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z' },
  { id: 'sesiones', label: 'Sesiones del Día', labelMobile: 'Sesiones', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
] as const
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
      <h1 class="text-lg sm:text-xl font-bold">Asistencias</h1>
      <div class="text-[10px] sm:text-xs text-base-content/60">
        {{ new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs tabs-boxed bg-base-100 p-1 gap-1">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab flex-1 gap-1 sm:gap-2 text-xs sm:text-sm transition-all"
        :class="{ 'tab-active': tabActivo === tab.id }"
        @click="tabActivo = tab.id"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
        </svg>
        <span class="hidden sm:inline">{{ tab.label }}</span>
        <span class="sm:hidden">{{ tab.labelMobile }}</span>
      </button>
    </div>

    <!-- Contenido del tab activo -->
    <TabMarcadoRapido v-if="tabActivo === 'marcado'" />
    <TabSesionesDia v-else-if="tabActivo === 'sesiones'" />
  </div>
</template>
