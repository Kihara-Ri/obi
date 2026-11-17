// 待办队列的顺序：等得最久的在最上面（日期从旧到新，同日按记录先后）。
// 用于「售出中」「海外在途」；交易记录、最近签收这类历史列表仍是新的在上。
export function oldestFirst<T extends {date: string; createdAt?: string}>(list: T[]): T[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
}
