import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AskKitchenContext } from './askKitchenContext'

const { supabase } = vi.hoisted(() => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

vi.mock('../utils/supabase', () => ({ supabase }))

// Imported after the mock so askKitchen.ts picks up the mocked client.
const { askKitchen, parseAskKitchenModelResponse } = await import('./askKitchen')

function context(overrides: Partial<AskKitchenContext> = {}): AskKitchenContext {
  return {
    version: 1,
    kitchen: { itemCount: 3, hasAnyStock: true },
    useSoon: [],
    uncertain: [],
    reserved: [],
    candidateRecipes: [
      {
        id: 'r1',
        name: 'R1',
        mealTypes: ['dinner'],
        tags: [],
        time: 20,
        effortLabel: 'Easy',
        servings: 2,
        status: 'ready',
        requiredAvailable: 2,
        requiredTotal: 2,
        missingRequired: [],
        substitutionsUsed: [],
      },
    ],
    groceryItemNames: [],
    favoriteRecipeIds: [],
    session: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('parseAskKitchenModelResponse', () => {
  const validIds = new Set(['r1', 'r2'])

  it('returns null for a non-object or missing message', () => {
    expect(parseAskKitchenModelResponse(null, validIds)).toBeNull()
    expect(parseAskKitchenModelResponse('a string', validIds)).toBeNull()
    expect(parseAskKitchenModelResponse({}, validIds)).toBeNull()
    expect(parseAskKitchenModelResponse({ message: '' }, validIds)).toBeNull()
  })

  it('accepts a minimal valid response with no optional fields', () => {
    expect(parseAskKitchenModelResponse({ message: 'Try R1.' }, validIds)).toEqual({
      version: 1,
      message: 'Try R1.',
      recommendations: [],
      warnings: [],
      followUps: [],
    })
  })

  it('drops a recommendation whose recipeId was not in the ids actually sent', () => {
    const parsed = parseAskKitchenModelResponse(
      { message: 'hi', recommendations: [{ recipeId: 'r1' }, { recipeId: 'made-up-id' }] },
      validIds,
    )
    expect(parsed?.recommendations).toEqual([{ recipeId: 'r1', reason: undefined }])
  })

  it('keeps a recommendation reason when present', () => {
    const parsed = parseAskKitchenModelResponse(
      { message: 'hi', recommendations: [{ recipeId: 'r1', reason: 'quick and ready' }] },
      validIds,
    )
    expect(parsed?.recommendations).toEqual([{ recipeId: 'r1', reason: 'quick and ready' }])
  })

  it('drops a malformed individual warning/follow-up rather than failing the whole response', () => {
    const parsed = parseAskKitchenModelResponse(
      {
        message: 'hi',
        warnings: [{ text: 'worth checking milk' }, { text: '' }, 'not an object'],
        followUps: ['something quicker', '', 42],
      },
      validIds,
    )
    expect(parsed?.warnings).toEqual([{ text: 'worth checking milk', itemId: undefined }])
    expect(parsed?.followUps).toEqual(['something quicker'])
  })

  it('caps follow-ups at 4', () => {
    const parsed = parseAskKitchenModelResponse({ message: 'hi', followUps: ['a', 'b', 'c', 'd', 'e'] }, validIds)
    expect(parsed?.followUps.length).toBe(4)
  })
})

describe('askKitchen', () => {
  it('returns ok:false, reason "unavailable" on a function-invoke error, without throwing', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'network error' } })
    const outcome = await askKitchen({ message: 'hi', context: context() })
    expect(outcome).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('returns ok:false, reason "invalid-response" on a malformed body', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { nope: true }, error: null })
    const outcome = await askKitchen({ message: 'hi', context: context() })
    expect(outcome).toEqual({ ok: false, reason: 'invalid-response' })
  })

  it('returns ok:true with the validated response on success', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { message: 'Try R1.', recommendations: [{ recipeId: 'r1' }] },
      error: null,
    })
    const outcome = await askKitchen({ message: 'hi', context: context() })
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.response.message).toBe('Try R1.')
      expect(outcome.response.recommendations).toEqual([{ recipeId: 'r1', reason: undefined }])
    }
  })

  it('calls the edge function with the message, context, and anchor', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { message: 'hi' }, error: null })
    const anchor = { lastUserMessage: 'something sweet', lastRecommendedRecipeIds: ['r1'] }
    await askKitchen({ message: 'without peanut butter', context: context(), anchor })
    expect(supabase.functions.invoke).toHaveBeenCalledWith('ask-kitchen', {
      body: { message: 'without peanut butter', context: context(), anchor },
    })
  })

  it('validates a recommendation against the ids actually present in the context sent, not some other set', async () => {
    // context() only has 'r1' as a candidate — a response recommending 'r2'
    // must be dropped by parseAskKitchenModelResponse's own validRecipeIds
    // check, exercised end-to-end through askKitchen.
    supabase.functions.invoke.mockResolvedValue({
      data: { message: 'hi', recommendations: [{ recipeId: 'r2' }] },
      error: null,
    })
    const outcome = await askKitchen({ message: 'hi', context: context() })
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.response.recommendations).toEqual([])
  })
})
