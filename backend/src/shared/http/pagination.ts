export function paginate(page = 1, limit = 20): { page: number; limit: number; offset: number } {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

export function paged<T>(data: T[], total: number, page: number, limit: number) {
  return {
    success: true,
    data,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
