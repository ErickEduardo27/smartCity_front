<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { register, login, type UserCreate, type UserLogin } from '../services/api'

const router = useRouter()

const isLogin = ref(true)
const loading = ref(false)
const error = ref('')

// Formulario de login
const loginForm = ref<UserLogin>({
  username: '',
  password: '',
})

// Formulario de registro
const registerForm = ref<UserCreate>({
  username: '',
  email: '',
  password: '',
})

const confirmPassword = ref('')

// Computed properties para v-model condicional
const username = computed({
  get: () => isLogin.value ? loginForm.value.username : registerForm.value.username,
  set: (value: string) => {
    if (isLogin.value) {
      loginForm.value.username = value
    } else {
      registerForm.value.username = value
    }
  }
})

const password = computed({
  get: () => isLogin.value ? loginForm.value.password : registerForm.value.password,
  set: (value: string) => {
    if (isLogin.value) {
      loginForm.value.password = value
    } else {
      registerForm.value.password = value
    }
  }
})

const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    error.value = 'Por favor completa todos los campos'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await login(loginForm.value)
    // Emitir evento para notificar a App.vue que el usuario se autenticó
    window.dispatchEvent(new Event('auth-changed'))
    router.push({ name: 'chat' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (!registerForm.value.username || !registerForm.value.email || !registerForm.value.password) {
    error.value = 'Por favor completa todos los campos'
    return
  }

  if (registerForm.value.password !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }

  if (registerForm.value.password.length < 6) {
    error.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await register(registerForm.value)
    // Después de registrar, hacer login automático
    await login({
      username: registerForm.value.username,
      password: registerForm.value.password,
    })
    // Emitir evento para notificar a App.vue que el usuario se autenticó
    window.dispatchEvent(new Event('auth-changed'))
    router.push({ name: 'chat' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al registrar usuario'
  } finally {
    loading.value = false
  }
}

const toggleMode = () => {
  isLogin.value = !isLogin.value
  error.value = ''
  loginForm.value = { username: '', password: '' }
  registerForm.value = { username: '', email: '', password: '' }
  confirmPassword.value = ''
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <h1>{{ isLogin ? 'Iniciar Sesión' : 'Registrarse' }}</h1>
        <p class="subtitle">
          {{ isLogin ? 'Ingresa tus credenciales para continuar' : 'Crea una cuenta para comenzar' }}
        </p>
      </div>

      <div v-if="error" class="error-message">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{{ error }}</span>
      </div>

      <form @submit.prevent="isLogin ? handleLogin() : handleRegister()" class="auth-form">
        <div v-if="!isLogin" class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="registerForm.email"
            type="email"
            placeholder="tu@email.com"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="username">Usuario</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="nombre_usuario"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="password">Contraseña</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            :disabled="loading"
          />
        </div>

        <div v-if="!isLogin" class="form-group">
          <label for="confirmPassword">Confirmar Contraseña</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="••••••••"
            required
            :disabled="loading"
          />
        </div>

        <button type="submit" :disabled="loading" class="submit-button">
          <span v-if="loading" class="spinner"></span>
          <span v-else>{{ isLogin ? 'Iniciar Sesión' : 'Registrarse' }}</span>
        </button>
      </form>

      <div class="auth-footer">
        <p>
          {{ isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?' }}
          <button @click="toggleMode" class="toggle-button" :disabled="loading">
            {{ isLogin ? 'Regístrate' : 'Inicia sesión' }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg,rgb(226, 226, 226) 0%,rgb(255, 255, 255) 100%);
  padding: 2rem;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.auth-header {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.auth-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.auth-header .subtitle {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.9;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  background: #fee2e2;
  color: #991b1b;
  border-bottom: 1px solid #fca5a5;
  font-size: 0.9rem;
}

.auth-form {
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #1f2937;
  font-size: 0.9rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  color: #1f2937;
  background: white;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f9fafb;
}

.submit-button {
  width: 100%;
  padding: 0.875rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.submit-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-footer {
  padding: 1.5rem 2rem;
  text-align: center;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
  font-size: 0.9rem;
}

.toggle-button {
  background: none;
  border: none;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  margin-left: 0.5rem;
  text-decoration: underline;
  font-size: inherit;
}

.toggle-button:hover:not(:disabled) {
  color: #1d4ed8;
}

.toggle-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .auth-container {
    padding: 1rem;
  }

  .auth-card {
    border-radius: 12px;
  }

  .auth-header {
    padding: 1.5rem;
  }

  .auth-form {
    padding: 1.5rem;
  }
}
</style>

