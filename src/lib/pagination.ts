export const DEFAULT_PAGE_SIZE = 20;

export function parsePage(pageParam?: string): number {
  return Math.max(1, Number(pageParam) || 1);
}

export function paginationSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function totalPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
