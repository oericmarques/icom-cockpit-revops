import { NextResponse } from 'next/server'
import {
  getUsers,
  getWonDeals,
  getLostDeals,
  filterDealsByMonth,
  getMonthRange,
} from '@/lib/pipedrive'
import type { DashboardData, CloserData, DealDetail, PacingDay, LossReason, SDRData } from '@/lib/types'

const CLOSER_IDS: Record<number, string> = {
  23147841: 'Pamela Godoy',
  23147830: 'Larissa',
  25174030: 'Gabriel',
  25825065: 'Renato Ramos',
}

const SDR_IDS: Record<number, { name: string; nivel: number; meta: number }> = {
  23155200: { name: 'Jaqueline', nivel: 3, meta: 68 },
  25190255: { name: 'Duda', nivel: 3, meta: 68 },
  25825087: { name: 'Bruno', nivel: 3, meta: 68 },
}

const PAYMENT_DATE_FIELD = 'c6eef8793beb3bcafb635eb40a717ab40694e961'

const META_TOTAL = 1500000
const META_PER_CLOSER = Math.round(META_TOTAL / Object.keys(CLOSER_IDS).length)

let cachedData: { data: DashboardData; timestamp: number; key: string } | null = null
const CACHE_TTL = 5 * 60 * 1000

function parseDealValue(deal: Record<string, unknown>): number {
  const v = deal.value
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v) || 0
  return 0
}

function getDealOwnerInfo(deal: Record<string, unknown>): { id: number; name: string } {
  const uid = deal.user_id
  if (uid && typeof uid === 'object' && 'id' in (uid as Record<string, unknown>)) {
    const u = uid as { id: number; name: string }
    return { id: u.id, name: u.name }
  }
  return { id: 0, name: 'Desconhecido' }
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a)
  const db = new Date(b)
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86400000))
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function spTimestamp(): string {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const forceRefresh = url.searchParams.has('_t')

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const month = url.searchParams.has('month') ? Number(url.searchParams.get('month')) : now.getMonth() + 1
    const year = url.searchParams.has('year') ? Number(url.searchParams.get('year')) : now.getFullYear()

    const cacheKey = `${year}-${month}`
    if (!forceRefresh && cachedData && cachedData.key === cacheKey && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return NextResponse.json(cachedData.data)
    }
    const { totalDays, daysElapsed } = getMonthRange(year, month)

    const [, allWonDeals, allLostDeals] = await Promise.all([
      getUsers(),
      getWonDeals(),
      getLostDeals(),
    ])

    const wonDeals = filterDealsByMonth(allWonDeals, PAYMENT_DATE_FIELD, year, month)
    const lostDeals = filterDealsByMonth(allLostDeals, 'lost_time', year, month)

    const closerMap = new Map<number, CloserData>()
    for (const [idStr, name] of Object.entries(CLOSER_IDS)) {
      const id = Number(idStr)
      closerMap.set(id, { id, name, meta: META_PER_CLOSER, realizado: 0, percent: 0, ganhos: 0, perdidos: 0, deals: [] })
    }

    let totalRealizado = 0
    let totalWon = 0
    let closerRealizado = 0
    let closerWon = 0

    for (const deal of wonDeals) {
      const owner = getDealOwnerInfo(deal)
      const value = parseDealValue(deal)
      totalRealizado += value
      totalWon++

      if (closerMap.has(owner.id)) {
        const closer = closerMap.get(owner.id)!
        closer.realizado += value
        closer.ganhos++
        closerRealizado += value
        closerWon++

        const payDate = (deal[PAYMENT_DATE_FIELD] ?? deal.won_time ?? deal.close_time ?? '') as string

        closer.deals.push({
          id: deal.id as number,
          title: deal.title as string,
          valor: value,
          criadoEm: formatDateBR(deal.add_time as string),
          pagoEm: formatDateBR(payDate),
          leadTimeDays: daysBetween(deal.add_time as string, (deal.won_time ?? deal.close_time ?? deal.add_time) as string),
        })
      }
    }

    for (const deal of lostDeals) {
      const owner = getDealOwnerInfo(deal)
      if (closerMap.has(owner.id)) {
        closerMap.get(owner.id)!.perdidos++
      }
    }

    const closers = Array.from(closerMap.values()).sort((a, b) => b.realizado - a.realizado)
    for (const c of closers) {
      c.percent = c.meta > 0 ? (c.realizado / c.meta) * 100 : 0
      c.deals.sort((a, b) => b.valor - a.valor)
    }

    const sdrMap = new Map<number, SDRData>()
    for (const [idStr, info] of Object.entries(SDR_IDS)) {
      const id = Number(idStr)
      sdrMap.set(id, { id, name: info.name, nivel: info.nivel, meta: info.meta, realizado: 0, percent: 0, leadsPerdidos: 0 })
    }
    for (const deal of lostDeals) {
      const owner = getDealOwnerInfo(deal)
      if (sdrMap.has(owner.id)) {
        sdrMap.get(owner.id)!.leadsPerdidos++
      }
    }
    const sdrs = Array.from(sdrMap.values()).sort((a, b) => b.realizado - a.realizado)

    const ticketMedio = closerWon > 0 ? Math.round(closerRealizado / closerWon) : 0
    const percentMeta = META_TOTAL > 0 ? (closerRealizado / META_TOTAL) * 100 : 0
    const percentElapsed = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0

    const dealsByDay = new Map<number, number>()
    for (const deal of wonDeals) {
      const payDate = (deal[PAYMENT_DATE_FIELD] ?? deal.won_time ?? deal.close_time) as string
      if (!payDate) continue
      const owner = getDealOwnerInfo(deal)
      if (!closerMap.has(owner.id)) continue
      const d = new Date(payDate)
      dealsByDay.set(d.getDate(), (dealsByDay.get(d.getDate()) ?? 0) + parseDealValue(deal))
    }

    const pacing: PacingDay[] = []
    const dailyMeta = META_TOTAL / totalDays
    let acumulado = 0
    for (let d = 1; d <= totalDays; d++) {
      if (d <= daysElapsed) acumulado += dealsByDay.get(d) ?? 0
      pacing.push({
        day: d,
        date: `${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
        acumulado: d <= daysElapsed ? acumulado : -1,
        metaLinear: Math.round(dailyMeta * d),
      })
    }

    const lossReasonMap = new Map<string, { deals: number; receita: number }>()
    for (const deal of lostDeals) {
      const reason = ((deal.lost_reason as string) || 'Sem motivo informado').trim()
      const existing = lossReasonMap.get(reason) ?? { deals: 0, receita: 0 }
      existing.deals++
      existing.receita += parseDealValue(deal)
      lossReasonMap.set(reason, existing)
    }

    const totalLost = lostDeals.length
    const motivosPerda: LossReason[] = Array.from(lossReasonMap.entries())
      .map(([motivo, d]) => ({
        motivo,
        deals: d.deals,
        percent: totalLost > 0 ? (d.deals / totalLost) * 100 : 0,
        receitaPerdida: d.receita,
      }))
      .sort((a, b) => b.deals - a.deals)
      .slice(0, 15)

    const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

    const result: DashboardData = {
      period: {
        month: monthNames[month - 1],
        year,
        startDate: `${year}-${String(month).padStart(2, '0')}-01`,
        endDate: `${year}-${String(month).padStart(2, '0')}-${totalDays}`,
        daysElapsed,
        totalDays,
        percentElapsed: Math.round(percentElapsed * 10) / 10,
      },
      kpis: {
        metaTotal: META_TOTAL,
        realizado: closerRealizado,
        percentMeta: Math.round(percentMeta * 100) / 100,
        gap: META_TOTAL - closerRealizado,
        totalDealsWon: closerWon,
        totalDealsLost: totalLost,
        ticketMedio,
      },
      closers,
      sdrs,
      pacing,
      motivosPerda,
      lastUpdated: spTimestamp(),
    }

    cachedData = { data: result, timestamp: Date.now(), key: cacheKey }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Falha ao buscar dados do Pipedrive', details: String(error) },
      { status: 500 }
    )
  }
}
