interface ProcessEnv {
  [key: string]: string | undefined
}

declare const process: { env: ProcessEnv; cwd(): string }

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function writeFileSync(path: string, data: string): void
  export function existsSync(path: string): boolean
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
}

declare module 'node:path' {
  export function join(...parts: string[]): string
}

declare module 'node:zlib' {
  export function inflateSync(data: Uint8Array): Uint8Array
}

declare const Buffer: {
  from(data: string, encoding: 'base64'): Uint8Array
}

interface RequestInit {
  method?: string
  headers?: Record<string, string>
  body?: string
}

interface Response {
  ok: boolean
  status: number
  statusText: string
  text(): Promise<string>
  json(): Promise<unknown>
}

declare function fetch(input: string, init?: RequestInit): Promise<Response>

declare class URL {
  constructor(input: string)
  hostname: string
}
