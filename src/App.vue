<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { isAuthenticated, getCurrentUser, logout, type UserResponse } from './services/api'

const router = useRouter()
const route = useRoute()
const usuario = ref<UserResponse | null>(null)
const cargandoUsuario = ref(true)

const cargarUsuario = async () => {
  if (!isAuthenticated()) {
    cargandoUsuario.value = false
    return
  }

  try {
    usuario.value = await getCurrentUser()
  } catch (error) {
    console.error('Error al cargar usuario:', error)
  } finally {
    cargandoUsuario.value = false
  }
}

const handleLogout = () => {
  logout()
  usuario.value = null
  router.push('/')
}

const cambiarVista = (vista: string) => {
  router.push({ name: vista })
}

const isActiveRoute = (routeName: string) => {
  return route.name === routeName
}

onMounted(() => {
  cargarUsuario()
})
</script>

<template>
  <div class="app-container">
    <!-- Navegación solo para rutas autenticadas -->
    <nav v-if="isAuthenticated() && (route.name === 'chat' || route.name === 'documents')" class="navigation">
      <div class="nav-left">
        <button
          @click="cambiarVista('chat')"
          :class="['nav-button', { active: isActiveRoute('chat') }]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Chat</span>
        </button>
        <button
          @click="cambiarVista('documents')"
          :class="['nav-button', { active: isActiveRoute('documents') }]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span>Documentos</span>
        </button>
      </div>
      <div class="nav-right">
        <div v-if="usuario" class="user-info">
          <span class="username">{{ usuario.username }}</span>
          <span class="user-email">{{ usuario.email }}</span>
        </div>
        <button @click="handleLogout" class="logout-button" title="Cerrar sesión">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </nav>

    <!-- Router view -->
    <div class="content">
      <router-view v-if="!cargandoUsuario || isAuthenticated()" />
      <div v-else class="loading-container">
        <div class="spinner"></div>
        <p>Cargando...</p>
      </div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f7fa;
}

.navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 0.5rem 1rem;
  gap: 1rem;
  z-index: 10;
}

.nav-left {
  display: flex;
  gap: 0.5rem;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 0.875rem;
}

.username {
  font-weight: 600;
  color: #1f2937;
}

.user-email {
  font-size: 0.75rem;
  color: #6b7280;
}

.nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-button:hover {
  background: #f9fafb;
  color: #1f2937;
}

.nav-button.active {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
}

.nav-button.active:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
}

.logout-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #fee2e2;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #991b1b;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-button:hover {
  background: #fecaca;
  color: #7f1d1d;
}

.content {
  flex: 1;
  overflow: hidden;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 1rem;
  color: #6b7280;
}

.loading-container .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .navigation {
    padding: 0.5rem;
    flex-wrap: wrap;
  }

  .nav-button span {
    display: none;
  }

  .nav-button {
    flex: 0 0 auto;
    width: auto;
    min-width: 48px;
    padding: 0.625rem;
  }

  .user-info {
    display: none;
  }

  .logout-button span {
    display: none;
  }

  .logout-button {
    padding: 0.5rem;
  }
}
</style>
