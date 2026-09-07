import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KitchenItem } from '../data/types'

// ---------------------------------------------------------------------------
// Regression coverage for the second half of the household-sharing bug: when
// an existing user accepts an invite and Euko switches to the new household,
// the persisted local kitchen / grocery / favorites / custom-ingredient
// collections still belong to their *old* household. The "empty target ->
// upload local" bootstrap in each init*Sync must NOT fire in that case, or the
// two kitchens silently merge. `syncedHouseholdId` + markHouseholdSynced gate
// that: a non-null, mismatched value means "switch — drop local, take server".
// ---------------------------------------------------------------------------

const kitchenSync = vi.hoisted(() => ({
  fetchKitchenItems: vi.fn(),
  uploadInitialKitchen: vi.fn(),
}))
const grocerySync = vi.hoisted(() => ({
  fetchGroceryItems: vi.fn(),
  uploadInitialGroceryList: vi.fn(),
}))

vi.mock('../lib/kitchenSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/kitchenSync')>()),
  fetchKitchenItems: kitchenSync.fetchKitchenItems,
  uploadInitialKitchen: kitchenSync.uploadInitialKitchen,
}))
vi.mock('../lib/grocerySync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/grocerySync')>()),
  fetchGroceryItems: grocerySync.fetchGroceryItems,
  uploadInitialGroceryList: grocerySync.uploadInitialGroceryList,
}))

const { useKitchenStore } = await import('./useKitchenStore')

const seedItem: KitchenItem = {
  id: 'milk',
  name: 'Milk',
  emoji: '🥛',
  location: 'fridge',
  stockType: 'container',
  category: 'Dairy',
  fill: 0.5,
}
const seedGrocery = {
  id: 'g-eggs',
  name: 'Eggs',
  emoji: '🥚',
  category: 'Dairy',
  reason: 'Running low',
  checked: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  useKitchenStore.getState().resetKitchenSync()
  useKitchenStore.getState().resetGroceryListSync()
  useKitchenStore.setState({
    items: [seedItem],
    groceryList: [seedGrocery],
    householdId: null,
    syncedHouseholdId: null,
  })
})

describe('initKitchenSync — household switch guard', () => {
  it('does NOT upload local items into a freshly-joined empty household (no silent merge)', async () => {
    useKitchenStore.setState({ syncedHouseholdId: 'old-house' })
    kitchenSync.fetchKitchenItems.mockResolvedValue({ items: [], error: null })

    await useKitchenStore.getState().initKitchenSync('joined-house')

    expect(kitchenSync.uploadInitialKitchen).not.toHaveBeenCalled()
    // The joined household's (empty) server state wins; the old local items are gone.
    expect(useKitchenStore.getState().items).toEqual([])
    expect(useKitchenStore.getState().householdId).toBe('joined-house')
  })

  it('loads the joined household’s server items over the old local ones', async () => {
    useKitchenStore.setState({ syncedHouseholdId: 'old-house' })
    const shared: KitchenItem = {
      id: 'flour',
      name: 'Flour',
      emoji: '🌾',
      location: 'pantry',
      stockType: 'staple',
      category: 'Baking',
      level: 'plenty',
    }
    kitchenSync.fetchKitchenItems.mockResolvedValue({ items: [shared], error: null })

    await useKitchenStore.getState().initKitchenSync('joined-house')

    expect(kitchenSync.uploadInitialKitchen).not.toHaveBeenCalled()
    expect(useKitchenStore.getState().items.map((i) => i.id)).toEqual(['flour'])
  })

  it('still uploads local items on a genuine first sync (no prior synced household)', async () => {
    // syncedHouseholdId stays null — this is a brand-new user's first sign-in.
    kitchenSync.fetchKitchenItems.mockResolvedValue({ items: [], error: null })
    kitchenSync.uploadInitialKitchen.mockResolvedValue({ items: [{ ...seedItem, remoteId: 'r1' }], error: null })

    await useKitchenStore.getState().initKitchenSync('first-house')

    expect(kitchenSync.uploadInitialKitchen).toHaveBeenCalledWith([seedItem], 'first-house')
    expect(useKitchenStore.getState().items[0].remoteId).toBe('r1')
  })

  it('re-syncing the same household keeps using local data as a cache', async () => {
    useKitchenStore.setState({ syncedHouseholdId: 'same-house' })
    kitchenSync.fetchKitchenItems.mockResolvedValue({ items: [], error: null })
    kitchenSync.uploadInitialKitchen.mockResolvedValue({ items: [seedItem], error: null })

    await useKitchenStore.getState().initKitchenSync('same-house')

    // Not a switch -> the first-sync upload path is still allowed.
    expect(kitchenSync.uploadInitialKitchen).toHaveBeenCalled()
  })
})

describe('initGroceryListSync — household switch guard', () => {
  it('drops the old grocery list instead of merging it into the joined household', async () => {
    useKitchenStore.setState({ syncedHouseholdId: 'old-house' })
    grocerySync.fetchGroceryItems.mockResolvedValue({ items: [], error: null })

    await useKitchenStore.getState().initGroceryListSync('joined-house')

    expect(grocerySync.uploadInitialGroceryList).not.toHaveBeenCalled()
    expect(useKitchenStore.getState().groceryList).toEqual([])
  })
})

describe('markHouseholdSynced', () => {
  it('records the household so a later different one is detected as a switch', () => {
    useKitchenStore.getState().markHouseholdSynced('house-a')
    expect(useKitchenStore.getState().syncedHouseholdId).toBe('house-a')
  })
})
