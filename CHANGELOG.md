# Changelog

## [Unreleased]

### Added

- Workout session persistence — progress (exercise + set) is saved to localStorage so exiting mid-workout and returning resumes where you left off
- `useWorkoutSession` hook — localStorage-backed session state scoped to (planId, dayKey), with automatic stale-entry pruning
- `ProgressRing` component — SVG circular progress indicator with animated fill and optional centre label
- Dashboard: today's workout card shows a progress ring with percentage when a session is in-progress, and a filled check circle when complete
- Dashboard: session chip shows "5/12 sets" during a workout, "Done" after completion
- Workouts page: "Start workout" button becomes "Resume workout · 5 of 12 sets" with a thin progress bar when a session exists
- Workouts page: completed exercises in the list are dimmed with accent-coloured check badges
- Workouts page: day header card shows a progress ring (in-progress) or check circle (complete) instead of the static dumbbell icon

### Changed

- Groceries: hide Quick Add category chips until input is focused (shown on blur after 150ms delay)

### Removed

- Groceries: removed "Send to Reminders" button and synced-date indicator

### Added

- Responsive desktop layout with `md:` (≥768px) breakpoint
- `SideNav` component — fixed left sidebar with vertical navigation, Wordmark, and Clerk UserButton; hidden on mobile
- `useIsDesktop` hook — reactive `matchMedia` wrapper for JS-level responsive logic
- Desktop shell in `Layout` — sidebar + widened content area with 960px max-width; mobile header and bottom nav hidden on desktop
- Dashboard cards arranged in a 2-column grid on desktop
- MealDetailView ingredients and steps displayed side-by-side on desktop
- Meals and Workouts day tabs rendered as a vertical sidebar column on desktop (horizontal scroll on mobile)
- Recipes page uses a 2-column card grid on desktop
- Groceries categories laid out in 2 columns on desktop
- Profile read-only view shows "Your numbers" and "Training" cards side-by-side on desktop
- RecipeEditor ingredients and steps sections placed side-by-side on desktop
- RecipePickerModal presented as a centered dialog on desktop instead of a bottom sheet

- Learning grocery categorizer: when you manually set an item's category (via tap-to-edit or the per-category add form), the system remembers the name → category mapping and uses it for future auto-categorization
- `GroceryCategoryOverride` Prisma model + migration — stores per-user learned name → category pairs; checked before the regex rules on every auto-classify
- `classifyCategoryForUser(userId, name)` and `learnCategory(userId, name, category)` in the categorizer service
- Auto-categorized quick add on the Groceries page: a single "Quick add" bar takes a name (+ optional qty) and the server classifies the item into a category from its name; tap any row to override the guess
- Editable grocery list: tap any item to rename, change quantity, change category, or delete; "+ Add to {category}" inline form per section, plus a collapsible "Add to a specific category…" disclosure for empty categories
- Manual grocery items persist across plan regenerations and slot mutations and render with a "Manual" badge
- "Rebuild from plan" button on the Groceries page that re-derives auto items while preserving manual items and previously-checked rows
- Empty grocery list is now usable: items can be added even when no meal plan exists yet (a list is created on first add)
- `POST /api/groceries/items`, `DELETE /api/groceries/items/:itemId`, `POST /api/groceries/rebuild` endpoints; `PATCH /api/groceries/items/:itemId` now accepts `{checked, name, qty, category, note}`
- `GroceryItem` shape extended with optional `source: "auto"|"manual"`, `amount`, `unit`, `note`
- `useAddGroceryItem`, `useUpdateGroceryItem`, `useDeleteGroceryItem`, `useRebuildGroceries` React Query hooks
- Manual meal planning: per-meal overflow menu on the Meals page with **Regenerate**, **Swap from book**, and **Remove** actions
- "Add a meal" placeholder card under each day that opens the recipe picker, with the next free slot (breakfast → lunch → dinner → snack) suggested automatically
- "Start blank week" button on the Meals page (and in the empty-state) that creates a 7-day plan with no meals so the user can build it from scratch
- `RecipePickerModal` component — searches the recipe book and surfaces slot-matching recipes first
- Single-meal Gemini regeneration: new `generateSingleMeal()` service uses dedicated `buildSingleMealSystemPrompt()` / `buildSingleMealUserPrompt()` builders that carry profile dietary notes, target calories/protein, and an avoid list
- New `/api/meals/empty`, `/api/meals/slot/regenerate`, `PUT /api/meals/slot`, `POST /api/meals/slot/add`, `DELETE /api/meals/slot` endpoints, all schema-validated with Zod
- `useCreateEmptyPlan`, `useRegenerateSlot`, `useReplaceSlot`, `useAddSlot`, `useDeleteSlot` React Query hooks
- `mergeGroceryItems()` helper that rebuilds auto items after slot mutations while preserving `checked` state and any future manual items
- `recipeToMeal` adapter shared between the recipe viewer and the swap-from-book flow
- `ellipsis` icon for the per-meal options button
- Recipe Book at `/recipes` with searchable list, favorite/manual/AI filter chips, and an empty-state CTA
- Manual recipe editor at `/recipes/new` and `/recipes/:id/edit` with repeatable ingredient rows (amount, unit, name, category) and reorderable step rows with optional per-step duration
- Recipe view at `/recipes/:id` with favorite toggle, edit, and delete actions
- "Save to recipe book" action on planned-meal detail pages; saved meals are stored with `source: "AI"` and link directly to the new book entry
- `Recipe` Prisma model + migration with `userId`, `name`, `slotHint`, `servings`, prep/cook/total minutes, per-serving macros (calories/proteinG/carbsG/fatG), JSON ingredients & steps, `tags`, `source` (`MANUAL`/`AI`), `notes`, `isFavorite`
- `useRecipes` / `useRecipe` / `useCreateRecipe` / `useUpdateRecipe` / `useDeleteRecipe` / `useSaveMealAsRecipe` React Query hooks
- `/api/recipes` REST endpoints (list with `?search=&favorite=&source=&tag=`, get one, create, patch, delete, plus `POST /from-meal` to snapshot a planned meal into the book)
- Shared `MealDetailView` component drives both the planned-meal route and the recipe book viewer (servings stepper, ingredient checklist, ordered steps, cooking mode)
- Recipe detail page at `/meals/:day/:index` with hero macros, ingredient checklist, ordered cooking steps, and per-step duration chips
- Cooking Mode: full-screen step-by-step view with progress bar, optional countdown timer per step, and contextual ingredient chips
- Servings stepper on recipe detail that scales ingredient amounts and macros
- Structured cooking quantities (`{ amount, unit }`) on every meal ingredient with canonical units (g/kg/oz/lb/ml/L/tsp/tbsp/cup/fl oz/piece/slice/clove/can/pinch/to taste)
- `formatQuantity()` helper that converts mass and large-volume units between metric and imperial based on user settings, and renders common decimals as fractions
- `formatMinutes()` helper for prep/cook time display
- Server-side `mealPlanNormalizer` that upgrades legacy `planJson` rows (string `qty`, no steps, no servings) to the new shape on read

### Changed

- Slot mutations rebuild the active grocery list while preserving previously-checked items by normalized name + category
- Bottom navigation expanded from 5 to 6 items to surface "Recipes" between Meals and Groceries
- Gemini meal-plan schema and prompt now require structured ingredients, ordered steps, prep/cook/total minutes, servings, slot, and per-serving carbs/fat for every meal
- Meal cards on the Meals page are tappable, navigate to the new detail view, and show prep+cook time and step-count chips
- Grocery aggregator merges quantities by category + name and sums compatible units (mass↔mass, volume↔volume), falling back to a `+`-joined display for incompatible mixes
- Migrate AI provider from Anthropic (Claude) to Google Gemini (`gemini-2.5-flash`)
- Replace `@anthropic-ai/sdk` with `@google/genai` in server dependencies
- Rename environment variable `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`
- Enable Gemini JSON mode (`responseMimeType: "application/json"`) for more reliable structured output
