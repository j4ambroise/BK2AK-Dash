export type MealType = 'breakfast' | 'lunch' | 'appetizer' | 'dinner' | 'dessert' | 'snack' | 'drinks'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'appetizer', 'dinner', 'dessert', 'snack', 'drinks']

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  appetizer: 'Appetizer',
  dinner: 'Dinner',
  dessert: 'Dessert',
  snack: 'Snack',
  drinks: 'Drinks',
}

export interface Recipe {
  id: string
  name: string
  description?: string
  default_servings: number
  meal_type: MealType
  source_url?: string
  notes?: string
  tags: string[]
  is_standard_lunch?: boolean
  created_at: string
  recipe_ingredients?: Ingredient[]
}

export interface Ingredient {
  id: string
  recipe_id: string
  name: string
  quantity: number
  unit: string
  vendor?: string
  shopping_note?: string
  sort_order: number
}

export interface Trip {
  id: string
  name: string
  year?: number
  num_people: number
  num_days: number
  num_shopping_trips: number
  start_date?: string
  end_date?: string
  auto_pack?: boolean
  auto_lunch?: boolean
  trip_notes?: string
  created_at: string
}

// ---- Gear inventory ----
export type GearItemType = 'gear' | 'supply'

export const GEAR_CATEGORIES = ['Boats', 'River Safety', 'Apparel', 'Camping', 'Kitchen', 'Gear', 'Other']

export interface GearVariant {
  id: string
  item_id: string
  label: string
  quantity: number
  sort_order: number
}

export interface GearItem {
  id: string
  name: string
  category: string
  item_type: GearItemType
  unit: string
  always_pack: boolean
  low_stock_threshold: number
  notes?: string
  sort_order: number
  created_at?: string
  gear_variants?: GearVariant[]
}

export interface GearReservation {
  id: string
  trip_id: string
  variant_id: string
  quantity: number
  reserved_by?: string
  created_at?: string
}

export type TimeLabel = 'AM' | 'Midday' | 'PM' | 'Evening'

export const TIME_LABELS: TimeLabel[] = ['AM', 'Midday', 'PM', 'Evening']

export interface ItineraryItem {
  id: string
  trip_id: string
  day_number: number
  time_label?: string
  activity: string
  sort_order: number
  created_at?: string
}

export interface MenuItem {
  id: string
  trip_id: string
  recipe_id: string
  day_number: number
  meal_type: MealType
  notes?: string
  recipe?: Recipe
}

export interface ShoppingItem {
  name: string
  total_qty: number
  unit: string
  vendor?: string
  shopping_note?: string
  recipes: string[]
}

export const VENDORS = ['Costco', 'Fred Meyer', 'PoHo', 'Other']

// Photo picker types
export type VoteValue = 'yes' | 'no' | 'maybe'

export interface Photo {
  id: string
  url: string
  source?: string
  album?: string
  filename?: string
  trip_id?: string
  trip_name?: string
  description?: string
  created_at: string
}

export interface Vote {
  id: string
  photo_id: string
  user_name: string
  vote: VoteValue
  created_at: string
}

export interface PhotoWithVotes extends Photo {
  votes: Vote[]
  myVote?: VoteValue
}
