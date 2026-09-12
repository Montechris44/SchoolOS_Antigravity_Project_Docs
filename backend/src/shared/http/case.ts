function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

export function toCamelCase<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => toCamelCase(item)) as unknown as T;
  }

  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => [
      snakeToCamelKey(key),
      toCamelCase(val),
    ]);
    return Object.fromEntries(entries) as T;
  }

  return value as T;
}
