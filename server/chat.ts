import {
  describeClasses,
  describeWeek,
  normalizeWorkouts,
  poolLines,
  validateWorkouts,
  type Workout,
} from './plan.js'
import { loadMessages, loadWorkouts, saveMessage, saveWorkouts } from './supabase.js'

const TOOLS = [
  {
    name: 'set_workouts',
    description:
      'Replace the weekly training plan. Send every workout that should remain. Classes cannot be changed. Swims must fall inside Palladium free-swim hours. Other sessions must fall inside building hours. Leave 15 minutes to walk between Washington Square and Palladium.',
    input_schema: {
      type: 'object',
      properties: {
        workouts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              day: { type: 'integer', description: '0 Sunday through 6 Saturday' },
              start: { type: 'string', description: 'Time like 2:00 PM or minutes from midnight' },
              end: { type: 'string' },
              place: { type: 'string' },
            },
            required: ['title', 'day', 'start', 'end'],
          },
        },
      },
      required: ['workouts'],
    },
  },
]

function systemPrompt(workouts: Workout[]) {
  return `You help Moustapha move his weekly training around a fixed NYU class schedule. Talk like a coach who is concise and specific. When he asks to change the week, call set_workouts with the full new list. Do not invent classes. Do not put a swim outside Palladium free-swim hours.

Palladium, 140 East 14th Street, fall 2026 through Dec 13:
${poolLines.join('\n')}
Saturday the pool is closed, so swims cannot go on Saturday.
Thanksgiving week: the Palladium pool is closed Nov 25–28.

Classes, repeated every week:
${describeClasses()}

Current training:
${describeWeek(workouts) || 'None yet.'}

Every day 6:00–7:00 AM is Quran revision and review at home. Do not move it. Training starts at 7:00 AM. Anterior and Posterior are 45-minute strength sessions at 404 Fitness, not Palladium. 404 is open Mon–Thu 6:00 AM–10:30 PM, Fri 6:00 AM–8:00 PM, Sat–Sun 8:00 AM–8:00 PM. Work shifts do not cancel a workout; move it to a free hour instead. Weekend rides start at 8:00 AM when 404 is open, or outside when it is closed. Sunday posterior is an evening lift. Bikes and runs are both in miles. Block bikes at the Ironman goal, 112 miles in 4:55 (about 22.8 mph). Block runs at about 9:00 per mile, including the brick run off the bike: 5 miles on Monday and 3 miles on Saturday. A 2k swim is about 40 minutes. The Ironman swim is 2.4 miles. 404 is a 10 minute walk from Washington Square and 15 minutes from the Palladium pool. Flatiron is 20 minutes away.`
}

interface AnthropicBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: { workouts?: unknown }
}

export async function replyTo(message: string): Promise<{ reply: string; workouts: Workout[] }> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('The Anthropic API key is not configured on the server.')

  const history = await loadMessages()
  let workouts = await loadWorkouts()
  const messages: unknown[] = [
    ...history.map((item) => ({ role: item.role, content: item.content })),
    { role: 'user', content: message },
  ]
  await saveMessage('user', message)

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'
  let reply = ''

  for (let turn = 0; turn < 4; turn += 1) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: systemPrompt(workouts),
        tools: TOOLS,
        messages,
      }),
    })
    const data = (await response.json()) as {
      error?: { message?: string }
      content?: AnthropicBlock[]
    }
    if (!response.ok) {
      throw new Error(data.error?.message || 'The chat model did not answer.')
    }
    const content = data.content ?? []
    const tools = content.filter((block) => block.type === 'tool_use')
    if (!tools.length) {
      reply = content
        .filter((block) => block.type === 'text' && block.text)
        .map((block) => block.text)
        .join('\n')
        .trim()
      break
    }

    messages.push({ role: 'assistant', content })
    const results = []
    for (const tool of tools) {
      try {
        const next = normalizeWorkouts(tool.input?.workouts)
        const errors = validateWorkouts(next)
        if (errors.length) {
          results.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            is_error: true,
            content: errors.join('\n'),
          })
        } else {
          await saveWorkouts(next)
          workouts = next
          results.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: `Saved.\n${describeWeek(next)}`,
          })
        }
      } catch (error) {
        results.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          is_error: true,
          content: error instanceof Error ? error.message : 'Could not read that plan.',
        })
      }
    }
    messages.push({ role: 'user', content: results })
  }

  if (!reply) reply = 'I updated the week.'
  await saveMessage('assistant', reply)
  return { reply, workouts }
}
