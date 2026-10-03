import jsPDF from 'jspdf'

interface CertificateData {
  studentName: string
  courseName: string
  institutionName: string
  completionDate: string
  score: number
  certificateCode: string
  templateText: string
}

export function generateCertificatePDF(data: CertificateData): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Background - white
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // Border - double line
  doc.setDrawColor(27, 58, 107) // secondary blue
  doc.setLineWidth(2)
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20)
  doc.setLineWidth(0.5)
  doc.rect(14, 14, pageWidth - 28, pageHeight - 28)

  // Corner decorations
  doc.setDrawColor(196, 30, 36) // primary red
  doc.setLineWidth(1.5)
  // Top left corner
  doc.line(14, 25, 35, 25)
  doc.line(25, 14, 25, 35)
  // Top right corner
  doc.line(pageWidth - 14, 25, pageWidth - 35, 25)
  doc.line(pageWidth - 25, 14, pageWidth - 25, 35)
  // Bottom left corner
  doc.line(14, pageHeight - 25, 35, pageHeight - 25)
  doc.line(25, pageHeight - 14, 25, pageHeight - 35)
  // Bottom right corner
  doc.line(pageWidth - 14, pageHeight - 25, pageWidth - 35, pageHeight - 25)
  doc.line(pageWidth - 25, pageHeight - 14, pageWidth - 25, pageHeight - 35)

  // Header - Institution
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(100, 100, 100)
  doc.text('N\u00facleo Assistencial', pageWidth / 2, 35, { align: 'center' })
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(196, 30, 36) // primary red
  doc.text('ANITA BRIZA', pageWidth / 2, 45, { align: 'center' })

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  doc.setTextColor(27, 58, 107) // secondary blue
  doc.text('CERTIFICADO', pageWidth / 2, 65, { align: 'center' })

  // Decorative line under title
  doc.setDrawColor(196, 30, 36)
  doc.setLineWidth(1)
  doc.line(pageWidth / 2 - 40, 69, pageWidth / 2 + 40, 69)

  // Template text with variable replacement
  let text = data.templateText
    .replace('{student_name}', data.studentName)
    .replace('{course_name}', data.courseName)
    .replace('{institution}', data.institutionName)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(50, 50, 50)
  
  const lines = doc.splitTextToSize(text, pageWidth - 80)
  doc.text(lines, pageWidth / 2, 85, { align: 'center' })

  // Student Name - large and prominent
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(27, 58, 107)
  doc.text(data.studentName, pageWidth / 2, 110, { align: 'center' })

  // Decorative line under name
  doc.setDrawColor(196, 30, 36)
  doc.setLineWidth(0.5)
  const nameWidth = doc.getTextWidth(data.studentName)
  doc.line(
    pageWidth / 2 - nameWidth / 2 - 5, 114,
    pageWidth / 2 + nameWidth / 2 + 5, 114
  )

  // Course info
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(50, 50, 50)
  doc.text(`Curso: ${data.courseName}`, pageWidth / 2, 128, { align: 'center' })

  // Score
  if (data.score) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(27, 58, 107)
    doc.text(`Nota: ${data.score.toFixed(1)}%`, pageWidth / 2, 138, { align: 'center' })
  }

  // Date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(100, 100, 100)
  doc.text(`Data de conclus\u00e3o: ${data.completionDate}`, pageWidth / 2, 150, { align: 'center' })

  // Motto
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(12)
  doc.setTextColor(196, 30, 36)
  doc.text('"O Futuro Depende de N\u00f3s"', pageWidth / 2, pageHeight - 35, { align: 'center' })

  // Certificate code
  doc.setFont('courier', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  doc.text(`C\u00f3digo: ${data.certificateCode}`, pageWidth / 2, pageHeight - 22, { align: 'center' })

  return doc
}
