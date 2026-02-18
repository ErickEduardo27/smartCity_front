<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  uploadDocument,
  ingestDocument,
  listDocuments,
  isAuthenticated,
  type DocumentResponse,
  type DocumentIngestResponse,
} from '../services/api'

const documentos = ref<DocumentResponse[]>([])
const cargando = ref(false)
const procesando = ref<number | null>(null)
const mensaje = ref('')
const tipoMensaje = ref<'success' | 'error' | ''>('')
const archivoSeleccionado = ref<File | null>(null)
const dragOver = ref(false)

const cargarDocumentos = async () => {
  if (!isAuthenticated()) {
    return
  }

  try {
    documentos.value = await listDocuments()
  } catch (error) {
    mostrarMensaje(
      error instanceof Error ? error.message : 'Error al cargar documentos',
      'error'
    )
  }
}

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    archivoSeleccionado.value = input.files[0] as File
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  dragOver.value = true
}

const handleDragLeave = () => {
  dragOver.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  dragOver.value = false

  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    archivoSeleccionado.value = event.dataTransfer.files[0] as File
  }
}

const subirDocumento = async () => {
  if (!archivoSeleccionado.value) {
    mostrarMensaje('Por favor selecciona un archivo', 'error')
    return
  }

  if (!isAuthenticated()) {
    mostrarMensaje('Por favor, inicia sesión para subir documentos', 'error')
    return
  }

  // Validar tipo de archivo
  const tiposPermitidos = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]

  if (!tiposPermitidos.includes(archivoSeleccionado.value.type)) {
    mostrarMensaje(
      'Tipo de archivo no permitido. Solo se permiten: PDF, DOCX, TXT',
      'error'
    )
    return
  }

  cargando.value = true
  mensaje.value = ''
  tipoMensaje.value = ''

  try {
    const documento = await uploadDocument(archivoSeleccionado.value)
    mostrarMensaje(`Documento "${documento.filename}" subido exitosamente`, 'success')
    archivoSeleccionado.value = null
    // Resetear input file
    const fileInput = document.getElementById('file-input') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
    await cargarDocumentos()
  } catch (error) {
    mostrarMensaje(
      error instanceof Error ? error.message : 'Error al subir el documento',
      'error'
    )
  } finally {
    cargando.value = false
  }
}

const procesarDocumento = async (documentId: number) => {
  if (!isAuthenticated()) {
    mostrarMensaje('Por favor, inicia sesión para procesar documentos', 'error')
    return
  }

  procesando.value = documentId
  mensaje.value = ''
  tipoMensaje.value = ''

  try {
    const resultado: DocumentIngestResponse = await ingestDocument(documentId)
    mostrarMensaje(
      `Documento procesado: ${resultado.chunks_created} chunks creados, ${resultado.embeddings_created} embeddings creados`,
      'success'
    )
    await cargarDocumentos()
  } catch (error) {
    mostrarMensaje(
      error instanceof Error ? error.message : 'Error al procesar el documento',
      'error'
    )
  } finally {
    procesando.value = null
  }
}

const obtenerNombreEstado = (status: string): string => {
  const estados: Record<string, string> = {
    UPLOADED: 'Subido',
    PROCESSING: 'Procesando',
    PROCESSED: 'Procesado',
    ERROR: 'Error',
  }
  return estados[status] || status
}

const obtenerColorEstado = (status: string): string => {
  const colores: Record<string, string> = {
    UPLOADED: '#6b7280',
    PROCESSING: '#f59e0b',
    PROCESSED: '#10b981',
    ERROR: '#ef4444',
  }
  return colores[status] || '#6b7280'
}

const formatearTamaño = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const mostrarMensaje = (msg: string, tipo: 'success' | 'error') => {
  mensaje.value = msg
  tipoMensaje.value = tipo
  setTimeout(() => {
    if (mensaje.value === msg) {
      mensaje.value = ''
      tipoMensaje.value = ''
    }
  }, 5000)
}

onMounted(() => {
  cargarDocumentos()
})
</script>

<template>
  <div class="documents-container">
    <div class="header">
      <h1>Gestión de Documentos</h1>
      <p class="subtitle">Sube y procesa documentos para el RAG</p>
    </div>

    <div class="content">
      <!-- Sección de subida -->
      <div class="upload-section">
        <h2>Subir Documento</h2>
        <div
          class="drop-zone"
          :class="{ 'drag-over': dragOver }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            @change="handleFileSelect"
            class="file-input"
          />
          <div class="drop-zone-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p v-if="!archivoSeleccionado" class="drop-zone-text">
              Arrastra un archivo aquí o haz clic para seleccionar
            </p>
            <p v-else class="drop-zone-text selected">
              {{ archivoSeleccionado.name }}
            </p>
            <p class="drop-zone-hint">Formatos permitidos: PDF, DOCX, TXT</p>
          </div>
        </div>
        <button
          @click="subirDocumento"
          :disabled="!archivoSeleccionado || cargando"
          class="upload-button"
        >
          <span v-if="!cargando">Subir Documento</span>
          <span v-else class="processing">
            <span class="spinner"></span>
            Subiendo...
          </span>
        </button>
      </div>

      <!-- Mensajes -->
      <div v-if="mensaje" :class="['mensaje', tipoMensaje]">
        <svg
          v-if="tipoMensaje === 'success'"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <svg
          v-else-if="tipoMensaje === 'error'"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{{ mensaje }}</span>
      </div>

      <!-- Lista de documentos -->
      <div class="documents-section">
        <div class="section-header">
          <h2>Documentos Subidos</h2>
          <button @click="cargarDocumentos" class="refresh-button" title="Actualizar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>

        <div v-if="documentos.length === 0" class="empty-state">
          <p>No hay documentos subidos aún</p>
        </div>

        <div v-else class="documents-list">
          <div v-for="doc in documentos" :key="doc.id" class="document-card">
            <div class="document-info">
              <div class="document-header">
                <h3>{{ doc.filename }}</h3>
                <span
                  class="status-badge"
                  :style="{ backgroundColor: obtenerColorEstado(doc.status) + '20', color: obtenerColorEstado(doc.status) }"
                >
                  {{ obtenerNombreEstado(doc.status) }}
                </span>
              </div>
              <div class="document-details">
                <span class="detail-item">
                  <strong>Tipo:</strong> {{ doc.file_type.toUpperCase() }}
                </span>
                <span class="detail-item">
                  <strong>Tamaño:</strong> {{ formatearTamaño(doc.file_size) }}
                </span>
                <span class="detail-item">
                  <strong>Subido:</strong> {{ new Date(doc.created_at).toLocaleDateString('es-ES') }}
                </span>
              </div>
            </div>
            <div class="document-actions">
              <button
                @click="procesarDocumento(doc.id)"
                :disabled="procesando === doc.id || doc.status === 'PROCESSING' || doc.status === 'PROCESSED'"
                class="process-button"
              >
                <span v-if="procesando === doc.id" class="processing">
                  <span class="spinner"></span>
                  Procesando...
                </span>
                <span v-else-if="doc.status === 'PROCESSED'">Ya Procesado</span>
                <span v-else>Procesar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.documents-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  background: #ffffff;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

.header {
  background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
  color: white;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.5px;
}

.header .subtitle {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.9;
  font-weight: 300;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background: #f5f7fa;
}

.upload-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.upload-section h2 {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
  color: #1f2937;
}

.drop-zone {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #f9fafb;
  margin-bottom: 1rem;
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: #2563eb;
  background: #eff6ff;
}

.file-input {
  display: none;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #6b7280;
}

.drop-zone-text {
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
}

.drop-zone-text.selected {
  color: #2563eb;
}

.drop-zone-hint {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
}

.upload-button {
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

.upload-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.upload-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.processing {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 16px;
  height: 16px;
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

.mensaje {
  margin-bottom: 2rem;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
  animation: fadeIn 0.3s ease-in;
}

.mensaje.success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.mensaje.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.documents-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #1f2937;
}

.refresh-button {
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #6b7280;
}

.refresh-button:hover {
  background: #e5e7eb;
  color: #1f2937;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.document-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s;
}

.document-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #d1d5db;
}

.document-info {
  flex: 1;
}

.document-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.document-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.document-details {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.detail-item {
  display: flex;
  gap: 0.5rem;
}

.document-actions {
  display: flex;
  gap: 0.5rem;
}

.process-button {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.process-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #047857 0%, #065f46 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
}

.process-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .content {
    padding: 1.5rem 1rem;
  }

  .upload-section,
  .documents-section {
    padding: 1.5rem;
  }

  .document-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .document-actions {
    width: 100%;
  }

  .process-button {
    width: 100%;
    justify-content: center;
  }
}
</style>

