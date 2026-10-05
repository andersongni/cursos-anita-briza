/**
 * Atualiza o banco com o layout/fundo/variáveis oficiais do código.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createScriptPrisma } from './prisma-client'
import {
  CERTIFICATE_BACKGROUND_KEY,
  CERTIFICATE_LAYOUT_KEY,
  createDefaultCertificateLayout,
  DEFAULT_CERTIFICATE_BACKGROUND,
} from '../src/lib/certificate/layout'
import {
  CERTIFICATE_EDITABLE_VARIABLES_KEY,
  createDefaultEditableVariables,
} from '../src/lib/certificate/variables'

const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const k = m[1].trim()
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

const prisma = createScriptPrisma()
const layout = createDefaultCertificateLayout()
const editableVariables = createDefaultEditableVariables()

const updates: { key: string; value: unknown; description: string }[] = [
  {
    key: CERTIFICATE_BACKGROUND_KEY,
    value: DEFAULT_CERTIFICATE_BACKGROUND,
    description: 'Imagem de fundo padrão do certificado',
  },
  {
    key: CERTIFICATE_LAYOUT_KEY,
    value: layout,
    description: 'Layout visual padrão do certificado',
  },
  {
    key: CERTIFICATE_EDITABLE_VARIABLES_KEY,
    value: editableVariables,
    description: 'Variáveis editáveis do certificado (chave/valor)',
  },
  { key: 'certificate.intro_text', value: 'Certificamos que', description: 'Texto introdutório' },
  {
    key: 'certificate.middle_text',
    value: 'concluiu com aproveitamento o curso de',
    description: 'Texto após o nome',
  },
  {
    key: 'certificate.course_description',
    value:
      'desenvolvendo conhecimentos e habilidades para o uso do computador no dia a dia, incluindo sistema operacional, editor de textos, planilhas, internet e comunicação digital.',
    description: 'Descrição do curso',
  },
  { key: 'certificate.code_label', value: ' {certificate_code}', description: 'Código' },
  { key: 'certificate.subtitle', value: 'DE CONCLUSÃO DE CURSO', description: 'Subtítulo' },
  { key: 'certificate.title', value: 'CERTIFICADO', description: 'Título' },
  { key: 'certificate.date_line', value: '{location}, {date}', description: 'Local e data' },
  { key: 'certificate.date_label', value: 'LOCAL E DATA', description: 'Rótulo da data' },
]

async function main() {
  for (const item of updates) {
    const value = JSON.stringify(item.value)
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      update: { value, description: item.description },
      create: { key: item.key, value, description: item.description },
    })
    console.log('ok', item.key)
  }
  console.log('Defaults sincronizados. Fundo:', DEFAULT_CERTIFICATE_BACKGROUND)
  console.log('Elementos no layout padrão:', layout.elements.length)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
