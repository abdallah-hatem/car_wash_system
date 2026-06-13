export const PAGE_SIZE = 6

export function pageToRange(page: number, pageSize: number): { from: number; to: number } {
  const from = page * pageSize
  return { from, to: from + pageSize - 1 }
}

export interface PagerInfo {
  fromItem: number
  toItem: number
  total: number
  pageCount: number
  hasPrev: boolean
  hasNext: boolean
}

export function pagerInfo(page: number, pageSize: number, total: number): PagerInfo {
  const pageCount = Math.ceil(total / pageSize)
  const fromItem = total === 0 ? 0 : page * pageSize + 1
  const toItem = total === 0 ? 0 : Math.min(total, (page + 1) * pageSize)
  return { fromItem, toItem, total, pageCount, hasPrev: page > 0, hasNext: page < pageCount - 1 }
}
