import { handleApi } from '../server/handlers'

export default async function handler(
  req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  const result = await handleApi(req.method ?? 'GET', req.url ?? '/api/schedule', req.headers, '')
  res.status(result.status).json(result.body)
}
