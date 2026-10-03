export type UserRole = 'ADMIN' | 'STUDENT'
export type UserStatus = 'PENDING' | 'APPROVED' | 'BLOCKED'
export type QuestionType = 'PROVA' | 'SIMULADO'
export type AssessmentStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'
export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Profile {
  id: string
  username: string
  full_name: string
  email: string | null
  phone: string | null
  role: UserRole
  status: UserStatus
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Dimension {
  id: string
  name: string
  description: string | null
  weight: number
  display_order: number
  target_percentage: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  type: QuestionType
  dimension_id: string
  question_text: string
  active: boolean
  created_at: string
  updated_at: string
  dimension?: Dimension
  options?: QuestionOption[]
}

export interface QuestionOption {
  id: string
  question_id: string
  option_key: OptionKey
  option_text: string
  is_correct: boolean
  explanation: string
}

export interface Assessment {
  id: string
  student_id: string
  type: QuestionType
  status: AssessmentStatus
  attempt_number: number
  started_at: string
  deadline_at: string
  completed_at: string | null
  duration_seconds: number | null
  total_questions: number
  score: number | null
  correct_count: number | null
  wrong_count: number | null
  passed: boolean | null
  created_at: string
  student?: Profile
}

export interface AssessmentQuestion {
  id: string
  assessment_id: string
  question_id: string
  question_order: number
  dimension_id: string
  dimension_name_snapshot: string
  question_text_snapshot: string
  option_a_text: string
  option_b_text: string
  option_c_text: string
  option_d_text: string
  option_e_text: string
  option_a_explanation: string
  option_b_explanation: string
  option_c_explanation: string
  option_d_explanation: string
  option_e_explanation: string
  correct_option: OptionKey
}

// What students see during an assessment (no correct answer for PROVA)
export interface StudentAssessmentQuestion {
  id: string
  assessment_id: string
  question_order: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e: string
}

export interface AssessmentAnswer {
  id: string
  assessment_id: string
  assessment_question_id: string
  selected_option: OptionKey | null
  is_correct: boolean | null
  answered_at: string | null
  flagged_for_review: boolean
}

export interface AttemptRelease {
  id: string
  student_id: string
  released_by: string
  reason: string | null
  used: boolean
  cancelled: boolean
  assessment_id: string | null
  created_at: string
}

export interface Certificate {
  id: string
  student_id: string
  assessment_id: string
  certificate_code: string
  student_name_snapshot: string
  course_name_snapshot: string
  completion_date: string
  score_snapshot: number | null
  template_version: number
  pdf_path: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface SystemSetting {
  id: string
  key: string
  value: unknown
  description: string | null
  updated_at: string
  updated_by: string | null
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// Distribution algorithm types
export interface DimensionDistribution {
  dimension_id: string
  dimension_name: string
  target_percentage: number
  weight: number
  calculated_count: number
  available_count: number
  final_count: number
  warning?: string
}

export interface AssessmentConfig {
  question_count: number
  time_limit_minutes: number
  passing_score: number
  retry_interval_hours: number
  max_attempts: number
  allow_retry: boolean
  avoid_repeat_questions: boolean
  instructions: string
  approved_message: string
  failed_message: string
}
