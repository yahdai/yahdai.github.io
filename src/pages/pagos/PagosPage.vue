<script setup lang="ts">
import { ref } from 'vue'

const searchQuery = ref('')
const filterStatus = ref('')
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Pagos</h1>
      <button class="btn btn-primary">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Registrar Pago
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="stat bg-base-100 rounded-box shadow">
        <div class="stat-title">Total Pendiente</div>
        <div class="stat-value text-warning">S/ 0.00</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow">
        <div class="stat-title">Cobrado este mes</div>
        <div class="stat-value text-success">S/ 0.00</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow">
        <div class="stat-title">Vencidos</div>
        <div class="stat-value text-error">0</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card bg-base-100 shadow mb-6">
      <div class="card-body">
        <div class="flex flex-wrap gap-4">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por alumno..."
            class="input input-bordered w-full max-w-xs"
          />
          <select v-model="filterStatus" class="select select-bordered">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="vencido">Vencido</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Alumno</th>
                <th>Concepto</th>
                <th>Importe</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="7" class="text-center text-base-content/60">
                  No hay pagos registrados
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
