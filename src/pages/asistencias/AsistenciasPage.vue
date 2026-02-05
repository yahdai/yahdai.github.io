<script setup lang="ts">
import { ref } from 'vue'

const selectedDate = ref(new Date().toISOString().split('T')[0])
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Asistencias</h1>
    </div>

    <!-- Date selector -->
    <div class="card bg-base-100 shadow mb-6">
      <div class="card-body">
        <div class="flex flex-wrap gap-4 items-center">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Fecha</span>
            </label>
            <input
              v-model="selectedDate"
              type="date"
              class="input input-bordered"
            />
          </div>
          <select class="select select-bordered mt-8">
            <option disabled selected>Seleccionar clase</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Attendance list -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title mb-4">Lista de Asistencia</h2>

        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Hora Programada</th>
                <th>Hora Llegada</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="text-center text-base-content/60">
                  Selecciona una fecha y clase para ver la lista de asistencia
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex gap-2 mt-4">
          <span class="badge badge-success">Presente</span>
          <span class="badge badge-warning">Tardanza</span>
          <span class="badge badge-error">Ausente</span>
          <span class="badge badge-ghost">Justificado</span>
        </div>
      </div>
    </div>
  </div>
</template>
