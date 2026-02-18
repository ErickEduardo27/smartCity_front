<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { streamChatPublic, isAuthenticated, type ChatRequest } from '../services/api'

interface Mensaje {
  id: number
  texto: string
  esUsuario: boolean
  timestamp: Date
  cargando?: boolean
}

const mensajes = ref<Mensaje[]>([])
const inputPregunta = ref('')
const enviando = ref(false)
const chatContainer = ref<HTMLElement | null>(null)
const useRag = ref(true) // RAG disponible incluso sin autenticación
const temperature = ref(0.0)
const maxTokens = ref(512)

let mensajeIdCounter = 0
let cancelStream: (() => void) | null = null

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

const enviarMensaje = async () => {
  const pregunta = inputPregunta.value.trim()

  if (!pregunta || enviando.value) {
    return
  }

  // Agregar mensaje del usuario
  const mensajeUsuario: Mensaje = {
    id: mensajeIdCounter++,
    texto: pregunta,
    esUsuario: true,
    timestamp: new Date(),
  }
  mensajes.value.push(mensajeUsuario)
  inputPregunta.value = ''
  scrollToBottom()

  // Agregar mensaje de carga
  const mensajeCarga: Mensaje = {
    id: mensajeIdCounter++,
    texto: '',
    esUsuario: false,
    timestamp: new Date(),
    cargando: true,
  }
  mensajes.value.push(mensajeCarga)
  enviando.value = true
  scrollToBottom()

  try {
    // Preparar request
    const request: ChatRequest = {
      message: pregunta,
      conversation_id: null, // Sin conversación para usuarios no autenticados
      use_rag: useRag.value, // RAG disponible incluso sin autenticación
      temperature: temperature.value,
      max_tokens: maxTokens.value,
    }

    // Iniciar streaming con endpoint público
    let respuestaCompleta = ''

    cancelStream = streamChatPublic(
      request,
      (token: string) => {
        // Recibir token y actualizar mensaje
        respuestaCompleta += token
        const indexCarga = mensajes.value.findIndex((m) => m.id === mensajeCarga.id)
        if (indexCarga !== -1) {
          mensajes.value[indexCarga] = {
            id: mensajeCarga.id,
            texto: respuestaCompleta,
            esUsuario: false,
            timestamp: new Date(),
            cargando: false,
          }
          scrollToBottom()
        }
      },
      (error: Error) => {
        // Manejar error
        const indexCarga = mensajes.value.findIndex((m) => m.id === mensajeCarga.id)
        if (indexCarga !== -1) {
          mensajes.value[indexCarga] = {
            id: mensajeCarga.id,
            texto: error.message || 'Error al procesar la pregunta',
            esUsuario: false,
            timestamp: new Date(),
            cargando: false,
          }
        }
        enviando.value = false
        scrollToBottom()
      },
      () => {
        // Stream completado
        enviando.value = false
        scrollToBottom()
        cancelStream = null
      }
    )
  } catch (error) {
    // Error al iniciar el stream
    const indexCarga = mensajes.value.findIndex((m) => m.id === mensajeCarga.id)
    if (indexCarga !== -1) {
      mensajes.value[indexCarga] = {
        id: mensajeCarga.id,
        texto: error instanceof Error ? error.message : 'Error al procesar la pregunta',
        esUsuario: false,
        timestamp: new Date(),
        cargando: false,
      }
    }
    enviando.value = false
    scrollToBottom()
  }
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    enviarMensaje()
  }
}

const cancelarStream = () => {
  if (cancelStream) {
    cancelStream()
    cancelStream = null
    enviando.value = false
  }
}

import { useRouter } from 'vue-router'

const router = useRouter()

const handleLoginClick = () => {
  router.push({ name: 'auth' })
}

onMounted(() => {
  // Mensaje de bienvenida
  mensajes.value.push({
    id: mensajeIdCounter++,
    texto: 'Hola, soy tu asistente inteligente. Puedes hacer preguntas sin necesidad de iniciar sesión. ¿En qué puedo ayudarte?',
    esUsuario: false,
    timestamp: new Date(),
  })
})

onUnmounted(() => {
  // Cancelar stream si está activo
  if (cancelStream) {
    cancelStream()
  }
})
</script>

<template>
  <div class="chat-container">
    <div class="chat-header">
      <div class="header-top">
        <div>
          <h1>Asistente Inteligente</h1>
          <p class="subtitle">Consulta información sin necesidad de iniciar sesión</p>
        </div>
        <button
          v-if="!isAuthenticated()"
          @click="handleLoginClick"
          class="login-button"
          title="Iniciar sesión"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
            <polyline points="10 17 15 12 10 7"></polyline>
            <line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
          <span>Iniciar Sesión</span>
        </button>
      </div>
    </div>

    <div class="chat-messages" ref="chatContainer">
      <div
        v-for="mensaje in mensajes"
        :key="mensaje.id"
        :class="['message', mensaje.esUsuario ? 'user-message' : 'bot-message']"
      >
        <div class="message-content">
          <div v-if="mensaje.cargando" class="loading">
            <div>Pensando</div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
          </div>
          <div v-else class="message-text">{{ mensaje.texto }}</div>
        </div>
        <div class="message-time">
          {{ mensaje.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }}
        </div>
      </div>
    </div>

    <div class="chat-input-container">
      <div class="input-wrapper">
        <textarea
          v-model="inputPregunta"
          @keypress="handleKeyPress"
          :disabled="enviando"
          placeholder="Escribe tu pregunta aquí... (Enter para enviar, Shift+Enter para nueva línea)"
          class="chat-input"
          rows="1"
        ></textarea>
        <div class="button-group">
          <button
            v-if="enviando"
            @click="cancelarStream"
            class="cancel-button"
            title="Cancelar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </button>
          <button
            @click="enviarMensaje"
            :disabled="!inputPregunta.trim() || enviando"
            class="send-button"
          >
            <svg
              v-if="!enviando"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <div v-else class="spinner"></div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 90vh;
  max-width: 1200px;
  margin: 0 auto;
  background: #ffffff;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

.chat-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
  color: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.5px;
}

.chat-header .subtitle {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.9;
  font-weight: 300;
}

.login-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.login-button:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-1px);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #e5e7eb;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #9ca3af;
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 75%;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-message {
  align-self: flex-end;
}

.bot-message {
  align-self: flex-start;
}

.message-content {
  padding: 1rem 1.25rem;
  border-radius: 12px;
  word-wrap: break-word;
  line-height: 1.6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.user-message .message-content {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border-bottom-right-radius: 4px;
}

.bot-message .message-content {
  background: white;
  color: #1f2937;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 4px;
}

.message-text {
  white-space: pre-wrap;
}

.message-time {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.5rem;
  padding: 0 0.5rem;
}

.user-message .message-time {
  text-align: right;
}

.bot-message .message-time {
  text-align: left;
}

.loading {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0;
}

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.chat-input-container {
  padding: 1.5rem;
  background: white;
  border-top: 1px solid #e5e7eb;
}

.input-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 0.75rem;
  transition: border-color 0.2s;
}

.input-wrapper:focus-within {
  border-color: #2563eb;
  background: white;
}

.chat-input {
  flex: 1;
  border: none;
  background: transparent;
  resize: none;
  font-size: 1rem;
  font-family: inherit;
  color: #1f2937;
  outline: none;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.5;
}

.chat-input::placeholder {
  color: #9ca3af;
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.send-button,
.cancel-button {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 8px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.cancel-button {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.send-button:hover:not(:disabled),
.cancel-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.cancel-button:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.send-button:active:not(:disabled),
.cancel-button:active:not(:disabled) {
  transform: translateY(0);
}

.send-button:disabled {
  opacity: 0.5;
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

/* Responsive */
@media (max-width: 768px) {
  .chat-container {
    height: 80vh;
  }

  .chat-header {
    padding: 1rem;
  }

  .header-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .login-button {
    width: 100%;
    justify-content: center;
  }

  .chat-header h1 {
    font-size: 1.5rem;
  }

  .message {
    max-width: 85%;
  }

  .chat-messages {
    padding: 1rem;
  }

  .chat-input-container {
    padding: 1rem;
  }
}
</style>

