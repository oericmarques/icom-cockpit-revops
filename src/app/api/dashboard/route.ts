import { NextResponse } from 'next/server'
import {
  getUsers,
  getWonDeals,
  getLostDeals,
  filterDealsByMonth,
  getMonthRange,
} from '@/lib/pipedrive'
import type { DashboardData, CloserData, DealDetail, PacingDay, LossReason, SDRData, ProductMix, ChannelMix, SDROrigin } from '@/lib/types'

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
const PRODUCT_FIELD = '46a4f1de10521e00da7ab44592dc00cc019ae422'
const SDR_FIELD = '33ff3a6340bb802cbdb7998f70b135e290bd6815'

const CHANNEL_NAMES: Record<string, string> = {
  '3': 'Web Forms', '4': 'Teste IA', '7': 'Campaigns', '8': 'Campanha de Marketing',
  '54': 'Indicacao Select', '55': 'Indicacao SO', '59': 'Mkt Pro Renovacao',
  '60': 'Insta Lu', '61': 'Insta Fabio', '62': 'Clientes Agencia',
  '63': 'Indicacao Agencia', '64': 'Whatsapp Direto', '65': 'SOAPP',
  '66': 'Indicacao ICOMTV', '67': 'Indicacao Infinity',
  '74': 'Base - Double SO + MKT PRO', '75': 'Base - Select',
  '76': 'Base - MKT PRO 1.0', '77': 'Base - ICOMTV', '78': 'Base - MKT PRO 2.0',
  '86': 'Bonus CRC PRO', '100': 'MKT 2024', '101': 'ORAL UNIC',
  '104': 'Formulario IG', '121': 'Live Clinicorp', '122': 'Leads ICOMMKTPRES',
  '125': 'Reunioes Closer', '140': 'Indicacao Interna', '177': 'Live IA Video',
  '184': 'Base Combo', '189': 'Celular Agencia', '192': 'Vendedor Externo', '198': 'Comercial',
}

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

    const productMap = new Map<string, { deals: number; receita: number }>()
    const channelMap = new Map<string, { deals: number; receita: number }>()
    const sdrOriginMap = new Map<string, { deals: number; receita: number }>()

    for (const deal of wonDeals) {
      const owner = getDealOwnerInfo(deal)
      if (!closerMap.has(owner.id)) continue
      const value = parseDealValue(deal)

      const prod = ((deal[PRODUCT_FIELD] as string) || 'Sem produto').trim()
      const pNorm = prod === '0' || prod === '' ? 'Sem produto' : prod
      const pe = productMap.get(pNorm) ?? { deals: 0, receita: 0 }
      pe.deals++; pe.receita += value
      productMap.set(pNorm, pe)

      const ch = String(deal.channel ?? '')
      const chName = CHANNEL_NAMES[ch] || (ch ? `Canal ${ch}` : 'Sem canal')
      const ce = channelMap.get(chName) ?? { deals: 0, receita: 0 }
      ce.deals++; ce.receita += value
      channelMap.set(chName, ce)

      const sdrObj = deal[SDR_FIELD] as { name?: string } | null
      const sdrName = sdrObj?.name || 'Sem SDR'
      const se = sdrOriginMap.get(sdrName) ?? { deals: 0, receita: 0 }
      se.deals++; se.receita += value
      sdrOriginMap.set(sdrName, se)
    }

    const productMix: ProductMix[] = Array.from(productMap.entries())
      .map(([produto, d]) => ({ produto, deals: d.deals, receita: d.receita, percent: closerRealizado > 0 ? (d.receita / closerRealizado) * 100 : 0 }))
      .sort((a, b) => b.receita - a.receita)

    const channelMix: ChannelMix[] = Array.from(channelMap.entries())
      .map(([canal, d]) => ({ canal, deals: d.deals, receita: d.receita, percent: closerRealizado > 0 ? (d.receita / closerRealizado) * 100 : 0 }))
      .sort((a, b) => b.receita - a.receita)

    const sdrOrigin: SDROrigin[] = Array.from(sdrOriginMap.entries())
      .map(([sdr, d]) => ({ sdr, deals: d.deals, receita: d.receita }))
      .sort((a, b) => b.receita - a.receita)

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
      productMix,
      channelMix,
      sdrOrigin,
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
