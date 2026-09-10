import { supabase } from '../utils/supabase'
import type { AskKitchenContext } from './askKitchenContext'

/** The tiny, one-turn conversation memory — never a full transcript. See lib/askKitchen.test.ts. */
export interface AskKitchenConversationAnchor {
  lastUserMessage: string
  lastRecommendedRecipeIds: string[]
}

export interface AskKitchenRecommendation {
  recipeId: string
  reason?: string
}

export interface AskKitchenWarning {
  itemId?: string
  text: string
}

/**
 * What the Edge Function returns on success. Every reference is a real Euko
 * id (`recipeId`/`itemId`) — the model never returns its own ingredient list
 * or instructions; a recommendation only ever points at an existing recipe,
 * which the client renders via the real RecipeCard/RecipeDetail.
 */
export interface AskKitchenModelResponse {
  version: 1
  message: string
  recommendations: AskKitchenRecommendation[]
  warnings: AskKitchenWarning[]
  followUps: string[]
}

export type AskKitchenOutcome =
  | { ok: true; response: AskKitchenModelResponse }
  /** Network error, non-2xx, function not yet configured, or malformed/unusable response shape — the caller should fall back to the deterministic assistant for every one of these, indistinguishably. */
  | { ok: false; reason: 'unavailable' | 'invalid-response' }

const MAX_FOLLOW_UPS = 4

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Defensive, never-throwing validation of whatever the Edge Function
 * returned. Drops individual malformed entries (an invalid recommendation,
 * warning, or follow-up) rather than failing the whole response over one bad
 * item — but a response with no usable `message` at all is treated as
 * entirely invalid, since there'd be nothing honest left to show.
 *
 * `validRecipeIds` is the exact set of ids sent in the request's
 * `candidateRecipes` — a recommendation for anything else is dropped here,
 * before the client-side re-resolution step even runs (see
 * screens/KitchenAssistant.tsx), so the model can never surface a recipe it
 * wasn't even given.
 */
export function parseAskKitchenModelResponse(raw: unknown, validRecipeIds: ReadonlySet<string>): AskKitchenModelResponse | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (!isNonEmptyString(obj.message)) return null

  const recommendations: AskKitchenRecommendation[] = Array.isArray(obj.recommendations)
    ? obj.recommendations
        .filter(
          (r): r is { recipeId: string; reason?: unknown } =>
            typeof r === 'object' && r !== null && isNonEmptyString((r as Record<string, unknown>).recipeId),
        )
        .filter((r) => validRecipeIds.has(r.recipeId))
        .map((r) => ({ recipeId: r.recipeId, reason: isNonEmptyString(r.reason) ? r.reason : undefined }))
    : []

  const warnings: AskKitchenWarning[] = Array.isArray(obj.warnings)
    ? obj.warnings
        .filter((w): w is { itemId?: unknown; text: unknown } => typeof w === 'object' && w !== null && isNonEmptyString((w as Record<string, unknown>).text))
        .map((w) => ({ text: w.text as string, itemId: isNonEmptyString(w.itemId) ? (w.itemId as string) : undefined }))
    : []

  const followUps: string[] = Array.isArray(obj.followUps)
    ? obj.followUps.filter(isNonEmptyString).slice(0, MAX_FOLLOW_UPS)
    : []

  return { version: 1, message: obj.message, recommendations, warnings, followUps }
}

/**
 * Calls the ask-kitchen Edge Function with a deterministically-built context
 * (see lib/askKitchenContext.ts) and the tiny conversation anchor, if any.
 * Never throws — every failure mode (network, non-2xx, function not yet
 * configured, malformed response shape) collapses to the same `{ ok: false }`
 * outcome so the caller has exactly one fallback branch to handle, per the
 * architecture report's failure-mode table.
 */
export async function askKitchen(params: {
  message: string
  context: AskKitchenContext
  anchor?: AskKitchenConversationAnchor
}): Promise<AskKitchenOutcome> {
  const { message, context, anchor } = params

  const { data, error } = await supabase.functions.invoke('ask-kitchen', {
    body: { message, context, anchor },
  })

  if (error) return { ok: false, reason: 'unavailable' }

  const validRecipeIds = new Set(context.candidateRecipes.map((r) => r.id))
  const parsed = parseAskKitchenModelResponse(data, validRecipeIds)
  if (!parsed) return { ok: false, reason: 'invalid-response' }

  return { ok: true, response: parsed }
}
