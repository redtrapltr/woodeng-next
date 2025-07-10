// src/utils/index.ts

/**
 * Simple `className`‐concat helper.
 * Usage: cn("foo", cond && "bar", "baz") → "foo bar baz"
 */
export function cn(...classes: (string|false|null|undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
