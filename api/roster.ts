import { handleApi } from '../server/handlers'

export default async function handler(
  req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
  const result = await handleApi(req.method ?? 'POST', req.url ?? '/api/roster', req.headers, raw)
  res.status(result.status).json(result.body)
}
