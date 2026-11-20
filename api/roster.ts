import { handleApi } from '../server/handlers.js'

export default async function handler(
  req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
    const result = await handleApi(req.method ?? 'POST', req.url ?? '/api/roster', req.headers, raw)
    res.status(result.status).json(result.body)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Something went wrong.' })
  }
}
