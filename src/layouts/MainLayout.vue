<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import logoYahdai from '@/assets/logoyahdai.png'

const router = useRouter()
const authStore = useAuthStore()
const sidebarOpen = ref(false) // Cerrado por defecto en mobile
const sidebarCollapsed = ref(false) // Para colapsar en desktop

const menuItems = [
  { name: 'Dashboard', path: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Matrículas', path: '/matriculas', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { name: 'Estudiantes', path: '/estudiantes', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { name: 'Pagos', path: '/pagos', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { name: 'Asistencias', path: '/asistencias', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { name: 'Catálogos', path: '/catalogos', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' }
]

function closeMobileDrawer() {
  // En mobile, cerrar el drawer después de navegar
  sidebarOpen.value = false
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="drawer lg:drawer-open">
    <!-- Checkbox para controlar el drawer en mobile -->
    <input id="main-drawer" type="checkbox" class="drawer-toggle" v-model="sidebarOpen" />

    <div class="drawer-content flex flex-col min-h-screen bg-base-200">
      <!-- Navbar -->
      <div class="navbar bg-base-100 shadow-md sticky top-0 z-40 border-b border-base-300">
        <div class="flex-none">
          <!-- Botón hamburguesa: siempre visible pero comportamiento diferente según pantalla -->
          <label for="main-drawer" class="btn btn-square btn-ghost lg:hidden hover:bg-base-200">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-5 h-5 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </label>
          <!-- Botón para colapsar sidebar en desktop -->
          <button class="btn btn-square btn-ghost hidden lg:flex hover:bg-base-200 transition-all" @click="sidebarCollapsed = !sidebarCollapsed">
            <svg v-if="!sidebarCollapsed" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2 px-2">
            <div class="badge badge-primary badge-sm hidden sm:flex">Beta</div>
            <span class="text-base sm:text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Sistema de Gestión
            </span>
          </div>
        </div>
        <div class="flex-none flex items-center gap-2">
          <!-- Notificaciones -->
          <button class="btn btn-ghost btn-circle hidden sm:flex">
            <div class="indicator">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span class="badge badge-xs badge-primary indicator-item">3</span>
            </div>
          </button>

          <!-- Usuario -->
          <div class="dropdown dropdown-end">
            <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar placeholder hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
              <div class="bg-gradient-to-br from-primary to-secondary text-primary-content rounded-full w-10">
                <span class="text-sm font-bold">U</span>
              </div>
            </div>
            <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-56 border border-base-300">
              <li class="menu-title">
                <span class="text-xs">Mi cuenta</span>
              </li>
              <li>
                <a class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Perfil
                </a>
              </li>
              <li>
                <a class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configuración
                </a>
              </li>
              <div class="divider my-1"></div>
              <li>
                <a @click="handleLogout" class="text-error flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar sesión
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <main class="flex-1 p-3 sm:p-4 lg:p-6">
        <router-view />
      </main>
    </div>

    <!-- Sidebar -->
    <div class="drawer-side z-50">
      <!-- Overlay para mobile -->
      <label for="main-drawer" class="drawer-overlay lg:hidden"></label>

      <!-- Menú sidebar -->
      <aside
        class="bg-base-100 min-h-full shadow-lg border-r border-base-300 transition-all duration-300 flex flex-col"
        :class="sidebarCollapsed ? 'w-20' : 'w-64'"
      >
        <!-- Header del Sidebar -->
        <div class="p-4 border-b border-base-300">
          <div v-if="!sidebarCollapsed" class="flex items-center gap-3">
            <div class="avatar">
              <div class="w-10 h-10 rounded-lg">
                <img :src="logoYahdai" alt="Yahdai Logo" class="w-full h-full object-contain" />
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="font-bold text-sm truncate">Yahdai</h2>
              <p class="text-xs text-base-content/60 truncate">Academia Musical</p>
            </div>
          </div>
          <div v-else class="flex justify-center">
            <div class="avatar">
              <div class="w-10 h-10 rounded-lg">
                <img :src="logoYahdai" alt="Yahdai Logo" class="w-full h-full object-contain" />
              </div>
            </div>
          </div>
        </div>

        <!-- Navegación Principal -->
        <div class="flex-1 overflow-y-auto">
          <div class="py-3">
            <!-- Sección: Principal -->
            <div v-if="!sidebarCollapsed" class="px-4 mb-2">
              <span class="text-xs font-semibold text-base-content/50">PRINCIPAL</span>
            </div>

            <!-- Items del menú -->
            <nav class="space-y-1">
              <router-link
                v-for="item in menuItems"
                :key="item.path"
                :to="item.path"
                :exact="item.path === '/'"
                custom
                v-slot="{ href, navigate, isActive, isExactActive }"
              >
                <a
                  :href="href"
                  @click="navigate(); closeMobileDrawer()"
                  class="flex items-center gap-3 px-4 py-3 transition-all duration-200 relative group"
                  :class="{
                    'justify-center': sidebarCollapsed,
                    'tooltip tooltip-right': sidebarCollapsed,
                    'bg-primary text-primary-content font-semibold border-r-4 border-primary-focus': isExactActive || (isActive && item.path !== '/'),
                    'hover:bg-base-200': !isExactActive && !(isActive && item.path !== '/')
                  }"
                  :data-tip="sidebarCollapsed ? item.name : undefined"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
                  </svg>
                  <span v-if="!sidebarCollapsed" class="font-medium text-sm">{{ item.name }}</span>
                </a>
              </router-link>
            </nav>
          </div>
        </div>

        <!-- Footer del Sidebar -->
        <div class="p-3 border-t border-base-300 bg-base-200/50">
          <div v-if="!sidebarCollapsed" class="space-y-2">
            <!-- Info de versión -->
            <div class="flex items-center justify-between text-xs text-base-content/60">
              <span class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Versión
              </span>
              <span class="font-semibold">1.0.0</span>
            </div>
            <!-- Estado del sistema -->
            <div class="flex items-center gap-2 text-xs">
              <div class="w-2 h-2 rounded-full bg-success animate-pulse"></div>
              <span class="text-base-content/60">Sistema operativo</span>
            </div>
          </div>
          <div v-else class="flex justify-center">
            <div class="w-2 h-2 rounded-full bg-success animate-pulse"></div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
