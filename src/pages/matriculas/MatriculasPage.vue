<script setup lang="ts">
import { ref } from 'vue'

const searchQuery = ref('')
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Matrículas</h1>
      <button class="btn btn-primary">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Nueva Matrícula
      </button>
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
          <select class="select select-bordered">
            <option disabled selected>Periodo</option>
            <option>2024-I</option>
            <option>2024-II</option>
          </select>
          <select class="select select-bordered">
            <option disabled selected>Estado</option>
            <option>Activo</option>
            <option>Finalizado</option>
            <option>Cancelado</option>
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
                <th>Especialidad</th>
                <th>Periodo</th>
                <th>Fecha Registro</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="7" class="text-center text-base-content/60">
                  No hay matrículas registradas
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
