<script setup lang="ts">
// Dashboard stats se cargarán desde Supabase
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Dashboard</h1>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="stat bg-base-100 rounded-box shadow">
        <div class="stat-title">Estudiantes Activos</div>
        <div class="stat-value text-primary">0</div>
        <div class="stat-desc">Total registrados</div>
      </div>

      <div class="stat bg-base-100 rounded-box shadow">
        <div class="stat-title">Matrículas</div>
        <div class="stat-value text-secondary">0</div>
        <div class="stat-desc">Este periodo</div>
      </div>

      <div class="stat bg-base-100 rounded-box shadow">
        <div class="stat-title">Pagos Pendientes</div>
        <div class="stat-value text-warning">0</div>
        <div class="stat-desc">Por cobrar</div>
      </div>

      <div class="stat bg-base-100 rounded-box shadow">
        <div class="stat-title">Asistencia Hoy</div>
        <div class="stat-value text-success">0%</div>
        <div class="stat-desc">Promedio del día</div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h2 class="card-title">Acciones Rápidas</h2>
          <div class="flex flex-wrap gap-2">
            <router-link to="/matriculas" class="btn btn-primary btn-sm">Nueva Matrícula</router-link>
            <router-link to="/pagos" class="btn btn-secondary btn-sm">Registrar Pago</router-link>
            <router-link to="/asistencias" class="btn btn-accent btn-sm">Tomar Asistencia</router-link>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h2 class="card-title">Próximas Clases</h2>
          <p class="text-base-content/60">No hay clases programadas para hoy</p>
        </div>
      </div>
    </div>
  </div>
</template>
