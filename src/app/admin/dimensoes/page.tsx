import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

function toQueryString(params: SearchParams): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v)
    } else {
      qs.set(key, value)
    }
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export default async function AdminDimensoesRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  redirect(`/admin/temas${toQueryString(params)}`)
}
