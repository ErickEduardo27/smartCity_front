/**
 * Servicio API para comunicarse con el backend FastAPI
 * Soporta autenticación JWT y streaming SSE
 */

// Usar proxy en desarrollo, URL directa en producción
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? '' : 'http://172.24.174.219:8020')
const API_PREFIX = '/api/v1'

// Tipos para autenticación
export interface UserCreate {
  username: string
  email: string
  password: string
}

export interface UserLogin {
  username: string
  password: string
}

export interface Token {
  access_token: string
  token_type: string
}

export interface UserResponse {
  id: number
  username: string
  email: string
  is_active: boolean
  created_at: string
}

// Tipos para chat
export interface ChatRequest {
  message: string
  conversation_id?: number | null
  use_rag?: boolean
  temperature?: number
  max_tokens?: number
}

export interface MessageResponse {
  id: number
  role: string
  content: string
  created_at: string
}

export interface MessagesResponse {
  messages: MessageResponse[]
  total: number
  page: number
  page_size: number
  has_more: boolean
  conversation_id?: number | null
}

export interface ConversationResponse {
  id: number
  title: string | null
  created_at: string
  updated_at: string | null
  message_count: number
}

// Tipos para documentos
export interface DocumentResponse {
  id: number
  filename: string
  file_type: string
  file_size: number
  status: string
  created_at: string
}

export interface DocumentIngestResponse {
  document_id: number
  chunks_created: number
  embeddings_created: number
  status: string
}

export interface PresignedUrlRequest {
  filename: string
  file_type: string
  file_size: number
}

export interface PresignedUrlResponse {
  presigned_url: string
  object_name: string
  expires_in: number
}

export interface DocumentMetadata {
  filename: string
  file_type: string
  file_size: number
  object_name: string
}

// Utilidades para manejo de tokens
const TOKEN_KEY = 'auth_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return getToken() !== null
}

// Función helper para hacer requests autenticados
async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
    ...options,
    headers,
  })

  // Si recibimos 401, el token es inválido
  if (response.status === 401) {
    removeToken()
    throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
  }

  return response
}

// Función helper para manejar errores
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      detail: `Error ${response.status}: ${response.statusText}`,
    }))
    throw new Error(errorData.detail || errorData.error || `Error ${response.status}`)
  }
  return response.json()
}

// ========== AUTENTICACIÓN ==========

/**
 * Registra un nuevo usuario
 */
export async function register(userData: UserCreate): Promise<UserResponse> {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  })

  return handleResponse<UserResponse>(response)
}

/**
 * Inicia sesión y obtiene un token JWT
 */
export async function login(credentials: UserLogin): Promise<Token> {
  const formData = new FormData()
  formData.append('username', credentials.username)
  formData.append('password', credentials.password)

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/login`, {
    method: 'POST',
    body: formData,
  })

  const token = await handleResponse<Token>(response)
  setToken(token.access_token)
  return token
}

/**
 * Obtiene información del usuario actual
 */
export async function getCurrentUser(): Promise<UserResponse> {
  const response = await authenticatedFetch('/auth/me')
  return handleResponse<UserResponse>(response)
}

/**
 * Cierra sesión
 */
export function logout(): void {
  removeToken()
}

// ========== CHAT ==========


/**
 * Envía un mensaje al chat público con streaming SSE (sin autenticación requerida)
 * Retorna una función para cancelar el stream
 */
export function streamChatPublic(
  request: ChatRequest,
  onToken: (token: string) => void,
  onError?: (error: Error) => void,
  onComplete?: (conversationId?: number) => void
): () => void {
  let visualBuffer = ''
  let flushTimeout: number | null = null

  const flush = () => {
    if (visualBuffer) {
      onToken(visualBuffer)
      visualBuffer = ''
    }
    flushTimeout = null
  }

  let aborted = false
  const abortController = new AbortController()

  const cancel = () => {
    aborted = true
    abortController.abort()
  }

  ;(async () => {
    try {
      // Obtener token si existe (opcional)
      const token = getToken()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/chat/stream/public`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No se recibió respuesta del servidor')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent: string | null = null

      while (!aborted) {
        const { done, value } = await reader.read()

        if (done) {
          if (onComplete) {
            onComplete()
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()

          if (trimmedLine === '') {
            if (currentEvent === 'done') {
              if (onComplete) {
                onComplete()
              }
              return
            }
            currentEvent = null
            continue
          }

          if (trimmedLine.startsWith('event: ')) {
            currentEvent = trimmedLine.slice(7).trim()
          } else if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.slice(6).trim()

            if (dataStr) {
              if (currentEvent === 'token') {
                visualBuffer += dataStr
                if (!flushTimeout) {
                  flushTimeout = window.setTimeout(flush, 30)
                }
              } else if (currentEvent === 'done') {
                try {
                  const data = JSON.parse(dataStr)
                  if (onComplete) {
                    onComplete(data.conversation_id)
                  }
                } catch {
                  if (onComplete) {
                    onComplete()
                  }
                }
                return
              } else {
                try {
                  const data = JSON.parse(dataStr)
                  if (data.event === 'token' && data.data) {
                    visualBuffer += data.data
                    if (!flushTimeout) {
                      flushTimeout = window.setTimeout(flush, 30)
                    }
                  } else if (data.event === 'done') {
                    if (onComplete) {
                      onComplete(data.data?.conversation_id)
                    }
                    return
                  }
                } catch {
                  if (!currentEvent) {
                    visualBuffer += dataStr
                    if (!flushTimeout) {
                      flushTimeout = window.setTimeout(flush, 30)
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      if (!aborted && onError) {
        onError(
          error instanceof Error
            ? error
            : new Error('Error desconocido al recibir el stream')
        )
      }
    }
  })()

  return cancel
}

/**
 * Envía un mensaje al chat con streaming SSE
 * Retorna una función para cancelar el stream
 */
export function streamChat(
  request: ChatRequest,
  onToken: (token: string) => void,
  onError?: (error: Error) => void,
  onComplete?: (conversationId?: number) => void
): () => void {
  let visualBuffer = ''
  let flushTimeout: number | null = null

  const flush = () => {
    if (visualBuffer) {
      onToken(visualBuffer)
      visualBuffer = ''
    }
    flushTimeout = null
  }

  const token = getToken()
  if (!token) {
    const error = new Error('No autenticado. Por favor, inicia sesión.')
    if (onError) onError(error)
    return () => {}
  }

  let aborted = false
  const abortController = new AbortController()

  const cancel = () => {
    aborted = true
    abortController.abort()
  }

  ;(async () => {
    try {
      const response = await authenticatedFetch('/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No se recibió respuesta del servidor')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent: string | null = null

      while (!aborted) {
        const { done, value } = await reader.read()

        if (done) {
          if (onComplete) {
            onComplete()
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Mantener la línea incompleta en el buffer

        for (const line of lines) {
          const trimmedLine = line.trim()
          
          if (trimmedLine === '') {
            // Línea vacía indica fin de evento SSE, procesar si tenemos evento pendiente
            if (currentEvent === 'done') {
              if (onComplete) {
                onComplete()
              }
              return
            }
            currentEvent = null
            continue
          }

          // Parsear formato SSE: event: <event>\ndata: <data>\n\n
          if (trimmedLine.startsWith('event: ')) {
            currentEvent = trimmedLine.slice(7).trim()
          } else if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.slice(6).trim()
            
            if (dataStr) {
              if (currentEvent === 'token') {
                // Para eventos token, los datos son el chunk directamente
                /* onToken(dataStr) */
                visualBuffer += dataStr

                if (!flushTimeout) {
                  flushTimeout = window.setTimeout(flush, 30)
                }
              } else if (currentEvent === 'done') {
                // Para eventos done, los datos pueden ser JSON
                try {
                  const data = JSON.parse(dataStr)
                  if (onComplete) {
                    onComplete(data.conversation_id)
                  }
                } catch {
                  // Si no es JSON, solo llamar a onComplete
                  if (onComplete) {
                    onComplete()
                  }
                }
                return
              } else {
                // Evento desconocido o sin evento, intentar parsear como JSON
                try {
                  const data = JSON.parse(dataStr)
                  if (data.event === 'token' && data.data) {
                    onToken(data.data)
                  } else if (data.event === 'done') {
                    if (onComplete) {
                      onComplete(data.data?.conversation_id)
                    }
                    return
                  }
                } catch {
                  // Si no es JSON y no hay evento, tratar como token
                  if (!currentEvent) {
                    /* onToken(dataStr) */
                    visualBuffer += dataStr

                    if (!flushTimeout) {
                      flushTimeout = window.setTimeout(flush, 30)
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      if (!aborted && onError) {
        onError(
          error instanceof Error
            ? error
            : new Error('Error desconocido al recibir el stream')
        )
      }
    }
  })()

  return cancel
}

// ========== DOCUMENTOS ==========

/**
 * Sube un documento
 */
export async function uploadDocument(file: File): Promise<DocumentResponse> {
  const token = getToken()
  if (!token) {
    throw new Error('No autenticado. Por favor, inicia sesión.')
  }

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/documents/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  return handleResponse<DocumentResponse>(response)
}

/**
 * Procesa un documento (ingest)
 */
export async function ingestDocument(documentId: number): Promise<DocumentIngestResponse> {
  const response = await authenticatedFetch(`/documents/${documentId}/ingest`, {
    method: 'POST',
  })

  return handleResponse<DocumentIngestResponse>(response)
}

/**
 * Lista todos los documentos del usuario
 */
export async function listDocuments(): Promise<DocumentResponse[]> {
  const response = await authenticatedFetch('/documents/')
  return handleResponse<DocumentResponse[]>(response)
}

// ========== CHAT HISTORY ==========

/**
 * Obtiene los mensajes más recientes del usuario
 */
export async function getLatestMessages(
  page: number = 1,
  pageSize: number = 10
): Promise<MessagesResponse> {
  const response = await authenticatedFetch(
    `/chat/messages/latest?page=${page}&page_size=${pageSize}`
  )
  return handleResponse<MessagesResponse>(response)
}

/**
 * Obtiene mensajes de una conversación específica
 */
export async function getConversationMessages(
  conversationId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<MessagesResponse> {
  const response = await authenticatedFetch(
    `/chat/conversations/${conversationId}/messages?page=${page}&page_size=${pageSize}`
  )
  return handleResponse<MessagesResponse>(response)
}

/**
 * Obtiene todas las conversaciones del usuario
 */
export async function getConversations(): Promise<ConversationResponse[]> {
  const response = await authenticatedFetch('/chat/conversations')
  return handleResponse<ConversationResponse[]>(response)
}

// ========== HEALTH ==========

/**
 * Verifica el estado del servicio
 */
export async function healthCheck(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_BASE_URL}/health/`)
  return handleResponse(response)
}

/**
 * Verifica el estado de la base de datos
 */
export async function healthCheckDb(): Promise<{
  status: string
  database: string
  error?: string
}> {
  const response = await fetch(`${API_BASE_URL}/health/db`)
  return handleResponse(response)
}
