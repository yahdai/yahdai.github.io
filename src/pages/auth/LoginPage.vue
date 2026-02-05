<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')

async function handleLogin() {
  errorMessage.value = ''

  const result = await authStore.login(email.value, password.value)

  if (result.success) {
    router.push('/')
  } else {
    errorMessage.value = result.error || 'Error al iniciar sesión'
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200 flex items-center justify-center">
    <div class="card w-96 bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title justify-center text-2xl mb-4">Yahdai Academia</h2>

        <div v-if="errorMessage" class="alert alert-error mb-4">
          <span>{{ errorMessage }}</span>
        </div>

        <form @submit.prevent="handleLogin">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Email</span>
            </label>
            <input
              v-model="email"
              type="email"
              placeholder="correo@ejemplo.com"
              class="input input-bordered"
              required
            />
          </div>

          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Contraseña</span>
            </label>
            <input
              v-model="password"
              type="password"
              placeholder="••••••••"
              class="input input-bordered"
              required
            />
          </div>

          <div class="form-control mt-6">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="authStore.loading"
            >
              <span v-if="authStore.loading" class="loading loading-spinner loading-sm"></span>
              <span v-else>Iniciar Sesión</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
