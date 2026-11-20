import { handleApi } from '../server/handlers.js'

export default async function handler(
  req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  try {
    const result = await handleApi(req.method ?? 'GET', req.url ?? '/api/schedule', req.headers, '')
    res.status(result.status).json(result.body)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Something went wrong.' })
  }
}
