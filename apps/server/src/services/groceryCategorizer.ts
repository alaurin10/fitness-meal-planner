import {
  GROCERY_CATEGORIES,
  type GroceryCategory,
  prisma,
} from "@platform/db";

const RULES: Array<[GroceryCategory, RegExp]> = [
  [
    "Produce",
    /\b(apple|banana|berr(y|ies)|broccoli|carrot|celery|cucumber|garlic|ginger|kale|lemon|lettuce|lime|mushroom|onion|pepper|potato|spinach|tomato|avocado|zucchini|cabbage|cauliflower|asparagus|squash|orange|grape|melon|mango|pear|peach|herb|parsley|cilantro|basil|scallion|arugula|romaine|sweet potato)\b/i,
  ],
  [
    "Protein",
    /\b(chicken|beef|pork|bacon|turkey|lamb|sausage|ham|steak|ground|salmon|tuna|shrimp|fish|cod|tilapia|tofu|tempeh|seitan|eggs?|jerky)\b/i,
  ],
  [
    "Dairy",
    /\b(milk|cheese|cheddar|mozzarella|parmesan|feta|yogurt|butter|cream|sour cream|cottage cheese|ricotta|kefir)\b/i,
  ],
  [
    "Frozen",
    /\b(frozen|ice cream|popsicle)\b/i,
  ],
  [
    "Pantry",
    /\b(rice|pasta|noodle|bread|oats|flour|sugar|salt|pepper(corn)?|oil|vinegar|sauce|soy sauce|ketchup|mustard|mayo(nnaise)?|spice|bean|lentil|chickpea|quinoa|cereal|cracker|honey|syrup|peanut butter|almond butter|nut|seed|broth|stock|tomato paste|canned)\b/i,
  ],
];

/**
 * Classify an item into a grocery category using the static regex rules.
 * For user-aware classification that checks learned overrides first, use
 * {@link classifyCategoryForUser}.
 */
export function classifyCategory(name: string): GroceryCategory {
  for (const [category, pattern] of RULES) {
    if (pattern.test(name)) return category;
  }
  return "Other";
}

/**
 * User-aware categorizer: checks the user's learned overrides first, then
 * falls back to the static regex rules.
 */
export async function classifyCategoryForUser(
  userId: string,
  name: string,
): Promise<GroceryCategory> {
  const key = name.trim().toLowerCase();
  const override = await prisma.groceryCategoryOverride.findUnique({
    where: { userId_name: { userId, name: key } },
  });
  if (override) {
    const cat = normalizeCategory(override.category);
    if (cat) return cat;
  }
  return classifyCategory(name);
}

/**
 * Store (or update) a user's learned name → category mapping.
 */
export async function learnCategory(
  userId: string,
  name: string,
  category: GroceryCategory,
): Promise<void> {
  const key = name.trim().toLowerCase();
  await prisma.groceryCategoryOverride.upsert({
    where: { userId_name: { userId, name: key } },
    update: { category },
    create: { userId, name: key, category },
  });
}

export function normalizeCategory(raw: unknown): GroceryCategory | null {
  if (typeof raw !== "string") return null;
  const match = GROCERY_CATEGORIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase(),
  );
  return match ?? null;
}
