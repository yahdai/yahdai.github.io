import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// PWA - Registrar service worker
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onNeedRefresh() {
    console.log('Nueva versión disponible. Recarga la página para actualizar.')
  },
  onOfflineReady() {
    console.log('La aplicación está lista para funcionar offline.')
  }
})

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
