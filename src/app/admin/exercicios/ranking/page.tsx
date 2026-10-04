import { redirect } from 'next/navigation'

/** Rota antiga — redireciona para a nova estrutura. */
export default function AdminExerciciosRankingRedirectPage() {
  redirect('/admin/exercicios/digitacao/ranking')
}
