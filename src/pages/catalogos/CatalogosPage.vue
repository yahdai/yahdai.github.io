<script setup lang="ts">
import { ref } from 'vue'

const activeTab = ref('especialidades')
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Catálogos</h1>

    <!-- Tabs -->
    <div role="tablist" class="tabs tabs-boxed mb-6">
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'especialidades' }"
        @click="activeTab = 'especialidades'"
      >
        Especialidades
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'periodos' }"
        @click="activeTab = 'periodos'"
      >
        Periodos
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'horarios' }"
        @click="activeTab = 'horarios'"
      >
        Horarios
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'frecuencias' }"
        @click="activeTab = 'frecuencias'"
      >
        Frecuencias
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'profesores' }"
        @click="activeTab = 'profesores'"
      >
        Profesores
      </a>
    </div>

    <!-- Content -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <!-- Especialidades -->
        <div v-if="activeTab === 'especialidades'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Especialidades</h2>
            <button class="btn btn-primary btn-sm">Agregar</button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="3" class="text-center text-base-content/60">
                    No hay especialidades registradas
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Periodos -->
        <div v-if="activeTab === 'periodos'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Periodos</h2>
            <button class="btn btn-primary btn-sm">Agregar</button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="3" class="text-center text-base-content/60">
                    No hay periodos registrados
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Horarios -->
        <div v-if="activeTab === 'horarios'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Horarios</h2>
            <button class="btn btn-primary btn-sm">Agregar</button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Hora Inicio</th>
                  <th>Hora Fin</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="4" class="text-center text-base-content/60">
                    No hay horarios registrados
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Frecuencias -->
        <div v-if="activeTab === 'frecuencias'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Frecuencias</h2>
            <button class="btn btn-primary btn-sm">Agregar</button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="3" class="text-center text-base-content/60">
                    No hay frecuencias registradas
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Profesores -->
        <div v-if="activeTab === 'profesores'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Profesores</h2>
            <button class="btn btn-primary btn-sm">Agregar</button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Especialidad</th>
                  <th>Fecha Registro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="5" class="text-center text-base-content/60">
                    No hay profesores registrados
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
