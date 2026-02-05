import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/auth/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/pages/dashboard/DashboardPage.vue')
      },
      {
        path: 'matriculas',
        name: 'Matriculas',
        component: () => import('@/pages/matriculas/MatriculasPage.vue')
      },
      {
        path: 'estudiantes',
        name: 'Estudiantes',
        component: () => import('@/pages/estudiantes/EstudiantesPage.vue')
      },
      {
        path: 'pagos',
        name: 'Pagos',
        component: () => import('@/pages/pagos/PagosPage.vue')
      },
      {
        path: 'asistencias',
        name: 'Asistencias',
        component: () => import('@/pages/asistencias/AsistenciasPage.vue')
      },
      {
        path: 'catalogos',
        name: 'Catalogos',
        component: () => import('@/pages/catalogos/CatalogosPage.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const isAuthenticated = localStorage.getItem('sb-token')

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
