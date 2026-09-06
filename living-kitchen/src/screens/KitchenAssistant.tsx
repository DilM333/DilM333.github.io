import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import RecipeCard from '../components/RecipeCard'
import { getKitchenAssistantGreeting, getKitchenAssistantResponse } from '../lib/kitchenAssistant'
import { buildKitchenAssistantContext } from '../lib/kitchenAssistantContext'
import { useKitchenStore } from '../store/useKitchenStore'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  recipeIds?: string[]
}

const SUGGESTIONS = [
  'What can I make right now?',
  'Something quick',
  'Use what I already have',
  'Something vegetarian',
]

export default function KitchenAssistant() {
  const items = useKitchenStore((s) => s.items)
  const groceryList = useKitchenStore((s) => s.groceryList)
  const recipes = useKitchenStore((s) => s.recipes)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')

  // Kitchen/grocery data stays authoritative — this just reshapes the
  // current store state into the structured snapshot the (future AI-ready)
  // response engine reasons over. Recomputed whenever the underlying data
  // changes, so it never goes stale mid-conversation.
  const context = useMemo(
    () => buildKitchenAssistantContext(items, groceryList, recipes),
    [items, groceryList, recipes],
  )
  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r] as const)), [recipes])

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const response = getKitchenAssistantResponse(trimmed, context)
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: trimmed },
      { id: `a-${Date.now() + 1}`, role: 'assistant', text: response.message, recipeIds: response.recipeIds },
    ])
    setDraft('')
  }

  return (
    <div className="flex min-h-full flex-col gap-4 pb-4">
      <PageHeader title="Kitchen Assistant" subtitle="Ask what to make with what you have." back />

      <div className="flex flex-col gap-3 px-5">
        {messages.length === 0 ? (
          <div className="rounded-xl2 border border-ink/10 bg-white p-4 text-sm text-ink/70 shadow-soft">
            {getKitchenAssistantGreeting(context)}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl2 px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-ink text-cream'
                    : 'border border-ink/10 bg-white text-ink shadow-soft'
                }`}
              >
                {m.text}
              </div>
              {m.recipeIds && m.recipeIds.length > 0 && (
                <div className="mt-2 flex w-full max-w-[85%] flex-col gap-2">
                  {m.recipeIds
                    .map((id) => recipeById.get(id))
                    .filter((r): r is NonNullable<typeof r> => !!r)
                    .map((recipe) => (
                      <RecipeCard key={recipe.id} recipe={recipe} items={items} />
                    ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2 px-5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-clay/40"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
        className="mt-auto flex gap-2 px-5 pt-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about dinner…"
          className="flex-1 rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-clay"
        />
        <button
          type="submit"
          className="rounded-xl bg-clay px-4 text-sm font-bold text-white shadow-soft disabled:opacity-40"
          disabled={!draft.trim()}
        >
          Send
        </button>
      </form>
    </div>
  )
}
