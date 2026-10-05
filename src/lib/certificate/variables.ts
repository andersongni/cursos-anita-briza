/** Setting: lista de variáveis editáveis no modelo do certificado. */
export const CERTIFICATE_EDITABLE_VARIABLES_KEY = 'certificate.editable_variables'

export type CertificateEditableVariable = {
  /** Id estável da linha (não muda ao renomear a chave). */
  id: string
  /** Chave normalizada, ex.: `{course_name}` */
  key: string
  value: string
}

/** Chaves reservadas do sistema — não podem ser usadas como variáveis editáveis. */
export const RESERVED_VARIABLE_KEYS = [
  '{student_name}',
  '{certificate_code}',
  '{date}',
  '{logo}',
] as const

export const RESERVED_VARIABLE_KEY_SET = new Set<string>(RESERVED_VARIABLE_KEYS)

/** Sync opcional com settings legados ainda usados em outras partes do app. */
export const LEGACY_VARIABLE_SETTING_KEYS: Record<string, string> = {
  '{course_name}': 'platform.course_name',
  '{institution}': 'platform.institution',
  '{course_hours}': 'certificate.course_hours',
  '{location}': 'certificate.location',
}

export function stripVariableBraces(key: string): string {
  return key.trim().replace(/^\{/, '').replace(/\}$/, '')
}

/** Normaliza entrada do admin para `{snake_case}`. Retorna '' se inválida. */
export function normalizeVariableKey(raw: string): string {
  const inner = stripVariableBraces(raw)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  if (!inner) return ''
  return `{${inner}}`
}

function newVarId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `var_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createDefaultEditableVariables(values?: {
  institutionName?: string
  courseName?: string
  courseHours?: string | number
  location?: string
}): CertificateEditableVariable[] {
  return [
    {
      id: 'institution',
      key: '{institution}',
      value: values?.institutionName ?? 'Núcleo Assistencial Anita Briza',
    },
    {
      id: 'course_name',
      key: '{course_name}',
      value: values?.courseName ?? 'Informática Básica',
    },
    {
      id: 'course_hours',
      key: '{course_hours}',
      value: String(values?.courseHours ?? 40),
    },
    {
      id: 'location',
      key: '{location}',
      value: values?.location ?? 'São Paulo',
    },
  ]
}

export function normalizeEditableVariables(
  raw: unknown,
  fallback?: CertificateEditableVariable[],
  opts?: { allowEmpty?: boolean }
): CertificateEditableVariable[] {
  const base = fallback ?? createDefaultEditableVariables()
  if (!Array.isArray(raw)) return base

  const seen = new Set<string>()
  const out: CertificateEditableVariable[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Partial<CertificateEditableVariable>
    const key = normalizeVariableKey(String(obj.key ?? ''))
    if (!key || RESERVED_VARIABLE_KEY_SET.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push({
      id: typeof obj.id === 'string' && obj.id ? obj.id : newVarId(),
      key,
      value: obj.value == null ? '' : String(obj.value),
    })
  }

  if (out.length > 0) return out
  if (opts?.allowEmpty) return []
  return base
}

export function editableVariablesToMap(
  variables: CertificateEditableVariable[]
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const v of variables) {
    map[v.key] = v.value
    map[stripVariableBraces(v.key)] = v.value
  }
  return map
}

export function replaceVariableKeyInText(text: string, oldKey: string, newKey: string): string {
  if (!oldKey || !newKey || oldKey === newKey) return text
  return text.split(oldKey).join(newKey)
}

export function suggestNewVariableKey(existing: CertificateEditableVariable[]): string {
  const used = new Set(existing.map((v) => v.key))
  let i = 1
  while (used.has(`{var_${i}}`) || RESERVED_VARIABLE_KEY_SET.has(`{var_${i}}`)) i += 1
  return `{var_${i}}`
}

export function createEditableVariable(
  partial?: Partial<CertificateEditableVariable>,
  existing: CertificateEditableVariable[] = []
): CertificateEditableVariable {
  const key =
    normalizeVariableKey(partial?.key ?? '') || suggestNewVariableKey(existing)
  return {
    id: partial?.id || newVarId(),
    key,
    value: partial?.value ?? '',
  }
}
