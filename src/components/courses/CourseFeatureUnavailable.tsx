import Link from 'next/link'
import Button from '@/components/ui/Button'
import Card, { CardContent } from '@/components/ui/Card'

type Props = {
  featureLabel: string
  courseName?: string | null
  /** Destino do botão principal (ex.: painel ou hub de exercícios). */
  backHref?: string
  backLabel?: string
}

/** Estado vazio quando a feature não existe no curso ativo. */
export default function CourseFeatureUnavailable({
  featureLabel,
  courseName,
  backHref = '/admin/dashboard',
  backLabel = 'Voltar ao painel',
}: Props) {
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-3xl font-bold text-secondary">{featureLabel}</h1>
      <Card>
        <CardContent className="p-6 space-y-3">
          <p className="text-slate-700">
            {featureLabel} não está disponível
            {courseName ? (
              <>
                {' '}
                para o curso <strong>{courseName}</strong>
              </>
            ) : (
              ' neste curso'
            )}
            . Troque o curso no topo da página para administrar um curso que ofereça este
            recurso.
          </p>
          <Link href={backHref}>
            <Button variant="outline">{backLabel}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
