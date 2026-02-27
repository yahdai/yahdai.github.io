<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const reportes = [
  {
    title: 'Reporte de Depósitos',
    description: 'Consulta de depósitos por año, mes y medio de pago',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    route: '/reportes/depositos',
    color: 'success'
  },
  {
    title: 'Resumen de Asistencias',
    description: 'Resumen de asistencias por alumno y periodo',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    route: '/reportes/asistencias',
    color: 'info'
  }
]

function navigateTo(route: string) {
  router.push(route)
}
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-xl sm:text-2xl font-bold">Reportes</h1>
      <p class="text-sm text-base-content/60">Selecciona el tipo de reporte que deseas consultar</p>
    </div>

    <!-- Grid de reportes -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div
        v-for="reporte in reportes"
        :key="reporte.route"
        class="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-primary"
        @click="navigateTo(reporte.route)"
      >
        <div class="card-body">
          <div class="flex items-start gap-4">
            <div :class="`p-3 rounded-lg bg-${reporte.color}/10`">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                :class="`h-8 w-8 text-${reporte.color}`"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  :d="reporte.icon"
                />
              </svg>
            </div>
            <div class="flex-1">
              <h2 class="card-title text-base sm:text-lg">{{ reporte.title }}</h2>
              <p class="text-sm text-base-content/60 mt-1">{{ reporte.description }}</p>
            </div>
          </div>
          <div class="card-actions justify-end mt-4">
            <button class="btn btn-sm btn-ghost">
              Ver reporte
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Info adicional -->
    <div class="alert alert-info">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <div>
        <h3 class="font-bold">Información</h3>
        <div class="text-xs">Los reportes te permiten consultar y exportar información consolidada del sistema.</div>
      </div>
    </div>
  </div>
</template>
