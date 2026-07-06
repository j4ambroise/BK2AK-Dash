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
  trip_notes?: string
  created_at: string
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
