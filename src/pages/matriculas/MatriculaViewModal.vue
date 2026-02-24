<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MatriculaDetallada } from '@/services/matriculas'
import { jsPDF } from 'jspdf'

interface Props {
  matricula: MatriculaDetallada | null
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const downloadingPdf = ref(false)

function getFullName(persona: { nombres: string; ap_paterno: string; ap_materno: string | null }): string {
  return `${persona.nombres} ${persona.ap_paterno}${persona.ap_materno ? ' ' + persona.ap_materno : ''}`
}

function formatDate(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const estadoBadgeClass = computed(() => (estado: string) => {
  switch (estado) {
    case 'activo': return 'badge-success'
    case 'finalizado': return 'badge-info'
    case 'cancelado': return 'badge-error'
    default: return 'badge-ghost'
  }
})

function downloadPDF() {
  if (!props.matricula) return

  downloadingPdf.value = true

  try {
    const m = props.matricula
    const alumno = m.alumnos.personas
    const alumnoNombre = getFullName(alumno)
    const filename = `Matricula_${m.id_matricula}_${alumnoNombre.replace(/\s+/g, '_')}.pdf`

    // Crear documento PDF
    const doc = new jsPDF('p', 'mm', 'a4')
    let y = 20

    // Encabezado
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('YAHDAI ACADEMIA', 105, y, { align: 'center' })

    y += 7
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Comprobante de Matrícula', 105, y, { align: 'center' })

    y += 5
    doc.setFontSize(10)
    doc.text(`ID: ${m.id_matricula}`, 105, y, { align: 'center' })

    y += 3
    doc.setDrawColor(51, 51, 51)
    doc.line(15, y, 195, y)
    y += 10

    // Sección Alumno
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Alumno', 15, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(102, 102, 102)
    doc.text('Nombre:', 20, y)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(alumnoNombre, 70, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(102, 102, 102)
    doc.text('Documento:', 20, y)
    doc.setTextColor(0, 0, 0)
    doc.text(alumno.num_documento || '-', 70, y)
    y += 6

    doc.setTextColor(102, 102, 102)
    doc.text('Celular:', 20, y)
    doc.setTextColor(0, 0, 0)
    doc.text(m.celular_alumno || '-', 70, y)
    y += 6

    doc.setTextColor(102, 102, 102)
    doc.text('Correo:', 20, y)
    doc.setTextColor(0, 0, 0)
    doc.text(m.correo_alumno || '-', 70, y)
    y += 10

    // Sección Responsable
    if (m.responsable || m.celular_responsable || m.correo_responsable) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Responsable', 15, y)
      y += 7

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      if (m.responsable) {
        const responsableNombre = getFullName(m.responsable)
        doc.setTextColor(102, 102, 102)
        doc.text('Nombre:', 20, y)
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        doc.text(responsableNombre, 70, y)
        y += 6

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(102, 102, 102)
        doc.text('Documento:', 20, y)
        doc.setTextColor(0, 0, 0)
        doc.text(m.responsable.num_documento || '-', 70, y)
        y += 6
      }

      doc.setTextColor(102, 102, 102)
      doc.text('Celular:', 20, y)
      doc.setTextColor(0, 0, 0)
      doc.text(m.celular_responsable || '-', 70, y)
      y += 6

      doc.setTextColor(102, 102, 102)
      doc.text('Correo:', 20, y)
      doc.setTextColor(0, 0, 0)
      doc.text(m.correo_responsable || '-', 70, y)
      y += 6

      doc.setTextColor(102, 102, 102)
      doc.text('Dirección:', 20, y)
      doc.setTextColor(0, 0, 0)
      doc.text(m.direccion_responsable || '-', 70, y)
      y += 10
    }

    // Sección Información General
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Información General', 15, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(102, 102, 102)
    doc.text('Periodo:', 20, y)
    doc.setTextColor(0, 0, 0)
    doc.text(m.periodos.nombre, 70, y)
    y += 6

    doc.setTextColor(102, 102, 102)
    doc.text('Fecha Registro:', 20, y)
    doc.setTextColor(0, 0, 0)
    doc.text(formatDate(m.fecha_registro), 70, y)
    y += 6

    doc.setTextColor(102, 102, 102)
    doc.text('Estado:', 20, y)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(m.estado.toUpperCase(), 70, y)
    y += 10

    // Sección Especialidades
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('Especialidades Matriculadas', 15, y)
    y += 8

    // Iterar sobre cada detalle
    for (const detalle of m.matriculas_detalles) {
      // Verificar si necesitamos nueva página
      if (y > 250) {
        doc.addPage()
        y = 20
      }

      const tipo = detalle.especialidades?.tipo || 'taller'
      const profesor = detalle.profesores?.personas
        ? `${detalle.profesores.personas.nombres} ${detalle.profesores.personas.ap_paterno}`
        : '-'

      // Nombre especialidad y tipo
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(detalle.especialidades?.nombre || '-', 20, y)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const tipoLabel = tipo === 'regular' ? 'Regular' : 'Taller'
      const tipoWidth = doc.getTextWidth(tipoLabel)
      const nombreWidth = doc.getTextWidth(detalle.especialidades?.nombre || '-')
      doc.setFillColor(tipo === 'regular' ? 224 : 220, tipo === 'regular' ? 242 : 252, tipo === 'regular' ? 254 : 231)
      doc.rect(25 + nombreWidth, y - 3, tipoWidth + 4, 4, 'F')
      doc.text(tipoLabel, 27 + nombreWidth, y)
      y += 6

      // Detalles
      doc.setFontSize(10)
      doc.setTextColor(102, 102, 102)
      doc.text('Profesor:', 25, y)
      doc.setTextColor(0, 0, 0)
      doc.text(profesor, 75, y)
      y += 6

      if (tipo === 'taller') {
        const horario = detalle.horarios
          ? `${detalle.horarios.hora_inicio} - ${detalle.horarios.hora_fin}`
          : '-'

        doc.setTextColor(102, 102, 102)
        doc.text('Frecuencia:', 25, y)
        doc.setTextColor(0, 0, 0)
        doc.text(detalle.frecuencias?.nombre || '-', 75, y)
        y += 6

        doc.setTextColor(102, 102, 102)
        doc.text('Horario:', 25, y)
        doc.setTextColor(0, 0, 0)
        doc.text(horario, 75, y)
        y += 6

        doc.setTextColor(102, 102, 102)
        doc.text('Fecha Inicio:', 25, y)
        doc.setTextColor(0, 0, 0)
        doc.text(detalle.fecha_inicio ? formatDate(detalle.fecha_inicio) : '-', 75, y)
        y += 6

        doc.setTextColor(102, 102, 102)
        doc.text('Sesiones:', 25, y)
        doc.setTextColor(0, 0, 0)
        doc.text(`${detalle.cant_sesiones} sesiones (${detalle.minutos_por_sesion} min c/u)`, 75, y)
        y += 6

        doc.setTextColor(102, 102, 102)
        doc.text('Importe por sesión:', 25, y)
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        doc.text(`S/ ${detalle.importe_sesion.toFixed(2)}`, 75, y)
        y += 6

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(102, 102, 102)
        doc.text('Total:', 25, y)
        doc.setFontSize(12)
        doc.setTextColor(0, 102, 204)
        doc.text(`S/ ${(detalle.cant_sesiones * detalle.importe_sesion).toFixed(2)}`, 75, y)
        y += 8
      } else {
        doc.setTextColor(102, 102, 102)
        doc.text('Fecha Inicio:', 25, y)
        doc.setTextColor(0, 0, 0)
        doc.text(detalle.fecha_inicio ? formatDate(detalle.fecha_inicio) : '-', 75, y)
        y += 6

        doc.setTextColor(102, 102, 102)
        doc.text('Fecha Fin:', 25, y)
        doc.setTextColor(0, 0, 0)
        doc.text(detalle.fecha_fin ? formatDate(detalle.fecha_fin) : '-', 75, y)
        y += 6

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(102, 102, 102)
        doc.text('Importe Mensual:', 25, y)
        doc.setFontSize(12)
        doc.setTextColor(0, 102, 204)
        doc.text(`S/ ${detalle.importe_sesion.toFixed(2)}`, 75, y)
        y += 8
      }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      y += 2
    }

    // Verificar si necesitamos nueva página para cronogramas
    if (y > 220) {
      doc.addPage()
      y = 20
    }

    // Sección Cronograma de Pagos
    if (m.cronogramas_pagos && m.cronogramas_pagos.length > 0) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Cronograma de Pagos', 15, y)
      y += 8

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(102, 102, 102)
      doc.text('Fecha Cargo', 20, y)
      doc.text('Fecha Vencimiento', 60, y)
      doc.text('Importe', 110, y)
      doc.text('Estado', 145, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)

      for (const pago of m.cronogramas_pagos) {
        if (y > 270) {
          doc.addPage()
          y = 20
        }

        doc.setFontSize(9)
        doc.text(formatDate(pago.fecha_cargo), 20, y)
        doc.text(formatDate(pago.fecha_vencimiento), 60, y)
        doc.text(`S/ ${pago.importe.toFixed(2)}`, 110, y)

        // Color según estado
        switch (pago.estado) {
          case 'pagado':
            doc.setTextColor(0, 150, 0)
            break
          case 'vencido':
            doc.setTextColor(220, 38, 38)
            break
          case 'anulado':
            doc.setTextColor(128, 128, 128)
            break
          default:
            doc.setTextColor(255, 140, 0)
        }
        doc.text(pago.estado.toUpperCase(), 145, y)
        doc.setTextColor(0, 0, 0)
        y += 5
      }
      y += 5
    }

    // Verificar si necesitamos nueva página para asistencias
    if (y > 220) {
      doc.addPage()
      y = 20
    }

    // Sección Cronograma de Sesiones
    if (m.cronogramas_asistencias && m.cronogramas_asistencias.length > 0) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Cronograma de Sesiones', 15, y)
      y += 8

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(102, 102, 102)
      doc.text('Sesión', 20, y)
      doc.text('Fecha y Hora', 50, y)
      doc.text('Especialidad', 120, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)

      let sesionNum = 1
      for (const sesion of m.cronogramas_asistencias) {
        if (y > 270) {
          doc.addPage()
          y = 20
        }

        const detalle = m.matriculas_detalles.find(d => d.id_matricula_detalle === sesion.id_matricula_detalle)
        const especialidad = detalle?.especialidades?.nombre || '-'

        doc.setFontSize(9)
        doc.text(`${sesionNum}`, 25, y)

        // Formatear fecha y hora de inicio
        const fechaInicio = new Date(sesion.fecha_hora_inicio)
        const fechaTexto = fechaInicio.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
        const horaInicio = fechaInicio.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        const fechaFin = new Date(sesion.fecha_hora_fin)
        const horaFin = fechaFin.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

        doc.text(`${fechaTexto} ${horaInicio}-${horaFin}`, 50, y)
        doc.text(especialidad, 120, y)

        y += 5
        sesionNum++
      }
    }

    // Guardar PDF
    doc.save(filename)
  } catch (error: any) {
    console.error('Error generating PDF:', error)
    console.error('Error stack:', error?.stack)
    alert(`Error al generar el PDF: ${error?.message || 'Error desconocido'}. Por favor, intente nuevamente.`)
  } finally {
    downloadingPdf.value = false
  }
}
</script>

<template>
  <div v-if="show" class="modal modal-open">
    <div class="modal-box max-w-4xl">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="emit('close')">✕</button>

      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">Detalles de Matrícula</h3>
        <button
          class="btn btn-primary btn-sm gap-2"
          :class="{ 'loading': downloadingPdf }"
          :disabled="downloadingPdf"
          @click="downloadPDF"
        >
          <svg v-if="!downloadingPdf" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Descargar PDF
        </button>
      </div>

      <div v-if="matricula" ref="pdfContent" class="space-y-4">
        <!-- Encabezado para PDF -->
        <div class="text-center mb-6 pb-4 border-b-2">
          <h2 class="text-2xl font-bold text-primary">YAHDAI ACADEMIA</h2>
          <p class="text-sm text-base-content/60">Comprobante de Matrícula</p>
          <p class="text-xs text-base-content/60">ID: {{ matricula.id_matricula }}</p>
        </div>

        <!-- Información del Alumno -->
        <div class="bg-base-200 rounded-box p-4">
          <h4 class="font-semibold mb-3">Alumno</h4>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="text-base-content/60">Nombre:</div>
            <div>{{ getFullName(matricula.alumnos.personas) }}</div>
            <div class="text-base-content/60">Documento:</div>
            <div>{{ matricula.alumnos.personas.num_documento || '-' }}</div>
            <div class="text-base-content/60">Celular:</div>
            <div>{{ matricula.celular_alumno || '-' }}</div>
            <div class="text-base-content/60">Correo:</div>
            <div>{{ matricula.correo_alumno || '-' }}</div>
          </div>
        </div>

        <!-- Información del Responsable -->
        <div v-if="matricula.responsable || matricula.celular_responsable || matricula.correo_responsable" class="bg-base-200 rounded-box p-4">
          <h4 class="font-semibold mb-3">Responsable</h4>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <template v-if="matricula.responsable">
              <div class="text-base-content/60">Nombre:</div>
              <div>{{ getFullName(matricula.responsable) }}</div>
              <div class="text-base-content/60">Documento:</div>
              <div>{{ matricula.responsable.num_documento || '-' }}</div>
            </template>
            <div class="text-base-content/60">Celular:</div>
            <div>{{ matricula.celular_responsable || '-' }}</div>
            <div class="text-base-content/60">Correo:</div>
            <div>{{ matricula.correo_responsable || '-' }}</div>
            <div class="text-base-content/60">Dirección:</div>
            <div>{{ matricula.direccion_responsable || '-' }}</div>
          </div>
        </div>

        <!-- Información General -->
        <div class="bg-base-200 rounded-box p-4">
          <h4 class="font-semibold mb-3">Información General</h4>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="text-base-content/60">ID Matrícula:</div>
            <div>{{ matricula.id_matricula }}</div>
            <div class="text-base-content/60">Periodo:</div>
            <div>{{ matricula.periodos.nombre }}</div>
            <div class="text-base-content/60">Fecha Registro:</div>
            <div>{{ formatDate(matricula.fecha_registro) }}</div>
            <div class="text-base-content/60">Estado:</div>
            <div>
              <span class="badge" :class="estadoBadgeClass(matricula.estado)">
                {{ matricula.estado.charAt(0).toUpperCase() + matricula.estado.slice(1) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Detalles de Especialidades -->
        <div class="bg-base-200 rounded-box p-4">
          <h4 class="font-semibold mb-3">Especialidades Matriculadas</h4>
          <div v-for="detalle in matricula.matriculas_detalles" :key="detalle.id_matricula_detalle"
            class="mb-4 pb-4 border-b border-base-300 last:border-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="font-semibold">{{ detalle.especialidades?.nombre || '-' }}</span>
              <span class="badge badge-sm" :class="detalle.especialidades?.tipo === 'regular' ? 'badge-info' : 'badge-success'">
                {{ detalle.especialidades?.tipo === 'regular' ? 'Regular' : 'Taller' }}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-base-content/60">Profesor:</div>
              <div>{{ detalle.profesores?.personas ? `${detalle.profesores.personas.nombres} ${detalle.profesores.personas.ap_paterno}` : '-' }}</div>

              <template v-if="detalle.especialidades?.tipo === 'taller'">
                <div class="text-base-content/60">Frecuencia:</div>
                <div>{{ detalle.frecuencias?.nombre || '-' }}</div>
                <div class="text-base-content/60">Horario:</div>
                <div>{{ detalle.horarios ? `${detalle.horarios.hora_inicio} - ${detalle.horarios.hora_fin}` : '-' }}</div>
                <div class="text-base-content/60">Fecha Inicio:</div>
                <div>{{ detalle.fecha_inicio ? formatDate(detalle.fecha_inicio) : '-' }}</div>
                <div class="text-base-content/60">Sesiones:</div>
                <div>{{ detalle.cant_sesiones }} sesiones ({{ detalle.minutos_por_sesion }} min c/u)</div>
                <div class="text-base-content/60">Importe por sesión:</div>
                <div class="font-semibold">S/ {{ detalle.importe_sesion.toFixed(2) }}</div>
                <div class="text-base-content/60">Total:</div>
                <div class="font-semibold text-primary">S/ {{ (detalle.cant_sesiones * detalle.importe_sesion).toFixed(2) }}</div>
              </template>

              <template v-else-if="detalle.especialidades?.tipo === 'regular'">
                <div class="text-base-content/60">Fecha Inicio:</div>
                <div>{{ detalle.fecha_inicio ? formatDate(detalle.fecha_inicio) : '-' }}</div>
                <div class="text-base-content/60">Fecha Fin:</div>
                <div>{{ detalle.fecha_fin ? formatDate(detalle.fecha_fin) : '-' }}</div>
                <div class="text-base-content/60">Importe Mensual:</div>
                <div class="font-semibold text-primary">S/ {{ detalle.importe_sesion.toFixed(2) }}</div>
              </template>
            </div>
          </div>
        </div>

        <!-- Cronograma de Pagos -->
        <div v-if="matricula.cronogramas_pagos && matricula.cronogramas_pagos.length > 0" class="bg-base-200 rounded-box p-4">
          <h4 class="font-semibold mb-3">Cronograma de Pagos</h4>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Fecha Cargo</th>
                  <th>Fecha Vencimiento</th>
                  <th>Importe</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pago in matricula.cronogramas_pagos" :key="pago.id_cronograma_pago">
                  <td>{{ formatDate(pago.fecha_cargo) }}</td>
                  <td>{{ formatDate(pago.fecha_vencimiento) }}</td>
                  <td class="font-semibold">S/ {{ pago.importe.toFixed(2) }}</td>
                  <td>
                    <span class="badge badge-sm" :class="{
                      'badge-success': pago.estado === 'pagado',
                      'badge-error': pago.estado === 'vencido',
                      'badge-warning': pago.estado === 'pendiente',
                      'badge-ghost': pago.estado === 'anulado'
                    }">
                      {{ pago.estado.toUpperCase() }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Cronograma de Sesiones -->
        <div v-if="matricula.cronogramas_asistencias && matricula.cronogramas_asistencias.length > 0" class="bg-base-200 rounded-box p-4">
          <h4 class="font-semibold mb-3">Cronograma de Sesiones</h4>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha y Hora</th>
                  <th>Especialidad</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(sesion, index) in matricula.cronogramas_asistencias" :key="sesion.id_cronograma_asistencia">
                  <td>{{ index + 1 }}</td>
                  <td>{{ formatDateTime(sesion.fecha_hora_inicio) }}</td>
                  <td>
                    {{ matricula.matriculas_detalles.find(d => d.id_matricula_detalle === sesion.id_matricula_detalle)?.especialidades?.nombre || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="emit('close')">Cerrar</button>
      </div>
    </div>
  </div>
</template>
