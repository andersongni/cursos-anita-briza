/**
 * Migrações aditivas aplicadas automaticamente no deploy (Vercel build)
 * e no boot do servidor (instrumentation / ensure-schema).
 *
 * REGRA: sempre que alterar `prisma/schema.prisma` com coluna/tabela nova,
 * adicione aqui o SQL equivalente (idempotente — “already exists” é ok).
 *
 * Só use ALTER/CREATE aditivos. Nunca DROP aqui.
 */
export type SchemaMigration = {
  /** Identificador estável para logs */
  id: string
  sql: string
}

export const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    id: '2026-04-03_profile_deleted_at',
    sql: 'ALTER TABLE Profile ADD COLUMN deleted_at DATETIME',
  },
  {
    id: '2026-10-03_create_feedback',
    sql: `CREATE TABLE IF NOT EXISTS Feedback (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Profile(id)
    )`,
  },
  {
    id: '2026-10-04_create_typing_passage',
    sql: `CREATE TABLE IF NOT EXISTS TypingPassage (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    id: '2026-10-04_create_typing_attempt',
    sql: `CREATE TABLE IF NOT EXISTS TypingAttempt (
      id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL,
      passage_id TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      error_count INTEGER NOT NULL,
      chars_total INTEGER NOT NULL,
      wpm REAL NOT NULL,
      accuracy REAL NOT NULL,
      score REAL NOT NULL,
      completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES Profile(id),
      FOREIGN KEY (passage_id) REFERENCES TypingPassage(id)
    )`,
  },
  {
    id: '2026-10-04_typing_attempt_indexes',
    sql: `CREATE INDEX IF NOT EXISTS TypingAttempt_passage_id_duration_ms_idx
      ON TypingAttempt(passage_id, duration_ms)`,
  },
  {
    id: '2026-10-04_typing_attempt_student_idx',
    sql: `CREATE INDEX IF NOT EXISTS TypingAttempt_student_id_passage_id_idx
      ON TypingAttempt(student_id, passage_id)`,
  },
  {
    id: '2026-10-05_create_course',
    sql: `CREATE TABLE IF NOT EXISTS Course (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      hours INTEGER NOT NULL DEFAULT 40,
      active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    id: '2026-10-05_create_course_enrollment',
    sql: `CREATE TABLE IF NOT EXISTS CourseEnrollment (
      id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES Profile(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES Course(id) ON DELETE CASCADE,
      UNIQUE(student_id, course_id)
    )`,
  },
  {
    id: '2026-10-05_course_enrollment_indexes',
    sql: `CREATE INDEX IF NOT EXISTS CourseEnrollment_course_id_idx ON CourseEnrollment(course_id)`,
  },
  {
    id: '2026-10-05_course_enrollment_student_idx',
    sql: `CREATE INDEX IF NOT EXISTS CourseEnrollment_student_id_idx ON CourseEnrollment(student_id)`,
  },
  {
    id: '2026-10-05_dimension_course_id',
    sql: 'ALTER TABLE Dimension ADD COLUMN course_id TEXT',
  },
  {
    id: '2026-10-05_question_course_id',
    sql: 'ALTER TABLE Question ADD COLUMN course_id TEXT',
  },
  {
    id: '2026-10-05_assessment_course_id',
    sql: 'ALTER TABLE Assessment ADD COLUMN course_id TEXT',
  },
  {
    id: '2026-10-05_certificate_course_id',
    sql: 'ALTER TABLE Certificate ADD COLUMN course_id TEXT',
  },
  {
    id: '2026-10-05_attempt_release_course_id',
    sql: 'ALTER TABLE AttemptRelease ADD COLUMN course_id TEXT',
  },
  {
    id: '2026-10-05_dimension_course_idx',
    sql: 'CREATE INDEX IF NOT EXISTS Dimension_course_id_idx ON Dimension(course_id)',
  },
  {
    id: '2026-10-05_question_course_idx',
    sql: 'CREATE INDEX IF NOT EXISTS Question_course_id_idx ON Question(course_id)',
  },
  {
    id: '2026-10-05_assessment_course_idx',
    sql: 'CREATE INDEX IF NOT EXISTS Assessment_course_id_idx ON Assessment(course_id)',
  },
  {
    id: '2026-10-05_question_format',
    sql: `ALTER TABLE Question ADD COLUMN format TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE'`,
  },
  {
    id: '2026-10-05_question_expected_answer',
    sql: `ALTER TABLE Question ADD COLUMN expected_answer TEXT`,
  },
  {
    id: '2026-10-05_aq_format',
    sql: `ALTER TABLE AssessmentQuestion ADD COLUMN format TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE'`,
  },
  {
    id: '2026-10-05_aq_expected_answer_snapshot',
    sql: `ALTER TABLE AssessmentQuestion ADD COLUMN expected_answer_snapshot TEXT NOT NULL DEFAULT ''`,
  },
  {
    id: '2026-10-05_answer_text',
    sql: `ALTER TABLE AssessmentAnswer ADD COLUMN text_answer TEXT`,
  },
  {
    id: '2026-10-05_answer_score_percent',
    sql: `ALTER TABLE AssessmentAnswer ADD COLUMN score_percent REAL`,
  },
  {
    id: '2026-10-05_answer_grading_feedback',
    sql: `ALTER TABLE AssessmentAnswer ADD COLUMN grading_feedback TEXT`,
  },
  {
    id: '2026-11-12_create_mouse_accuracy_attempt',
    sql: `CREATE TABLE IF NOT EXISTS MouseAccuracyAttempt (
      id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      hits INTEGER NOT NULL,
      misses INTEGER NOT NULL,
      points INTEGER NOT NULL,
      accuracy REAL NOT NULL,
      score REAL NOT NULL,
      max_combo INTEGER NOT NULL DEFAULT 0,
      avg_reaction_ms REAL NOT NULL DEFAULT 0,
      completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES Profile(id)
    )`,
  },
  {
    id: '2026-11-12_mouse_accuracy_attempt_score_idx',
    sql: `CREATE INDEX IF NOT EXISTS MouseAccuracyAttempt_score_accuracy_hits_idx
      ON MouseAccuracyAttempt(score, accuracy, hits)`,
  },
  {
    id: '2026-11-12_mouse_accuracy_attempt_student_idx',
    sql: `CREATE INDEX IF NOT EXISTS MouseAccuracyAttempt_student_id_completed_at_idx
      ON MouseAccuracyAttempt(student_id, completed_at)`,
  },
  {
    id: '2026-11-12_mouse_accuracy_avg_reaction_ms',
    sql: `ALTER TABLE MouseAccuracyAttempt ADD COLUMN avg_reaction_ms REAL NOT NULL DEFAULT 0`,
  },
  {
    id: '2026-11-12_mouse_accuracy_attempt_score_speed_idx',
    sql: `CREATE INDEX IF NOT EXISTS MouseAccuracyAttempt_score_avg_reaction_ms_accuracy_hits_idx
      ON MouseAccuracyAttempt(score, avg_reaction_ms, accuracy, hits)`,
  },
  {
    id: '2026-11-12_mouse_accuracy_expired',
    sql: `ALTER TABLE MouseAccuracyAttempt ADD COLUMN expired INTEGER NOT NULL DEFAULT 0`,
  },
  {
    id: '2026-11-24_profile_password_is_weak',
    sql: `ALTER TABLE Profile ADD COLUMN password_is_weak INTEGER NOT NULL DEFAULT 0`,
  },
  {
    id: '2026-11-24_profile_password_strength_checked_at',
    sql: `ALTER TABLE Profile ADD COLUMN password_strength_checked_at DATETIME`,
  },
  {
    id: '2026-11-24_profile_temp_password_hash',
    sql: `ALTER TABLE Profile ADD COLUMN temp_password_hash TEXT`,
  },
  {
    id: '2026-11-24_profile_temp_password_expires_at',
    sql: `ALTER TABLE Profile ADD COLUMN temp_password_expires_at DATETIME`,
  },
  {
    id: '2026-11-24_create_profile_merge',
    sql: `CREATE TABLE IF NOT EXISTS ProfileMerge (
      id TEXT PRIMARY KEY NOT NULL,
      survivor_id TEXT NOT NULL,
      absorbed_id TEXT NOT NULL,
      keep_username_from TEXT NOT NULL,
      keep_password_from TEXT NOT NULL,
      survivor_username_before TEXT NOT NULL,
      survivor_password_hash_before TEXT NOT NULL,
      absorbed_username_snapshot TEXT NOT NULL,
      absorbed_password_hash_snapshot TEXT NOT NULL,
      absorbed_full_name_snapshot TEXT NOT NULL,
      absorbed_placeholder_username TEXT NOT NULL,
      moved_assessment_ids TEXT NOT NULL DEFAULT '[]',
      moved_certificate_ids TEXT NOT NULL DEFAULT '[]',
      moved_typing_ids TEXT NOT NULL DEFAULT '[]',
      moved_mouse_ids TEXT NOT NULL DEFAULT '[]',
      moved_feedback_ids TEXT NOT NULL DEFAULT '[]',
      moved_release_ids TEXT NOT NULL DEFAULT '[]',
      enrollment_snapshot TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      undone_at DATETIME,
      undone_by TEXT
    )`,
  },
  {
    id: '2026-11-24_profile_merge_survivor_idx',
    sql: `CREATE INDEX IF NOT EXISTS ProfileMerge_survivor_id_idx ON ProfileMerge(survivor_id)`,
  },
  {
    id: '2026-11-24_profile_merge_absorbed_idx',
    sql: `CREATE INDEX IF NOT EXISTS ProfileMerge_absorbed_id_idx ON ProfileMerge(absorbed_id)`,
  },
  {
    id: '2026-11-24_profile_merge_keep_full_name_from',
    sql: `ALTER TABLE ProfileMerge ADD COLUMN keep_full_name_from TEXT NOT NULL DEFAULT 'survivor'`,
  },
  {
    id: '2026-11-24_profile_merge_keep_email_from',
    sql: `ALTER TABLE ProfileMerge ADD COLUMN keep_email_from TEXT NOT NULL DEFAULT 'survivor'`,
  },
  {
    id: '2026-11-24_profile_merge_keep_phone_from',
    sql: `ALTER TABLE ProfileMerge ADD COLUMN keep_phone_from TEXT NOT NULL DEFAULT 'survivor'`,
  },
  {
    id: '2026-11-24_profile_merge_survivor_full_name_before',
    sql: `ALTER TABLE ProfileMerge ADD COLUMN survivor_full_name_before TEXT NOT NULL DEFAULT ''`,
  },
  {
    id: '2026-11-24_profile_merge_survivor_email_before',
    sql: `ALTER TABLE ProfileMerge ADD COLUMN survivor_email_before TEXT NOT NULL DEFAULT ''`,
  },
  {
    id: '2026-11-24_profile_merge_survivor_phone_before',
    sql: `ALTER TABLE ProfileMerge ADD COLUMN survivor_phone_before TEXT NOT NULL DEFAULT ''`,
  },
  {
    id: '2026-11-24_profile_merge_absorbed_email_snapshot',
    sql: `ALTER TABLE ProfileMerge ADD COLUMN absorbed_email_snapshot TEXT NOT NULL DEFAULT ''`,
  },
  {
    id: '2026-11-24_profile_merge_absorbed_phone_snapshot',
    sql: `ALTER TABLE ProfileMerge ADD COLUMN absorbed_phone_snapshot TEXT NOT NULL DEFAULT ''`,
  },
]
