const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN!
const BASE_URL = 'https://api.pipedrive.com/v1'

async function apiGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('api_token', API_TOKEN)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Pipedrive API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

interface PipedriveResponse<T> {
  success: boolean
  data: T[] | null
  additional_data?: { pagination?: { more_items_in_collection: boolean; next_start: number } }
}

async function fetchAllPages<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
  const all: T[] = []
  let start = 0
  const limit = '500'

  while (true) {
    const res = await apiGet<PipedriveResponse<T>>(endpoint, { ...params, limit, start: String(start) })
    if (!res.data || res.data.length === 0) break
    all.push(...res.data)
    if (!res.additional_data?.pagination?.more_items_in_collection) break
    start = res.additional_data.pagination.next_start
  }
  return all
}

export async function getUsers() {
  const res = await apiGet<PipedriveResponse<{ id: number; name: string; email: string; active_flag: boolean }>>('/users')
  return res.data ?? []
}

export async function getStages() {
  const res = await apiGet<PipedriveResponse<{ id: number; name: string; pipeline_id: number; order_nr: number; deal_probability: number }>>('/stages')
  return res.data ?? []
}

export async function getWonDeals(): Promise<Record<string, unknown>[]> {
  return fetchAllPages('/deals', { status: 'won', sort: 'won_time DESC' })
}

export async function getLostDeals(): Promise<Record<string, unknown>[]> {
  return fetchAllPages('/deals', { status: 'lost', sort: 'lost_time DESC' })
}

export async function getOpenDeals(pipelineId: number): Promise<Record<string, unknown>[]> {
  return fetchAllPages('/deals', { status: 'open', pipeline_id: String(pipelineId) })
}

export async function getDealsSummary(startDate: string, endDate: string) {
  return apiGet<{ success: boolean; data: Record<string, unknown> }>('/deals/summary', {
    status: 'won',
    start_date: startDate,
    close_date: endDate,
  })
}

export function filterDealsByMonth(deals: Record<string, unknown>[], dateField: string, year: number, month: number) {
  return deals.filter(d => {
    const dateStr = d[dateField] as string | null
    if (!dateStr) return false
    const date = new Date(dateStr)
    return date.getFullYear() === year && date.getMonth() === month - 1
  })
}

export function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  const now = new Date()
  const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const daysElapsed = today.getMonth() === month - 1 && today.getFullYear() === year
    ? today.getDate()
    : end.getDate()
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    totalDays: end.getDate(),
    daysElapsed: Math.min(daysElapsed, end.getDate()),
  }
}
