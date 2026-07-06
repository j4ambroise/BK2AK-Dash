import { NextRequest, NextResponse } from 'next/server'

function findRecipeSchema(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeSchema(item)
      if (found) return found
    }
    return null
  }
  const obj = data as Record<string, unknown>
  const type = obj['@type']
  if (type === 'Recipe' || (Array.isArray(type) && (type as string[]).includes('Recipe'))) return obj
  if (obj['@graph']) return findRecipeSchema(obj['@graph'])
  return null
}

const UNIT_LIST = [
  'cups?', 'tbsps?', 'tablespoons?', 'tsps?', 'teaspoons?',
  'oz', 'ounces?', 'lbs?', 'pounds?', 'grams?', 'g', 'kg',
  'ml', 'liters?', 'l', 'cloves?', 'slices?', 'cans?',
  'packages?', 'pkgs?', 'pinch(?:es)?', 'dashes?', 'handfuls?',
  'pieces?', 'pints?', 'quarts?', 'gallons?', 'bunches?',
  'stalks?', 'sprigs?', 'heads?', 'blocks?', 'bags?',
]
const UNIT_RE = new RegExp(
  `^([\\d\\s/¼½¾⅓⅔⅛⅜⅝⅞.,-]+)\\s*(${UNIT_LIST.join('|')})\\.?\\s+(.+)$`,
  'i'
)
const QTY_RE = /^([\d\s/¼½¾⅓⅔⅛⅜⅝⅞.,-]+)\s+(.+)$/

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 0.333, '⅔': 0.667,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

function parseFraction(str: string): number {
  let s = str
  for (const [k, v] of Object.entries(UNICODE_FRACTIONS)) s = s.replace(k, ` ${v}`)
  let total = 0
  for (const part of s.trim().split(/\s+/)) {
    if (part.includes('/')) {
      const [n, d] = part.split('/')
      total += parseFloat(n) / parseFloat(d)
    } else {
      total += parseFloat(part) || 0
    }
  }
  return total
}

function parseIngredient(raw: string, idx: number) {
  const str = raw.replace(/<[^>]+>/g, '').trim()
  const withUnit = str.match(UNIT_RE)
  if (withUnit) {
    return { name: withUnit[3].trim(), quantity: parseFraction(withUnit[1]), unit: withUnit[2].trim(), vendor: '', shopping_note: '', sort_order: idx }
  }
  const qtyOnly = str.match(QTY_RE)
  if (qtyOnly) {
    const qty = parseFraction(qtyOnly[1])
    if (qty > 0) return { name: qtyOnly[2].trim(), quantity: qty, unit: '', vendor: '', shopping_note: '', sort_order: idx }
  }
  return { name: str, quantity: 0, unit: '', vendor: '', shopping_note: '', sort_order: idx }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return NextResponse.json({ error: `Could not fetch that page (${res.status})` }, { status: 400 })

    const html = await res.text()
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]

    let recipe: Record<string, unknown> | null = null
    for (const block of blocks) {
      try {
        recipe = findRecipeSchema(JSON.parse(block[1]))
        if (recipe) break
      } catch { /* malformed JSON-LD, skip */ }
    }

    if (!recipe) {
      return NextResponse.json({ error: 'No recipe data found on this page. Try adding it manually.' }, { status: 404 })
    }

    // Servings
    let servings = 12
    const yieldRaw = recipe.recipeYield
    if (yieldRaw) {
      const s = Array.isArray(yieldRaw) ? String(yieldRaw[0]) : String(yieldRaw)
      const n = parseInt(s)
      if (!isNaN(n) && n > 0) servings = n
    }

    // Ingredients
    const rawIngredients: string[] = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient as string[] : []
    const ingredients = rawIngredients.map((s, i) => parseIngredient(s, i))

    // Instructions → notes
    let notes = ''
    const instr = recipe.recipeInstructions
    if (Array.isArray(instr)) {
      notes = (instr as unknown[]).map(i => {
        if (typeof i === 'string') return i
        if (i && typeof i === 'object') return (i as Record<string, unknown>).text ?? ''
        return ''
      }).filter(Boolean).join('\n\n')
    } else if (typeof instr === 'string') {
      notes = instr
    }

    return NextResponse.json({
      name: String(recipe.name ?? ''),
      description: String(recipe.description ?? ''),
      servings,
      ingredients,
      notes,
      source_url: url,
    })
  } catch (err) {
    console.error('Scrape error:', err)
    return NextResponse.json({ error: 'Failed to scrape recipe' }, { status: 500 })
  }
}
