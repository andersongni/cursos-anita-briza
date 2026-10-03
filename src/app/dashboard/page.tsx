import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { PlayCircle, FileText, History, Award } from 'lucide-react'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const profile = await prisma.profile.findUnique({
    where: { id: session.userId },
    select: { id: true, full_name: true, role: true, status: true },
  })

  if (!profile) redirect('/login')
  if (profile.status === 'PENDING') redirect('/aguardando-aprovacao')
  if (profile.status === 'BLOCKED') redirect('/login?blocked=true')
  if (profile.role === 'ADMIN') redirect('/admin/dashboard')

  // Quick stats
  const [totalAssessments, bestScore] = await Promise.all([
    prisma.assessment.count({ where: { student_id: session.userId, status: 'COMPLETED' } }),
    prisma.assessment.findFirst({
      where: { student_id: session.userId, status: 'COMPLETED', type: 'PROVA' },
      orderBy: { score: 'desc' },
      select: { score: true },
    }),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary">
          Bem-vindo(a), {profile.full_name.split(' ')[0]}!
        </h1>
        <p className="text-gray-600 mt-2">
          Selecione uma das opções abaixo para continuar seus estudos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-t-4 border-t-accent hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 p-3 rounded-full">
                  <PlayCircle className="w-8 h-8 text-accent" />
                </div>
                <div className="ml-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Simulado</h2>
                  <p className="text-gray-600 mb-6">
                    Pratique com questões simuladas. Após finalizar, você poderá revisar suas respostas e ver as explicações.
                  </p>
                  <Link href="/student/simulado">
                    <Button variant="outline" className="w-full sm:w-auto text-accent border-accent hover:bg-accent hover:text-white">
                      Iniciar Simulado
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-t-4 border-t-primary hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-red-100 p-3 rounded-full">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div className="ml-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Prova Oficial</h2>
                  <p className="text-gray-600 mb-6">
                    Realize a avaliação oficial do curso. Você precisa de 70% de acertos para ser aprovado.
                  </p>
                  <Link href="/student/prova">
                    <Button variant="primary" className="w-full sm:w-auto">
                      Iniciar Prova
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-secondary mb-4 border-b pb-2">Seu Progresso</h3>

              <div className="space-y-4">
                <Link href="/student/historico" className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                  <History className="w-5 h-5 text-gray-400 group-hover:text-accent mr-3" />
                  <span className="text-gray-700 font-medium group-hover:text-secondary">Meu Histórico</span>
                </Link>

                <Link href="/student/certificados" className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                  <Award className="w-5 h-5 text-gray-400 group-hover:text-primary mr-3" />
                  <span className="text-gray-700 font-medium group-hover:text-secondary">Meus Certificados</span>
                </Link>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <span className="block text-sm text-gray-500">Tentativas</span>
                    <span className="block text-xl font-bold text-secondary">{totalAssessments}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <span className="block text-sm text-gray-500">Melhor Nota</span>
                    <span className="block text-xl font-bold text-secondary">
                      {bestScore?.score != null ? `${bestScore.score.toFixed(0)}%` : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
