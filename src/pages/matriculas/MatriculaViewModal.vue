<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MatriculaDetallada } from '@/services/matriculas'
import { jsPDF } from 'jspdf'
import logoYahdai from '@/assets/logoyahdai.png'

interface Props {
  matricula: MatriculaDetallada | null
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const downloadingPdf = ref(false)

// Función para cargar imagen como base64
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function getFullName(persona: { nombres: string; ap_paterno: string; ap_materno: string | null }): string {
  return `${persona.nombres} ${persona.ap_paterno}${persona.ap_materno ? ' ' + persona.ap_materno : ''}`
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateString: string | null): string {
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

async function downloadPDF() {
  if (!props.matricula) return

  downloadingPdf.value = true

  try {
    const m = props.matricula
    const alumno = m.alumnos.personas
    const alumnoNombre = getFullName(alumno)
    const filename = `Contrato_Matricula_${m.id_matricula}_${alumnoNombre.replace(/\s+/g, '_')}.pdf`

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = 210
    const pageHeight = 297
    const margin = 12
    const contentWidth = pageWidth - (margin * 2)
    let y = margin

    // Colores corporativos basados en el logo
    const orangeColor = { r: 240, g: 171, b: 0 }    // Naranja del logo
    const navyColor = { r: 27, g: 54, b: 93 }       // Azul marino del logo
    const darkColor = { r: 31, g: 41, b: 55 }
    const grayColor = { r: 100, g: 100, b: 100 }
    const lightGray = { r: 245, g: 245, b: 245 }

    // Cargar logo
    let logoImage: HTMLImageElement | null = null
    try {
      logoImage = await loadImage(logoYahdai)
    } catch (e) {
      console.warn('No se pudo cargar el logo:', e)
    }

    // Función helper para dibujar rectángulo con bordes redondeados
    function drawRoundedRect(x: number, yPos: number, w: number, h: number, r: number, fill: boolean = true) {
      doc.roundedRect(x, yPos, w, h, r, r, fill ? 'F' : 'S')
    }

    // Función para verificar si necesita nueva página
    function checkNewPage(requiredSpace: number): boolean {
      if (y + requiredSpace > pageHeight - 20) {
        doc.addPage()
        y = addHeader()
        return true
      }
      return false
    }

    // Función para agregar encabezado en cada página
    function addHeader(): number {
      // Barra superior con color naranja
      doc.setFillColor(orangeColor.r, orangeColor.g, orangeColor.b)
      doc.rect(0, 0, pageWidth, 5, 'F')

      // Logo
      if (logoImage) {
        const logoWidth = 35
        const logoHeight = (logoImage.height / logoImage.width) * logoWidth
        doc.addImage(logoImage, 'PNG', margin, 8, logoWidth, logoHeight)
      } else {
        // Fallback: texto
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(orangeColor.r, orangeColor.g, orangeColor.b)
        doc.text('YAH', margin, 16)
        doc.setTextColor(navyColor.r, navyColor.g, navyColor.b)
        doc.text('DAI', margin + 18, 16)
      }

      // Información de contacto (derecha)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
      doc.text('Academia Yahdai', pageWidth - margin, 10, { align: 'right' })
      doc.text('Tel: 941 480 493 | info@yahdai.com', pageWidth - margin, 14, { align: 'right' })

      // Línea separadora
      doc.setDrawColor(navyColor.r, navyColor.g, navyColor.b)
      doc.setLineWidth(0.3)
      doc.line(margin, 22, pageWidth - margin, 22)

      return 26
    }

    // Función para agregar pie de página
    function addFooter() {
      const footerY = pageHeight - 8
      doc.setFontSize(6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
      doc.text('Este documento es un comprobante oficial de Yahdai Academia.', margin, footerY)
      doc.text(`Generado: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - margin, footerY, { align: 'right' })
    }

    // Función para dibujar sección con título
    function drawSection(title: string, yPos: number): number {
      doc.setFillColor(navyColor.r, navyColor.g, navyColor.b)
      doc.rect(margin, yPos, 2, 5, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(navyColor.r, navyColor.g, navyColor.b)
      doc.text(title, margin + 5, yPos + 4)
      return yPos + 8
    }

    // Función para campo de datos
    function drawField(label: string, value: string, xPos: number, yPos: number, labelWidth: number = 30) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
      doc.text(label, xPos, yPos)
      doc.setTextColor(darkColor.r, darkColor.g, darkColor.b)
      doc.setFont('helvetica', 'bold')
      doc.text(value || '-', xPos + labelWidth, yPos)
    }

    // ============ INICIO DEL DOCUMENTO ============
    y = addHeader()

    // Título del documento
    doc.setFillColor(lightGray.r, lightGray.g, lightGray.b)
    drawRoundedRect(margin, y, contentWidth, 14, 2)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(navyColor.r, navyColor.g, navyColor.b)
    doc.text('CONTRATO DE MATRICULA', pageWidth / 2, y + 6, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
    doc.text(`N° ${String(m.id_matricula).padStart(6, '0')} | Periodo: ${m.periodos.nombre}`, pageWidth / 2, y + 11, { align: 'center' })
    y += 16

    // Sección Alumno
    y = drawSection('DATOS DEL ALUMNO', y)
    doc.setFillColor(lightGray.r, lightGray.g, lightGray.b)
    drawRoundedRect(margin, y, contentWidth, 20, 2)
    y += 5
    drawField('Nombre:', alumnoNombre, margin + 3, y, 22)
    drawField('Documento:', alumno.num_documento || '-', margin + 100, y, 25)
    y += 5
    drawField('Celular:', m.celular_alumno || '-', margin + 3, y, 22)
    drawField('Correo:', m.correo_alumno || '-', margin + 100, y, 18)
    y += 5
    drawField('Direccion:', m.direccion_alumno || '-', margin + 3, y, 22)
    y += 7

    // Sección Responsable
    if (m.responsable || m.celular_responsable || m.correo_responsable) {
      y = drawSection('DATOS DEL RESPONSABLE', y)
      doc.setFillColor(lightGray.r, lightGray.g, lightGray.b)
      const responsableHeight = m.responsable ? 15 : 10
      drawRoundedRect(margin, y, contentWidth, responsableHeight, 2)
      y += 5

      if (m.responsable) {
        const responsableNombre = getFullName(m.responsable)
        drawField('Nombre:', responsableNombre, margin + 3, y, 22)
        drawField('Documento:', m.responsable.num_documento || '-', margin + 100, y, 25)
        y += 5
        drawField('Celular:', m.celular_responsable || '-', margin + 3, y, 22)
        drawField('Correo:', m.correo_responsable || '-', margin + 100, y, 18)
        y += 6
      } else {
        drawField('Celular:', m.celular_responsable || '-', margin + 3, y, 22)
        drawField('Correo:', m.correo_responsable || '-', margin + 100, y, 18)
        y += 6
      }
    } else {
      // Alumno es autoresponsable
      doc.setFillColor(230, 255, 230)
      drawRoundedRect(margin, y, contentWidth, 7, 2)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(22, 130, 74)
      doc.text('El alumno actua como su propio responsable legal.', pageWidth / 2, y + 4.5, { align: 'center' })
      y += 8
    }

    // Sección Especialidades Contratadas
    y = drawSection('SERVICIOS CONTRATADOS', y)

    let totalGeneral = 0
    for (const detalle of m.matriculas_detalles) {
      const tipo = detalle.especialidades?.tipo || 'taller'
      const boxHeight = tipo === 'taller' ? 28 : 18
      checkNewPage(boxHeight + 5)

      const profesor = detalle.profesores?.personas
        ? `${detalle.profesores.personas.nombres} ${detalle.profesores.personas.ap_paterno}`
        : '-'
      const total = tipo === 'taller' ? detalle.cant_sesiones * detalle.importe_sesion : detalle.importe_sesion

      // Caja de especialidad
      doc.setFillColor(lightGray.r, lightGray.g, lightGray.b)
      drawRoundedRect(margin, y, contentWidth, boxHeight, 2)

      // Encabezado de especialidad
      doc.setFillColor(navyColor.r, navyColor.g, navyColor.b)
      drawRoundedRect(margin, y, contentWidth, 6, 2)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(detalle.especialidades?.nombre || '-', margin + 4, y + 4.5)

      // Badge de tipo
      const tipoLabel = tipo === 'regular' ? 'REGULAR' : 'TALLER'
      doc.setFillColor(orangeColor.r, orangeColor.g, orangeColor.b)
      const badgeX = pageWidth - margin - 20
      drawRoundedRect(badgeX, y + 1, 18, 4, 1)
      doc.setFontSize(6)
      doc.setTextColor(255, 255, 255)
      doc.text(tipoLabel, badgeX + 9, y + 3.8, { align: 'center' })

      y += 9

      // Detalles
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
      doc.text('Profesor:', margin + 3, y)
      doc.setTextColor(darkColor.r, darkColor.g, darkColor.b)
      doc.text(profesor, margin + 22, y)

      if (tipo === 'taller') {
        doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
        doc.text('Frecuencia:', margin + 80, y)
        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b)
        doc.text(detalle.frecuencias?.nombre || '-', margin + 103, y)
        y += 5

        const horario = detalle.horarios
          ? `${detalle.horarios.hora_inicio} - ${detalle.horarios.hora_fin}`
          : '-'
        doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
        doc.text('Horario:', margin + 3, y)
        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b)
        doc.text(horario, margin + 22, y)

        doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
        doc.text('Inicio:', margin + 80, y)
        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b)
        doc.text(detalle.fecha_inicio ? formatDate(detalle.fecha_inicio) : '-', margin + 95, y)
        y += 5

        doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
        doc.text('Sesiones:', margin + 3, y)
        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b)
        doc.text(`${detalle.cant_sesiones} x ${detalle.minutos_por_sesion} min = S/ ${detalle.importe_sesion.toFixed(2)}/sesion`, margin + 22, y)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(orangeColor.r, orangeColor.g, orangeColor.b)
        doc.text(`SUBTOTAL: S/ ${total.toFixed(2)}`, pageWidth - margin - 3, y, { align: 'right' })
        y += 7
      } else {
        y += 5
        doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
        doc.text('Periodo:', margin + 3, y)
        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b)
        doc.text(`${formatDate(detalle.fecha_inicio)} - ${formatDate(detalle.fecha_fin)}`, margin + 22, y)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(orangeColor.r, orangeColor.g, orangeColor.b)
        doc.text(`SUBTOTAL: S/ ${total.toFixed(2)}`, pageWidth - margin - 3, y, { align: 'right' })
        y += 7
      }

      totalGeneral += total
      y += 1
    }

    // Total General
    doc.setFillColor(navyColor.r, navyColor.g, navyColor.b)
    drawRoundedRect(pageWidth - margin - 50, y, 50, 10, 2)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('TOTAL:', pageWidth - margin - 46, y + 7)
    doc.text(`S/ ${totalGeneral.toFixed(2)}`, pageWidth - margin - 3, y + 7, { align: 'right' })
    y += 12

    // Sección de firmas
    checkNewPage(28)
    y = drawSection('FIRMAS', y)

    const firmaWidth = (contentWidth - 30) / 2
    const firmaY = y + 15

    // Línea firma responsable
    doc.setDrawColor(darkColor.r, darkColor.g, darkColor.b)
    doc.setLineWidth(0.3)
    doc.line(margin + 5, firmaY, margin + 5 + firmaWidth, firmaY)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
    doc.text('Firma del Responsable', margin + 5 + firmaWidth / 2, firmaY + 4, { align: 'center' })
    doc.setFontSize(8)
    const dniResponsable = m.responsable?.num_documento || (m.es_autoresponsable ? alumno.num_documento : null) || '________________'
    doc.text(`DNI: ${dniResponsable}`, margin + 5 + firmaWidth / 2, firmaY + 7, { align: 'center' })

    // Línea firma academia
    doc.line(margin + firmaWidth + 25, firmaY, pageWidth - margin - 5, firmaY)
    doc.setFontSize(8)
    doc.text('Firma y Sello de la Academia', margin + firmaWidth + 25 + firmaWidth / 2, firmaY + 4, { align: 'center' })
    doc.setFontSize(8)
    doc.text('Yahdai Academia', margin + firmaWidth + 25 + firmaWidth / 2, firmaY + 7, { align: 'center' })

    y = firmaY + 10

    // Términos y condiciones
    checkNewPage(22)
    y = drawSection('TERMINOS Y CONDICIONES', y)
    doc.setFillColor(lightGray.r, lightGray.g, lightGray.b)
    drawRoundedRect(margin, y, contentWidth, 20, 2)
    y += 4

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(grayColor.r, grayColor.g, grayColor.b)
    const terminos = [
      '1. El pago de las sesiones debe realizarse segun el cronograma establecido.',
      '2. Las inasistencias deben comunicarse con 24 horas de anticipacion para reprogramacion.',
      '3. No se realizan devoluciones por sesiones no asistidas sin previo aviso.',
      '4. La academia se reserva el derecho de cambiar horarios o profesores previa comunicacion.',
      '5. El presente contrato tiene validez durante el periodo academico indicado.'
    ]
    terminos.forEach((t, i) => {
      doc.text(t, margin + 3, y + (i * 3.5))
    })
    y += 19

    // Cronograma de Pagos (continúa en la misma página si hay espacio)
    if (m.cronogramas_pagos && m.cronogramas_pagos.length > 0) {
      const rowHeight = 7
      const tableHeight = 10 + (m.cronogramas_pagos.length * rowHeight)
      checkNewPage(tableHeight + 5)

      y = drawSection('CRONOGRAMA DE PAGOS', y)

      // Encabezado de tabla
      doc.setFillColor(navyColor.r, navyColor.g, navyColor.b)
      drawRoundedRect(margin, y, contentWidth, 8, 1)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('N°', margin + 10, y + 5.5, { align: 'center' })
      doc.text('FECHA CARGO', margin + 40, y + 5.5, { align: 'center' })
      doc.text('VENCIMIENTO', margin + 85, y + 5.5, { align: 'center' })
      doc.text('IMPORTE', margin + 125, y + 5.5, { align: 'center' })
      doc.text('ESTADO', margin + 165, y + 5.5, { align: 'center' })
      y += 9

      m.cronogramas_pagos.forEach((pago, idx) => {
        if (y > pageHeight - 20) {
          addFooter()
          doc.addPage()
          y = addHeader()
        }

        // Alternar color de fondo
        if (idx % 2 === 0) {
          doc.setFillColor(lightGray.r, lightGray.g, lightGray.b)
          doc.rect(margin, y - 3, contentWidth, rowHeight, 'F')
        }

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b)
        doc.text(`${idx + 1}`, margin + 10, y + 2, { align: 'center' })
        doc.text(formatDate(pago.fecha_cargo), margin + 40, y + 2, { align: 'center' })
        doc.text(formatDate(pago.fecha_vencimiento), margin + 85, y + 2, { align: 'center' })
        doc.setFont('helvetica', 'bold')
        doc.text(`S/ ${pago.importe.toFixed(2)}`, margin + 125, y + 2, { align: 'center' })

        // Estado con color
        let estadoColor = { r: 255, g: 140, b: 0 }
        if (pago.estado === 'pagado') estadoColor = { r: 22, g: 163, b: 74 }
        else if (pago.estado === 'vencido') estadoColor = { r: 220, g: 38, b: 38 }
        else if (pago.estado === 'anulado') estadoColor = { r: 128, g: 128, b: 128 }

        doc.setTextColor(estadoColor.r, estadoColor.g, estadoColor.b)
        doc.text(pago.estado.toUpperCase(), margin + 165, y + 2, { align: 'center' })
        y += rowHeight
      })

      y += 3
    }

    // Cronograma de Sesiones (continúa en la misma página si hay espacio)
    if (m.cronogramas_asistencias && m.cronogramas_asistencias.length > 0) {
      const rowHeight = 7
      const tableHeight = 10 + (m.cronogramas_asistencias.length * rowHeight)
      checkNewPage(tableHeight + 5)

      y = drawSection('CRONOGRAMA DE SESIONES', y)

      // Encabezado de tabla
      doc.setFillColor(navyColor.r, navyColor.g, navyColor.b)
      drawRoundedRect(margin, y, contentWidth, 8, 1)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('N°', margin + 10, y + 5.5, { align: 'center' })
      doc.text('FECHA', margin + 50, y + 5.5, { align: 'center' })
      doc.text('HORARIO', margin + 105, y + 5.5, { align: 'center' })
      doc.text('ESPECIALIDAD', margin + 160, y + 5.5, { align: 'center' })
      y += 9

      m.cronogramas_asistencias.forEach((sesion, idx) => {
        if (y > pageHeight - 20) {
          addFooter()
          doc.addPage()
          y = addHeader()
        }

        const detalle = m.matriculas_detalles.find(d => d.id_matricula_detalle === sesion.id_matricula_detalle)
        const especialidad = detalle?.especialidades?.nombre || '-'

        const fechaInicio = new Date(sesion.fecha_hora_inicio)
        const fechaTexto = fechaInicio.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' })
        const horaInicio = fechaInicio.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        const fechaFin = new Date(sesion.fecha_hora_fin)
        const horaFin = fechaFin.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

        if (idx % 2 === 0) {
          doc.setFillColor(lightGray.r, lightGray.g, lightGray.b)
          doc.rect(margin, y - 3, contentWidth, rowHeight, 'F')
        }

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b)
        doc.text(`${idx + 1}`, margin + 10, y + 2, { align: 'center' })
        doc.text(fechaTexto, margin + 50, y + 2, { align: 'center' })
        doc.text(`${horaInicio} - ${horaFin}`, margin + 105, y + 2, { align: 'center' })
        doc.setFont('helvetica', 'bold')
        doc.text(especialidad, margin + 160, y + 2, { align: 'center' })
        y += rowHeight
      })
    }

    // Footer en todas las páginas
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      addFooter()
    }

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
