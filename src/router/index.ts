import { createRouter, createWebHistory } from 'vue-router'
import ChatPublic from '../components/ChatPublic.vue'
import Chat from '../components/Chat.vue'
import Documents from '../components/Documents.vue'
import Auth from '../components/Auth.vue'
import { isAuthenticated } from '../services/api'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'chat-public',
      component: ChatPublic,
      meta: { requiresAuth: false }
    },
    {
      path: '/chat',
      name: 'chat',
      component: Chat,
      meta: { requiresAuth: true }
    },
    {
      path: '/documents',
      name: 'documents',
      component: Documents,
      meta: { requiresAuth: true }
    },
    {
      path: '/auth',
      name: 'auth',
      component: Auth,
      meta: { requiresAuth: false }
    }
  ]
})

// Guard de navegación
router.beforeEach((to, from, next) => {
  const requiresAuth = to.meta.requiresAuth === true
  
  if (requiresAuth && !isAuthenticated()) {
    // Redirigir a auth si requiere autenticación y no está logueado
    next({ name: 'auth' })
  } else if (to.name === 'auth' && isAuthenticated()) {
    // Si ya está autenticado y va a auth, redirigir a chat
    next({ name: 'chat' })
  } else {
    next()
  }
})

export default router

