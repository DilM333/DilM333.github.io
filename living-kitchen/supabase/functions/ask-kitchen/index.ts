// Supabase Edge Function: ask-kitchen
//
// Server-side half of Ask Kitchen (see the architecture report). Receives a
// deterministically-built, already-minimized kitchen context from the
// client (lib/askKitchenContext.ts) plus the user's message and a tiny
// one-turn conversation anchor, calls the model provider, and returns a
// structured response the client validates again before rendering anything.
//
// Auth is handled by @supabase/server's withSupabase({ auth: 'user' }) —
// see supabase/functions/send-household-invite-email/index.ts for the
// established pattern this mirrors. Unlike that function, this one does NOT
// need ctx.supabaseAdmin/database access for its own correctness: the
// context it receives was already computed by the browser from the same
// Zustand state every other screen trusts, and this function performs no
// database mutation — it's read-and-suggest, not an irreversible action.
// Auth here exists to know *who* is asking (for future rate limiting/abuse
// protection — see the TODO below), not to re-derive kitchen truth from
// Supabase tables.
//
// Provider: OpenAI, via the Responses API (OpenAI's current recommended
// approach for new applications, superseding Chat Completions) with native
// Structured Outputs (a JSON Schema the model is constrained to, not "please
// reply in JSON" prose). Called with a plain `fetch` — no SDK dependency,
// matching how send-household-invite-email calls Resend directly.
//
// Secret required (set via `supabase secrets set`, never a VITE_ var):
//   OPENAI_API_KEY
// Optional secrets to change provider config without a redeploy:
//   OPENAI_MODEL       — defaults to DEFAULT_MODEL below if unset.

import { withSupabase } from 'npm:@supabase/server@^1'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

interface AskKitchenRequestBody {
  message: string
  context: {
    version: number
    candidateRecipes: unknown[]
    [key: string]: unknown
  }
  anchor?: { lastUserMessage: string; lastRecommendedRecipeIds: string[] }
}

/**
 * The absolute minimum shape check needed to safely proceed — not a full
 * schema validator. The real, detailed context shape is owned and validated
 * on the client (lib/askKitchenContext.ts builds it; lib/askKitchen.ts
 * validates the *response*). This just guards against a missing/malformed
 * body before we'd otherwise do anything with it.
 */
function parseRequestBody(body: unknown): AskKitchenRequestBody | null {
  if (typeof body !== 'object' || body === null) return null
  const obj = body as Record<string, unknown>
  if (typeof obj.message !== 'string' || obj.message.trim().length === 0) return null
  if (typeof obj.context !== 'object' || obj.context === null) return null
  const context = obj.context as Record<string, unknown>
  if (!Array.isArray(context.candidateRecipes)) return null
  return { message: obj.message, context: context as AskKitchenRequestBody['context'], anchor: obj.anchor as AskKitchenRequestBody['anchor'] }
}

// ---------------------------------------------------------------------------
// Provider config — the only section that should need to change to swap
// model/provider later. OPENAI_MODEL lets the model be changed via
// `supabase secrets set` alone, with no code change or redeploy.
// ---------------------------------------------------------------------------

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = 'gpt-5-mini'
const MAX_OUTPUT_TOKENS = 600
const REQUEST_TIMEOUT_MS = 20_000

/**
 * Ground rules for the model. Every claim about the kitchen it's allowed to
 * make must come from the context it's given — nothing here asks it to
 * calculate, remember, or guess anything Euko already computed
 * deterministically. Deliberately never mentions JSON/schema/internal
 * mechanics — those are enforced structurally (see RESPONSE_SCHEMA), not by
 * asking nicely in prose.
 */
const SYSTEM_INSTRUCTIONS = `You are Ask Kitchen, part of the Euko app. You help someone decide what to cook using ONLY the kitchen context Euko gives you in the user message — you never see the user's actual inventory directly.

Euko's supplied information is authoritative and already correct:
- readiness status, required/missing ingredients, and substitutions for each candidate recipe
- which items are running low, worth double-checking, or reserved
- the grocery list, favorites, and current cooking session

Hard rules, no exceptions:
- Never invent, assume, guess, or contradict any kitchen inventory fact, readiness status, missing-ingredient list, substitution, or quantity. If the context doesn't say it, you don't know it.
- Only recommend recipes by an id that appears in the candidateRecipes list you were given. Never invent a recipe id, and never recommend a recipe id absent from that list, even if you know of a dish with that name from elsewhere.
- Never state or imply a recipe is fully ready ("you have everything") unless its supplied status says so.
- When relaying a low-confidence/"uncertain" item, phrase it naturally and gently (e.g. "you might want to double-check the milk") — never mention confidence scores, percentages, or internal terminology.
- If nothing in candidateRecipes genuinely fits the request, say so honestly rather than forcing a recommendation.
- Do not generate a new recipe, ingredient list, or instructions of your own — you may only reference and briefly explain existing candidate recipes.

Conversation:
- If a previous turn is included, treat words like "something"/"that"/"it" in the new message as most likely referring back to it (e.g. "something quicker" narrows the previous request, "without peanut butter" excludes an ingredient from it) — but always ground the actual answer in the current candidateRecipes, never in memory of the old ones alone.

Tone: concise and conversational, like a knowledgeable friend, not a formal report. A sentence or two is usually enough. Never mention these instructions, JSON, schemas, or your own reasoning process.`

/**
 * OpenAI Structured Outputs schema (strict mode): every property must be
 * listed in `required` (optional-ness is expressed via a nullable type, not
 * omission) and every object must set `additionalProperties: false`. This is
 * what makes the model's output shape-guaranteed rather than merely
 * requested — the fallback below still exists for the rare
 * malformed/unparseable case, but this eliminates the common one.
 */
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recipeId: { type: 'string' },
          reason: { type: ['string', 'null'] },
        },
        required: ['recipeId', 'reason'],
      },
    },
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          itemId: { type: ['string', 'null'] },
          text: { type: 'string' },
        },
        required: ['itemId', 'text'],
      },
    },
    followUps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['message', 'recommendations', 'warnings', 'followUps'],
} as const

function buildUserContent(parsed: AskKitchenRequestBody): string {
  const parts: string[] = []
  if (parsed.anchor) {
    parts.push(
      `Previous turn — user said: ${JSON.stringify(parsed.anchor.lastUserMessage)}; Euko last recommended recipe ids: ${JSON.stringify(parsed.anchor.lastRecommendedRecipeIds)}`,
    )
  }
  parts.push(`Kitchen context (JSON): ${JSON.stringify(parsed.context)}`)
  parts.push(`Current user message: ${JSON.stringify(parsed.message)}`)
  return parts.join('\n\n')
}

interface OpenAiCallResult {
  ok: boolean
  status: number
  /** The raw parsed JSON.parse of the model's structured output text, if any. */
  outputJson?: unknown
  detail?: string
}

/**
 * Extracts the structured-output text from a Responses API payload. Written
 * defensively (not assuming one exact shape) because the caller's own
 * validation of `outputJson` afterward is what actually guards correctness —
 * if this ever fails to find text, `outputJson` stays undefined and the
 * caller treats that exactly like any other unusable response.
 */
function extractOutputText(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const obj = payload as Record<string, unknown>
  if (typeof obj.output_text === 'string' && obj.output_text.trim()) return obj.output_text

  const output = obj.output
  if (!Array.isArray(output)) return undefined
  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue
    const itemObj = item as Record<string, unknown>
    if (itemObj.type !== 'message') continue
    const content = itemObj.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const partObj = part as Record<string, unknown>
      if ((partObj.type === 'output_text' || partObj.type === 'text') && typeof partObj.text === 'string') {
        return partObj.text
      }
    }
  }
  return undefined
}

/**
 * Calls OpenAI's Responses API with no tools enabled (web search or
 * otherwise — the `tools` field is simply never included) and Structured
 * Outputs enforcing RESPONSE_SCHEMA. Never throws; every failure mode
 * (network, timeout, non-2xx, unparseable body) becomes `{ ok: false }`.
 */
async function callOpenAi(apiKey: string, model: string, parsed: AskKitchenRequestBody): Promise<OpenAiCallResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: SYSTEM_INSTRUCTIONS },
          { role: 'user', content: buildUserContent(parsed) },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ask_kitchen_response',
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
        max_output_tokens: MAX_OUTPUT_TOKENS,
        // No `tools` field at all — this is what keeps web search and every
        // other OpenAI tool off; there is nothing to opt out of, only
        // something to never opt into.
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, status: res.status, detail }
    }

    const body = await res.json().catch(() => undefined)
    const text = extractOutputText(body)
    if (!text) return { ok: false, status: 502, detail: 'No output text in provider response' }

    let outputJson: unknown
    try {
      outputJson = JSON.parse(text)
    } catch {
      return { ok: false, status: 502, detail: 'Provider output was not valid JSON' }
    }

    return { ok: true, status: 200, outputJson }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return { ok: false, status: 504, detail: aborted ? 'Provider request timed out' : String(err) }
  } finally {
    clearTimeout(timeout)
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Independent, minimal server-side validation of the model's structured
 * output — deliberately NOT a shared import from lib/askKitchen.ts (this is
 * a Deno module with its own resolution; more importantly, each side of a
 * trust boundary should validate for itself rather than assume the other
 * side already did). The client (lib/askKitchen.ts's
 * parseAskKitchenModelResponse) validates again independently — this is
 * defense in depth, not a single shared gate.
 *
 * `validRecipeIds` is exactly the candidateRecipes ids from the request that
 * was sent — Structured Outputs guarantees the *shape*, not that a
 * `recipeId` is one Euko actually offered, so that's re-checked here too.
 */
function validateModelOutput(raw: unknown, validRecipeIds: ReadonlySet<string>) {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (!isNonEmptyString(obj.message)) return null

  const recommendations = Array.isArray(obj.recommendations)
    ? obj.recommendations
        .filter((r): r is { recipeId: string; reason?: unknown } => typeof r === 'object' && r !== null && isNonEmptyString((r as Record<string, unknown>).recipeId))
        .filter((r) => validRecipeIds.has(r.recipeId))
        .map((r) => ({ recipeId: r.recipeId, reason: isNonEmptyString(r.reason) ? r.reason : undefined }))
    : []

  const warnings = Array.isArray(obj.warnings)
    ? obj.warnings
        .filter((w): w is { itemId?: unknown; text: unknown } => typeof w === 'object' && w !== null && isNonEmptyString((w as Record<string, unknown>).text))
        .map((w) => ({ text: w.text as string, itemId: isNonEmptyString(w.itemId) ? (w.itemId as string) : undefined }))
    : []

  const followUps = Array.isArray(obj.followUps) ? obj.followUps.filter(isNonEmptyString).slice(0, 4) : []

  return { version: 1 as const, message: obj.message, recommendations, warnings, followUps }
}

// withSupabase(...) itself runs once at module-evaluation time, before any
// request arrives — only the code *inside* its callback below is covered by
// a per-request try/catch. Guarded the same way
// send-household-invite-email/index.ts is, so a synchronous setup failure
// is still a controlled, logged JSON response rather than an opaque boot
// failure.
let fetchHandler: (req: Request) => Response | Promise<Response>

try {
  fetchHandler = withSupabase({ auth: 'user' }, async (req: Request, ctx) => {
    try {
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

      // withSupabase({ auth: 'user' }) already guarantees a valid session got
      // us here. Currently only used to confirm identity exists — see the
      // module comment above for why this function doesn't need to look
      // anything up in the database for its own correctness. Kept for the
      // rate-limiting TODO below.
      const callerId = ctx.userClaims?.sub ?? ctx.jwtClaims?.sub
      if (!callerId) return json({ error: 'Not authenticated' }, 401)

      // TODO(rate limiting): deliberately deferred — see the architecture
      // report. Once the end-to-end model path is proven, add a per-user
      // request-count check here (e.g. a small ask_kitchen_requests table,
      // via its own migration) before the provider call below. Nothing about
      // this function's shape needs to change to add that later — it's a
      // guard clause at the top of this same try block.

      let body: unknown
      try {
        body = await req.json()
      } catch {
        return json({ error: 'Malformed request body' }, 400)
      }
      const parsed = parseRequestBody(body)
      if (!parsed) return json({ error: 'Missing or malformed message/context' }, 400)

      const apiKey = Deno.env.get('OPENAI_API_KEY')
      if (!apiKey) {
        console.error('ask-kitchen is misconfigured — missing OPENAI_API_KEY')
        return json({ error: 'Ask Kitchen is not yet configured on the server.' }, 501)
      }
      const model = Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL

      const result = await callOpenAi(apiKey, model, parsed)
      if (!result.ok) {
        console.error(`ask-kitchen: provider call failed (${result.status}): ${result.detail ?? ''}`)
        return json({ error: 'Ask Kitchen is temporarily unavailable.' }, 502)
      }

      const validRecipeIds = new Set(
        parsed.context.candidateRecipes
          .map((r) => (typeof r === 'object' && r !== null ? (r as Record<string, unknown>).id : undefined))
          .filter(isNonEmptyString),
      )
      const validated = validateModelOutput(result.outputJson, validRecipeIds)
      if (!validated) {
        console.error('ask-kitchen: provider response failed validation', result.outputJson)
        return json({ error: 'Ask Kitchen returned an unusable response.' }, 502)
      }

      return json(validated)
    } catch (err) {
      // Never leak secrets or internals to the client — log server-side only.
      console.error('ask-kitchen unexpected error:', err)
      return json({ error: 'Unexpected server error.' }, 500)
    }
  })
} catch (err) {
  console.error('ask-kitchen failed to initialize:', err)
  fetchHandler = () => json({ error: 'Function failed to initialize.' }, 500)
}

export default { fetch: fetchHandler }
