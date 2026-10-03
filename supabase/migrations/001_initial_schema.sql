-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Helper function to check if user is admin (security definer to prevent infinite recursion in RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin_user BOOLEAN;
BEGIN
    SELECT role = 'ADMIN' INTO is_admin_user FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(is_admin_user, FALSE);
END;
$$;

-- 1. profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('ADMIN', 'STUDENT')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'BLOCKED')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_profiles_username_lower ON public.profiles(lower(username));

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. dimensions
CREATE TABLE public.dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    weight INTEGER DEFAULT 1 CHECK (weight BETWEEN 1 AND 3),
    display_order INTEGER DEFAULT 0,
    target_percentage NUMERIC(5,2) DEFAULT 5.00,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_dimensions_updated_at
    BEFORE UPDATE ON public.dimensions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. questions
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('PROVA', 'SIMULADO')),
    dimension_id UUID NOT NULL REFERENCES public.dimensions(id) ON DELETE RESTRICT,
    question_text TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. question_options
CREATE TABLE public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_key CHAR(1) NOT NULL CHECK (option_key IN ('A','B','C','D','E')),
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    explanation TEXT NOT NULL,
    UNIQUE (question_id, option_key)
);

-- 5. assessments
CREATE TABLE public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('PROVA', 'SIMULADO')),
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    total_questions INTEGER NOT NULL,
    score NUMERIC(5,2),
    correct_count INTEGER,
    wrong_count INTEGER,
    passed BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. assessment_questions
CREATE TABLE public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
    question_order INTEGER NOT NULL,
    dimension_id UUID REFERENCES public.dimensions(id) ON DELETE SET NULL,
    dimension_name_snapshot TEXT NOT NULL,
    question_text_snapshot TEXT NOT NULL,
    option_a_text TEXT NOT NULL,
    option_b_text TEXT NOT NULL,
    option_c_text TEXT NOT NULL,
    option_d_text TEXT NOT NULL,
    option_e_text TEXT NOT NULL,
    option_a_explanation TEXT NOT NULL,
    option_b_explanation TEXT NOT NULL,
    option_c_explanation TEXT NOT NULL,
    option_d_explanation TEXT NOT NULL,
    option_e_explanation TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL,
    UNIQUE (assessment_id, question_order)
);

-- API MUST strip correct_option before sending to client for IN_PROGRESS PROVA assessments.
COMMENT ON COLUMN public.assessment_questions.correct_option IS 'API MUST strip this field before sending to client for IN_PROGRESS PROVA assessments.';

-- 7. assessment_answers
CREATE TABLE public.assessment_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    assessment_question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    selected_option CHAR(1) CHECK (selected_option IN ('A','B','C','D','E')),
    is_correct BOOLEAN,
    answered_at TIMESTAMPTZ,
    flagged_for_review BOOLEAN DEFAULT false,
    UNIQUE (assessment_id, assessment_question_id)
);

-- 8. attempt_releases
CREATE TABLE public.attempt_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    released_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reason TEXT,
    used BOOLEAN DEFAULT false,
    cancelled BOOLEAN DEFAULT false,
    assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. certificates
CREATE TABLE public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE RESTRICT,
    certificate_code TEXT UNIQUE NOT NULL,
    student_name_snapshot TEXT NOT NULL,
    course_name_snapshot TEXT NOT NULL,
    completion_date DATE NOT NULL,
    score_snapshot NUMERIC(5,2),
    template_version INTEGER DEFAULT 1,
    pdf_path TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. system_settings
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 11. audit_logs
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICIES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone authenticated can read active dimensions" ON public.dimensions FOR SELECT USING (auth.role() = 'authenticated' AND active = true);
CREATE POLICY "Admins can read all dimensions" ON public.dimensions FOR SELECT USING (is_admin());
CREATE POLICY "Admins can insert dimensions" ON public.dimensions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update dimensions" ON public.dimensions FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete dimensions" ON public.dimensions FOR DELETE USING (is_admin());

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can CRUD questions" ON public.questions FOR ALL USING (is_admin());

ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can CRUD question_options" ON public.question_options FOR ALL USING (is_admin());

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can read own assessments" ON public.assessments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admins can read all assessments" ON public.assessments FOR SELECT USING (is_admin());

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can read own assessment's questions" ON public.assessment_questions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_questions.assessment_id AND a.student_id = auth.uid())
);
CREATE POLICY "Admins can read all assessment_questions" ON public.assessment_questions FOR SELECT USING (is_admin());

ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can read own assessment answers" ON public.assessment_answers FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_answers.assessment_id AND a.student_id = auth.uid())
);
CREATE POLICY "Students can update own assessment answers" ON public.assessment_answers FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_answers.assessment_id AND a.student_id = auth.uid())
);
CREATE POLICY "Students can insert own assessment answers" ON public.assessment_answers FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_answers.assessment_id AND a.student_id = auth.uid())
);
CREATE POLICY "Admins can read all assessment answers" ON public.assessment_answers FOR SELECT USING (is_admin());

ALTER TABLE public.attempt_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can read own attempt releases" ON public.attempt_releases FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admins can CRUD attempt releases" ON public.attempt_releases FOR ALL USING (is_admin());

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can read own certificates" ON public.certificates FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admins can read all certificates" ON public.certificates FOR SELECT USING (is_admin());

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can CRUD system settings" ON public.system_settings FOR ALL USING (is_admin());

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs FOR SELECT USING (is_admin());

-- Seed system_settings
INSERT INTO public.system_settings (key, value) VALUES
('assessment.prova.question_count', '40'::jsonb),
('assessment.prova.time_limit_minutes', '120'::jsonb),
('assessment.prova.passing_score', '70'::jsonb),
('assessment.prova.retry_interval_hours', '24'::jsonb),
('assessment.prova.max_attempts', '0'::jsonb),
('assessment.prova.allow_retry', 'true'::jsonb),
('assessment.prova.avoid_repeat_questions', 'true'::jsonb),
('assessment.simulado.question_count', '40'::jsonb),
('assessment.simulado.time_limit_minutes', '120'::jsonb),
('assessment.simulado.passing_score', '70'::jsonb),
('assessment.simulado.allow_retry', 'true'::jsonb),
('assessment.simulado.avoid_repeat_questions', 'false'::jsonb),
('platform.name', '"Plataforma de Avaliação"'::jsonb),
('platform.course_name', '"Informática para Iniciantes"'::jsonb),
('platform.institution', '"Núcleo Assistencial Anita Briza"'::jsonb),
('platform.welcome_message', '"Bem-vindo à Plataforma de Avaliação do curso de Informática para Iniciantes"'::jsonb),
('assessment.prova.instructions', '"Esta avaliação possui {question_count} questões. Cada questão possui 5 alternativas e apenas uma está correta. Responda com atenção. Você poderá marcar questões para revisar antes de finalizar."'::jsonb),
('assessment.simulado.instructions', '"Este simulado possui {question_count} questões. Após finalizar, você poderá revisar suas respostas e ver as explicações."'::jsonb),
('certificate.template_text', '"Certificamos que {student_name} concluiu com êxito o curso de {course_name}, realizado pelo {institution}, obtendo aprovação na avaliação final."'::jsonb),
('assessment.prova.approved_message', '"Parabéns! Você foi aprovado(a)! Agora você pode emitir seu certificado."'::jsonb),
('assessment.prova.failed_message', '"Infelizmente você não atingiu a nota mínima. Você poderá realizar uma nova tentativa a partir de {retry_date}."'::jsonb);
