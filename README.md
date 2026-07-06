# BK2AK Menu Maker

Expedition menu planning for Brooklyn to Alaska. Build trip menus, scale recipes to headcount, generate shopping lists by vendor.

## Deploy to Vercel (5 minutes)

1. **Push to GitHub**
   ```bash
   cd "menu-maker"
   git init
   git add .
   git commit -m "Initial BK2AK menu maker"
   gh repo create bk2ak-menu-maker --private --push
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com) → New Project → import your repo
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://qvtspgwmhufxwbjganti.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (from .env.local)
   - Deploy

3. **Run locally**
   ```bash
   npm install
   npm run dev
   # Open http://localhost:3000
   ```

## What's built

- **Recipe Library** — Add recipes with full ingredient lists (name, qty, unit, vendor, shopping notes). Filter by meal type. Link to source URLs.
- **Trips** — Create a trip with headcount + days. One trip = one menu.
- **Menu Grid** — Day × meal type grid. Click any cell to search and assign recipes from your library.
- **Shopping List** — Auto-calculated from all menu recipes, scaled to headcount. Group by vendor (Costco, Fred Meyer, etc.) or by day. Print-ready.

## Database

All data lives in the existing `bk2ak-dashboard` Supabase project:
- `recipes` — recipe library
- `recipe_ingredients` — ingredients per recipe with vendor + notes
- `trips` — extended with `num_people` and `num_days`
- `menu_items` — joins trips to recipes by day + meal type

Shopping quantities are auto-scaled: `ingredient_qty × (trip_people / recipe_default_servings)`
