const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\\\Users\\\\ander\\\\.gemini\\\\antigravity\\\\scratch\\\\avaliacao-anita-briza';

function write(p, content) {
    const fullPath = path.join(rootDir, p);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    console.log('Created:', p);
}

// 5. assessments/create
write('src/app/api/assessments/create/route.ts', `import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

function calculateDistribution(
  dimensions: { id: string; name: string; weight: number; target_percentage: number }[],
  totalQuestions: number
): { dimension_id: string; count: number }[] {
  const totalPercentage = dimensions.reduce((sum, d) => sum + d.target_percentage, 0)
  const normalized = dimensions.map(d => ({
    ...d,
    normalizedPct: (d.target_percentage / totalPercentage) * 100
  }))
  
  const raw = normalized.map(d => ({
    ...d,
    rawCount: (d.normalizedPct / 100) * totalQuestions,
    count: Math.floor((d.normalizedPct / 100) * totalQuestions)
  }))
  
  raw.forEach(d => { if (d.count === 0) d.count = 1 })
  
  let currentTotal = raw.reduce((sum, d) => sum + d.count, 0)
  if (currentTotal < totalQuestions) {
    const remainders = raw.map(d => ({
      ...d,
      remainder: d.rawCount - d.count
    })).sort((a, b) => b.remainder - a.remainder || b.weight - a.weight)
    
    let i = 0
    while (currentTotal < totalQuestions) {
      remainders[i % remainders.length].count++
      currentTotal++
      i++
    }
  } else if (currentTotal > totalQuestions) {
    const sorted = [...raw].sort((a, b) => a.weight - b.weight)
    let i = 0
    while (currentTotal > totalQuestions) {
      if (sorted[i % sorted.length].count > 1) {
        sorted[i % sorted.length].count--
        currentTotal--
      }
      i++
    }
  }
  
  return raw.map(d => ({ dimension_id: d.id, count: d.count }))
}

export async function POST(request: Request) {
  try {
    const { user, profile } = await verifyAuth()
    if (profile.status !== 'APPROVED') {
      return NextResponse.json({ error: 'User is not approved' }, { status: 403 })
    }

    const { type } = await request.json()
    if (type !== 'PROVA' && type !== 'SIMULADO') {
      return NextResponse.json({ error: 'Invalid assessment type' }, { status: 400 })
    }

    const supabaseAdmin = await createServiceClient()
    
    // Check in-progress
    const { data: inProgress } = await supabaseAdmin
      .from('assessments')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('status', 'IN_PROGRESS')
      .single()
      
    if (inProgress) {
      return NextResponse.json({ error: \`You already have an in-progress \${type}\` }, { status: 400 })
    }

    let attemptNumber = 1

    if (type === 'PROVA') {
      const { data: lastProva } = await supabaseAdmin
        .from('assessments')
        .select('completed_at, attempt_number')
        .eq('user_id', user.id)
        .eq('type', 'PROVA')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        
      if (lastProva) {
        attemptNumber = (lastProva.attempt_number || 1) + 1
        
        const { data: release } = await supabaseAdmin
          .from('attempt_releases')
          .select('id')
          .eq('student_id', user.id)
          .eq('used', false)
          .single()
          
        if (release) {
          await supabaseAdmin.from('attempt_releases').update({ used: true, used_at: new Date().toISOString() }).eq('id', release.id)
        } else if (lastProva.completed_at) {
          const hoursSinceLast = (new Date().getTime() - new Date(lastProva.completed_at).getTime()) / (1000 * 60 * 60)
          if (hoursSinceLast < 24) {
            return NextResponse.json({ error: 'You must wait 24 hours before taking another PROVA' }, { status: 403 })
          }
        }
      }
    }

    const { data: settings } = await supabaseAdmin.from('system_settings').select('key, value')
    const configObj = (settings || []).reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {})
    const totalQuestions = parseInt(configObj.assessment_total_questions || '40', 10)
    const durationMins = parseInt(configObj.assessment_duration_minutes || '120', 10)
    const passingScore = parseInt(configObj.passing_score || '70', 10)

    const { data: dimensions } = await supabaseAdmin.from('dimensions').select('id, name, weight, target_percentage').eq('active', true)
    if (!dimensions || dimensions.length === 0) {
      return NextResponse.json({ error: 'No active dimensions found' }, { status: 500 })
    }

    const distribution = calculateDistribution(dimensions, totalQuestions)
    let selectedQuestions: any[] = []

    for (const dist of distribution) {
      const { data: qs } = await supabaseAdmin
        .from('questions')
        .select('*, options(*)')
        .eq('dimension_id', dist.dimension_id)
        .eq('type', type)
        .eq('active', true)
        
      if (!qs) continue
      
      const shuffled = qs.sort(() => 0.5 - Math.random())
      selectedQuestions.push(...shuffled.slice(0, dist.count))
    }
    
    selectedQuestions = selectedQuestions.sort(() => 0.5 - Math.random())
    if (selectedQuestions.length === 0) {
      return NextResponse.json({ error: 'Not enough questions available' }, { status: 500 })
    }

    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMins)

    const { data: assessment, error: assessmentError } = await supabaseAdmin
      .from('assessments')
      .insert({
        user_id: user.id,
        type,
        status: 'IN_PROGRESS',
        attempt_number: type === 'PROVA' ? attemptNumber : null,
        deadline_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (assessmentError) throw assessmentError

    const aqInserts = selectedQuestions.map((q, idx) => ({
      assessment_id: assessment.id,
      question_id: q.id,
      order_index: idx,
      snapshot: q
    }))

    const { data: aqs, error: aqError } = await supabaseAdmin
      .from('assessment_questions')
      .insert(aqInserts)
      .select()

    if (aqError) throw aqError

    const ansInserts = aqs.map((aq: any) => ({
      assessment_id: assessment.id,
      assessment_question_id: aq.id
    }))

    await supabaseAdmin.from('assessment_answers').insert(ansInserts)

    return NextResponse.json({ assessment_id: assessment.id, type, status: 'IN_PROGRESS', deadline_at: assessment.deadline_at })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// 6. assessments/answer
write('src/app/api/assessments/answer/route.ts', `import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { user } = await verifyAuth()
    const { assessment_id, assessment_question_id, selected_option, flagged_for_review } = await request.json()
    const supabase = await createClient()

    const { data: assessment } = await supabase
      .from('assessments')
      .select('status, deadline_at, user_id')
      .eq('id', assessment_id)
      .single()

    if (!assessment || assessment.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
    }
    if (assessment.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Assessment is not in progress' }, { status: 400 })
    }
    if (new Date(assessment.deadline_at) < new Date()) {
      return NextResponse.json({ error: 'Assessment expired' }, { status: 400 })
    }

    const updates: any = {}
    if (selected_option !== undefined) updates.selected_option = selected_option
    if (flagged_for_review !== undefined) updates.flagged_for_review = flagged_for_review
    updates.answered_at = new Date().toISOString()

    const { error } = await supabase
      .from('assessment_answers')
      .update(updates)
      .eq('assessment_id', assessment_id)
      .eq('assessment_question_id', assessment_question_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// 7. assessments/submit
write('src/app/api/assessments/submit/route.ts', `import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { user } = await verifyAuth()
    const { assessment_id } = await request.json()
    const supabaseAdmin = await createServiceClient()

    const { data: assessment } = await supabaseAdmin
      .from('assessments')
      .select('*')
      .eq('id', assessment_id)
      .single()

    if (!assessment || assessment.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
    }
    if (assessment.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Already completed' }, { status: 400 })
    }

    const { data: aqs } = await supabaseAdmin
      .from('assessment_questions')
      .select('id, snapshot')
      .eq('assessment_id', assessment_id)

    const { data: answers } = await supabaseAdmin
      .from('assessment_answers')
      .select('*')
      .eq('assessment_id', assessment_id)

    let correctCount = 0
    let wrongCount = 0

    const answerUpdates = []

    for (const aq of (aqs || [])) {
      const ans = answers?.find(a => a.assessment_question_id === aq.id)
      const correctOpt = aq.snapshot.options.find((o: any) => o.is_correct)
      
      const isCorrect = ans?.selected_option === correctOpt?.key
      if (isCorrect) correctCount++
      else wrongCount++

      if (ans) {
        answerUpdates.push({
          id: ans.id,
          assessment_id: ans.assessment_id,
          assessment_question_id: ans.assessment_question_id,
          is_correct: isCorrect
        })
      }
    }

    for (const update of answerUpdates) {
      await supabaseAdmin.from('assessment_answers').update({ is_correct: update.is_correct }).eq('id', update.id)
    }

    const { data: settings } = await supabaseAdmin.from('system_settings').select('key, value').eq('key', 'passing_score').single()
    const passingScoreConfig = parseInt(settings?.value || '70', 10)
    
    const totalQuestions = (aqs || []).length
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0
    const passed = score >= passingScoreConfig
    
    const durationSeconds = Math.floor((new Date().getTime() - new Date(assessment.created_at).getTime()) / 1000)

    await supabaseAdmin
      .from('assessments')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        score,
        correct_count: correctCount,
        wrong_count: wrongCount,
        passed
      })
      .eq('id', assessment_id)

    if (assessment.type === 'PROVA') {
      return NextResponse.json({ success: true, score, passed, correct_count: correctCount, wrong_count: wrongCount })
    } else {
      return NextResponse.json({ success: true, score, passed, correct_count: correctCount, wrong_count: wrongCount, review_available: true })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// 8. assessments/[id]
write('src/app/api/assessments/[id]/route.ts', `import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, profile } = await verifyAuth()
    const supabase = await createClient()
    const { id } = params

    const { data: assessment, error } = await supabase
      .from('assessments')
      .select('*, assessment_questions(*), assessment_answers(*)')
      .eq('id', id)
      .single()

    if (error || !assessment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (assessment.user_id !== user.id && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (profile.role !== 'ADMIN') {
      if (assessment.type === 'PROVA' && assessment.status === 'IN_PROGRESS') {
        assessment.assessment_questions = assessment.assessment_questions.map((aq: any) => {
          const opts = aq.snapshot.options.map((o: any) => {
            const { is_correct, explanation, ...rest } = o
            return rest
          })
          aq.snapshot.options = opts
          return aq
        })
      }
    }

    return NextResponse.json(assessment)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// 9. assessments/[id]/review
write('src/app/api/assessments/[id]/review/route.ts', `import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await verifyAuth()
    const supabase = await createClient()
    
    const { data: assessment } = await supabase
      .from('assessments')
      .select('*, assessment_questions(*), assessment_answers(*)')
      .eq('id', params.id)
      .single()

    if (!assessment || assessment.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
    }

    if (assessment.type !== 'SIMULADO' || assessment.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Review not available' }, { status: 400 })
    }

    return NextResponse.json(assessment)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// 10. assessments/check-eligibility
write('src/app/api/assessments/check-eligibility/route.ts', `import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { user } = await verifyAuth()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type !== 'PROVA') {
      return NextResponse.json({ eligible: true })
    }

    const supabaseAdmin = await createServiceClient()
    
    const { data: release } = await supabaseAdmin
      .from('attempt_releases')
      .select('id')
      .eq('student_id', user.id)
      .eq('used', false)
      .single()

    if (release) {
      return NextResponse.json({ eligible: true })
    }

    const { data: lastProva } = await supabaseAdmin
      .from('assessments')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('type', 'PROVA')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!lastProva || !lastProva.completed_at) {
      return NextResponse.json({ eligible: true })
    }

    const nextAvailable = new Date(new Date(lastProva.completed_at).getTime() + 24 * 60 * 60 * 1000)
    if (new Date() < nextAvailable) {
      return NextResponse.json({ eligible: false, reason: '24 hour interval', next_available_at: nextAvailable.toISOString() })
    }

    return NextResponse.json({ eligible: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// Admin Students
write('src/app/api/admin/students/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    
    const supabaseAdmin = await createServiceClient()
    let query = supabaseAdmin.from('profiles').select('*', { count: 'exact' }).eq('role', 'STUDENT')
    
    if (status) query = query.eq('status', status)
    if (search) query = query.or(\`full_name.ilike.%\${search}%,username.ilike.%\${search}%\`)
    
    const { data, count, error } = await query.range((page - 1) * limit, page * limit - 1)
    if (error) throw error
    
    return NextResponse.json({ data, count, page, limit })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await verifyAdmin()
    const { student_id, status } = await request.json()
    const supabaseAdmin = await createServiceClient()
    
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ status })
      .eq('id', student_id)
      .select()
      .single()
      
    if (error) throw error
    
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'UPDATE_STUDENT_STATUS',
      resource: 'profiles',
      resource_id: student_id,
      details: { new_status: status }
    })
    
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

write('src/app/api/admin/students/[id]/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await verifyAdmin()
    const supabaseAdmin = await createServiceClient()
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', params.id).single()
    const { data: assessments } = await supabaseAdmin.from('assessments').select('*').eq('user_id', params.id).order('created_at', { ascending: false })
    
    return NextResponse.json({ ...profile, assessments })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

write('src/app/api/admin/students/[id]/release-attempt/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await verifyAdmin()
    const { reason } = await request.json()
    const supabaseAdmin = await createServiceClient()
    
    const { error } = await supabaseAdmin.from('attempt_releases').insert({
      student_id: params.id,
      released_by: user.id,
      reason
    })
    if (error) throw error
    
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'RELEASE_ATTEMPT',
      resource: 'attempt_releases',
      details: { student_id: params.id, reason }
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await verifyAdmin()
    const supabaseAdmin = await createServiceClient()
    
    await supabaseAdmin.from('attempt_releases').update({ used: true }).eq('student_id', params.id).eq('used', false)
    
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'CANCEL_ATTEMPT_RELEASE',
      resource: 'attempt_releases',
      details: { student_id: params.id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// Admin Questions
write('src/app/api/admin/questions/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const dimension_id = searchParams.get('dimension_id')
    const active = searchParams.get('active')
    const search = searchParams.get('search')
    
    const supabaseAdmin = await createServiceClient()
    let query = supabaseAdmin.from('questions').select('*, dimensions(name)')
    
    if (type) query = query.eq('type', type)
    if (dimension_id) query = query.eq('dimension_id', dimension_id)
    if (active !== null) query = query.eq('active', active === 'true')
    if (search) query = query.ilike('question_text', \`%\${search}%\`)
    
    const { data } = await query
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await verifyAdmin()
    const { type, dimension_id, question_text, options, active } = await request.json()
    
    if (!options || options.length !== 5) {
      return NextResponse.json({ error: 'Exactly 5 options required' }, { status: 400 })
    }
    const correctCount = options.filter((o: any) => o.is_correct).length
    if (correctCount !== 1) {
      return NextResponse.json({ error: 'Exactly 1 correct option required' }, { status: 400 })
    }
    
    const supabaseAdmin = await createServiceClient()
    
    const { data: q, error: qError } = await supabaseAdmin
      .from('questions')
      .insert({ type, dimension_id, question_text, active: active ?? true, created_by: user.id })
      .select()
      .single()
      
    if (qError) throw qError
    
    const optionsToInsert = options.map((o: any) => ({ ...o, question_id: q.id }))
    await supabaseAdmin.from('options').insert(optionsToInsert)
    
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id, action: 'CREATE_QUESTION', resource: 'questions', resource_id: q.id
    })
    
    return NextResponse.json(q)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

write('src/app/api/admin/questions/[id]/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await verifyAdmin()
    const supabaseAdmin = await createServiceClient()
    const { data } = await supabaseAdmin.from('questions').select('*, options(*)').eq('id', params.id).single()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await verifyAdmin()
    const body = await request.json()
    const supabaseAdmin = await createServiceClient()
    
    await supabaseAdmin.from('questions').update({
      question_text: body.question_text,
      type: body.type,
      dimension_id: body.dimension_id,
      active: body.active
    }).eq('id', params.id)
    
    if (body.options) {
      await supabaseAdmin.from('options').delete().eq('question_id', params.id)
      const optionsToInsert = body.options.map((o: any) => ({ ...o, question_id: params.id }))
      await supabaseAdmin.from('options').insert(optionsToInsert)
    }
    
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id, action: 'UPDATE_QUESTION', resource: 'questions', resource_id: params.id
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await verifyAdmin()
    const supabaseAdmin = await createServiceClient()
    
    const { count } = await supabaseAdmin.from('assessment_questions').select('id', { count: 'exact', head: true }).eq('question_id', params.id)
    
    if (count && count > 0) {
      await supabaseAdmin.from('questions').update({ active: false }).eq('id', params.id)
    } else {
      await supabaseAdmin.from('questions').delete().eq('id', params.id)
    }
    
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id, action: 'DELETE_QUESTION', resource: 'questions', resource_id: params.id
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// Dimensions
write('src/app/api/admin/dimensions/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await verifyAdmin()
    const supabaseAdmin = await createServiceClient()
    const { data } = await supabaseAdmin.from('dimensions').select('*').order('name')
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await request.json()
    const supabaseAdmin = await createServiceClient()
    const { data } = await supabaseAdmin.from('dimensions').insert(body).select().single()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await request.json()
    const supabaseAdmin = await createServiceClient()
    const { data } = await supabaseAdmin.from('dimensions').update(body).eq('id', body.id).select().single()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

write('src/app/api/admin/dimensions/merge/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { user } = await verifyAdmin()
    const { source_ids, target_name, target_description } = await request.json()
    const supabaseAdmin = await createServiceClient()
    
    const { data: existingTarget } = await supabaseAdmin.from('dimensions').select('id').eq('name', target_name).single()
    
    let targetId = existingTarget?.id
    if (!targetId) {
      const { data: newDim } = await supabaseAdmin.from('dimensions').insert({ name: target_name, description: target_description, target_percentage: 0, weight: 1 }).select().single()
      targetId = newDim?.id
    }
    
    if (targetId) {
      await supabaseAdmin.from('questions').update({ dimension_id: targetId }).in('dimension_id', source_ids)
      await supabaseAdmin.from('dimensions').update({ active: false }).in('id', source_ids)
    }
    
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id, action: 'MERGE_DIMENSIONS', resource: 'dimensions', details: { source_ids, targetId }
    })
    
    return NextResponse.json({ success: true, target_id: targetId })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// Settings
write('src/app/api/admin/settings/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await verifyAdmin()
    const supabaseAdmin = await createServiceClient()
    const { data } = await supabaseAdmin.from('system_settings').select('*')
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await verifyAdmin()
    const { key, value } = await request.json()
    const supabaseAdmin = await createServiceClient()
    
    await supabaseAdmin.from('system_settings').upsert({ key, value })
    
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id, action: 'UPDATE_SETTING', resource: 'system_settings', details: { key, value }
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// Dashboard
write('src/app/api/admin/dashboard/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await verifyAdmin()
    const supabaseAdmin = await createServiceClient()
    
    const { count: studentsCount } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'STUDENT')
    const { count: assessmentsCount } = await supabaseAdmin.from('assessments').select('*', { count: 'exact', head: true })
    const { count: questionsCount } = await supabaseAdmin.from('questions').select('*', { count: 'exact', head: true }).eq('active', true)
    
    return NextResponse.json({
      students: studentsCount,
      assessments: assessmentsCount,
      questions: questionsCount
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// Certificates
write('src/app/api/certificates/generate/route.ts', `import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { user } = await verifyAuth()
    const { assessment_id } = await request.json()
    const supabaseAdmin = await createServiceClient()
    
    const { data: assessment } = await supabaseAdmin.from('assessments').select('*').eq('id', assessment_id).single()
    if (!assessment || assessment.user_id !== user.id || assessment.type !== 'PROVA' || !assessment.passed) {
      return NextResponse.json({ error: 'Not eligible' }, { status: 400 })
    }
    
    const { data: existing } = await supabaseAdmin.from('certificates').select('*').eq('assessment_id', assessment_id).single()
    if (existing) return NextResponse.json(existing)
    
    const code = crypto.randomBytes(8).toString('hex').toUpperCase()
    
    const { data: cert, error } = await supabaseAdmin.from('certificates').insert({
      student_id: user.id,
      assessment_id: assessment.id,
      certificate_code: code,
      issued_at: new Date().toISOString()
    }).select().single()
    
    if (error) throw error
    return NextResponse.json(cert)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

write('src/app/api/certificates/[id]/route.ts', `import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('certificates').select('*, profiles(full_name), assessments(score, completed_at)').eq('id', params.id).single()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);

// Audit Logs
write('src/app/api/admin/audit-logs/route.ts', `import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    await verifyAdmin()
    const supabaseAdmin = await createServiceClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const { data, count } = await supabaseAdmin.from('audit_logs').select('*, profiles(full_name, username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
      
    return NextResponse.json({ data, count, page, limit })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}`);
