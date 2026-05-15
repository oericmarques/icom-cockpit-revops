'use client'

import { useEffect, useState, useCallback, Fragment, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Cell, PieChart, Pie, Legend,
} from 'recharts'
import {
  LayoutDashboard, Target, Headphones, FileText, XCircle,
  RefreshCw, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Clock,
} from 'lucide-react'
import type { DashboardData, CloserData, DealDetail } from '@/lib/types'

type View = 'overview' | 'closers' | 'sdrs' | 'negocios' | 'perdas'

const C = {
  navy950: '#040e1a', navy900: '#071a33', navy800: '#0d2744', navy700: '#133a5c',
  navy600: '#1a5bb5', navy500: '#2d7ff9', navy400: '#5a9dff', navy200: '#b3d4ff',
  gold: '#ECBA62', ok: '#059669', warn: '#f59e0b', bad: '#ef4444',
}

function fmt(v: number) {
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toFixed(2).replace('.', ',')}M`
  if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}
function fmtN(v: number) { return `R$ ${Math.round(v).toLocaleString('pt-BR')}` }
function pct(v: number) { return `${v.toFixed(1).replace('.', ',')}%` }
function statusColor(p: number) { return p >= 80 ? C.ok : p >= 40 ? C.warn : C.bad }

function IcomLogo({ className = '' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 667 160">
      <path fill="currentColor" d="M266.5 7.5c5-5 11-7.5 18-7.5h120c7.2 0 13.2 2.5 18.2 7.5s7.5 11 7.5 18V128c0 7-2.5 13-7.5 18-4.9 5-10.9 7.5-18.1 7.5h-120c-7.1 0-13.1-2.4-18.1-7.4-5-5-7.5-11-7.5-18.1V25.5c0-7.1 2.5-13.1 7.5-18.1m129.4 118.2a7.3 7.3 0 0 0 2.3-5.4v-87c0-2.1-.8-4-2.3-5.4a7.3 7.3 0 0 0-5.4-2.3h-91.8c-2.2 0-4 .8-5.4 2.3a7.3 7.3 0 0 0-2.3 5.4v87c0 2 .8 3.9 2.3 5.4a7.3 7.3 0 0 0 5.4 2.3h91.8c2.3 0 4.1-.8 5.4-2.3M637.3 0c6.8 0 12.6 2.3 17.4 6.8a27.8 27.8 0 0 1 8.2 20.3v126.5h-32V33.3c0-2.1-.7-4-2.2-5.5a7.3 7.3 0 0 0-5.5-2.2h-47v128h-31.9V33.2c0-2.1-.8-4-2.3-5.5a7.3 7.3 0 0 0-5.4-2.2h-46.9v128h-13.5a18.4 18.4 0 0 1-18.4-18.5V0h179.5ZM199.5 120.7c0 2.1-.8 4-2.3 5.4a7 7 0 0 1-5.4 2.3H99.7c-2.2 0-4-.8-5.5-2.3a7.6 7.6 0 0 1-2.2-5.4V33.4c0-2.2.7-4 2.2-5.5a7.3 7.3 0 0 1 5.5-2.2h92.1c2.1 0 4 .7 5.4 2.2a7.5 7.5 0 0 1 2.3 5.5v11.5h32V25.7c0-7.1-2.4-13.2-7.4-18.2S213 0 205.9 0H85.5c-7.1 0-13.2 2.5-18.2 7.5s-7.5 11-7.5 18.2v102.7c0 7.1 2.6 13.2 7.6 18.1 5 5 11 7.6 18.1 7.6H206a24 24 0 0 0 18.2-7.6c5-5 7.5-11 7.5-18.1V109h-32.1v11.6ZM32.4 153.6H6.1a6 6 0 0 1-6.1-6.1V6.8a6 6 0 0 1 6-6h26.4v152.8Z"/>
      <path fill="#ECBA62" d="M214.9 61 199 88h33l-17.1-27Z"/>
    </svg>
  )
}

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'closers', label: 'Closers', icon: Target },
  { id: 'sdrs', label: 'SDRs', icon: Headphones },
  { id: 'negocios', label: 'Negocios', icon: FileText },
  { id: 'perdas', label: 'Perdas', icon: XCircle },
]

const CHART_COLORS = [C.navy500, C.gold, C.ok, C.warn, '#8b5cf6', '#ec4899', C.navy400, '#14b8a6', '#f97316', '#6366f1']

/* ── OVERVIEW ─────────────────────────────────────────── */
function OverviewView({ data }: { data: DashboardData }) {
  const { kpis, closers, pacing, period, productMix, channelMix, sdrOrigin } = data
  const pacingData = pacing.map(p => ({ ...p, acumulado: p.acumulado >= 0 ? p.acumulado : undefined }))
  const metaChart = closers.map(c => ({
    name: c.name.split(' ')[0], meta: c.meta, realizado: c.realizado, pct: c.percent,
  }))
  const winRate = kpis.totalDealsWon + kpis.totalDealsLost > 0
    ? (kpis.totalDealsWon / (kpis.totalDealsWon + kpis.totalDealsLost)) * 100 : 0

  const topProducts = productMix.slice(0, 8)
  const topChannels = channelMix.slice(0, 10)

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Realizado', value: fmt(kpis.realizado), sub: `${pct(kpis.percentMeta)} da meta`, icon: TrendingUp, color: statusColor(kpis.percentMeta) },
          { label: 'Gap para Meta', value: fmt(kpis.gap), sub: `Meta: ${fmt(kpis.metaTotal)}`, icon: Target, color: kpis.gap > 0 ? C.bad : C.ok },
          { label: 'Deals Ganhos', value: String(kpis.totalDealsWon), sub: `Ticket medio: ${fmtN(kpis.ticketMedio)}`, icon: TrendingUp, color: C.ok },
          { label: 'Win Rate', value: pct(winRate), sub: `${kpis.totalDealsLost} perdidos`, icon: TrendingDown, color: winRate > 10 ? C.warn : C.bad },
        ].map((kpi, i) => (
          <div key={kpi.label} className={`animate-in animate-in-${i + 1} bg-white rounded-xl p-5 shadow-xs border border-gray-100 relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-1 h-full rounded-r" style={{ background: kpi.color }} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{kpi.label}</p>
                <p className="text-2xl font-extrabold mt-1 text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{kpi.sub}</p>
              </div>
              <kpi.icon className="w-5 h-5 mt-1" style={{ color: kpi.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Pacing */}
      <div className="bg-white rounded-xl p-5 shadow-xs border border-gray-100 animate-in" style={{ animationDelay: '250ms' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Pacing Mensal</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={pacingData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: unknown) => fmt(Number(v))} width={70} />
            <Tooltip formatter={(v: unknown, n: unknown) => [fmtN(Number(v)), n === 'acumulado' ? 'Realizado' : 'Meta']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="metaLinear" stroke={C.bad} strokeDasharray="6 4" strokeWidth={1.5} dot={false} name="Meta Linear" />
            <Line type="monotone" dataKey="acumulado" stroke={C.navy500} strokeWidth={2.5} dot={false} connectNulls={false} name="Realizado" />
            <ReferenceLine x={`${String(period.daysElapsed).padStart(2, '0')}/${String(pacing[0]?.date.split('/')[1])}`} stroke={C.gold} strokeDasharray="3 3" label={{ value: 'Hoje', fill: C.gold, fontSize: 10 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Meta vs Realizado por Closer */}
      <div className="bg-white rounded-xl p-5 shadow-xs border border-gray-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Meta vs Realizado por Closer</h3>
        <div className="space-y-3">
          {metaChart.map((c, i) => (
            <div key={c.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">{fmt(c.realizado)} / {fmt(c.meta)}</span>
                  <span className="font-bold" style={{ color: statusColor(c.pct) }}>{pct(c.pct)}</span>
                </div>
              </div>
              <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, c.pct)}%`, background: statusColor(c.pct) }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400/60" style={{ left: '100%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Produto + Canal side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Venda por Produto */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Receita por Produto</h3>
          <ResponsiveContainer width="100%" height={topProducts.length * 36 + 20}>
            <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: unknown) => fmt(Number(v))} />
              <YAxis dataKey="produto" type="category" tick={{ fontSize: 10, fill: '#6b7280' }} width={120} />
              <Tooltip formatter={(v: unknown) => fmtN(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="receita" name="Receita" radius={[0, 4, 4, 0]}>
                {topProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Venda por Canal/Origem */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Receita por Canal de Origem</h3>
          <ResponsiveContainer width="100%" height={topChannels.length * 36 + 20}>
            <BarChart data={topChannels} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: unknown) => fmt(Number(v))} />
              <YAxis dataKey="canal" type="category" tick={{ fontSize: 10, fill: '#6b7280' }} width={140} />
              <Tooltip formatter={(v: unknown) => fmtN(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="receita" name="Receita" radius={[0, 4, 4, 0]}>
                {topChannels.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Origem por SDR */}
      <div className="bg-white rounded-xl p-5 shadow-xs border border-gray-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Receita por SDR de Origem</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sdrOrigin} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="sdr" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: unknown) => fmt(Number(v))} width={65} />
            <Tooltip formatter={(v: unknown) => fmtN(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="receita" name="Receita" radius={[4, 4, 0, 0]}>
              {sdrOrigin.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ── CLOSERS ──────────────────────────────────────────── */
function ClosersView({ data }: { data: DashboardData }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const { closers, period } = data
  const max = Math.max(...closers.map(c => Math.max(c.realizado, c.meta)))

  return (
    <div className="space-y-4">
      {closers.map((c, i) => {
        const pctBar = max > 0 ? Math.min(100, (c.realizado / max) * 100) : 0
        const metaBar = max > 0 ? Math.min(100, (c.meta / max) * 100) : 0
        const isOpen = expanded === c.id
        return (
          <div key={c.id} className={`animate-in animate-in-${i + 1} bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden`}>
            <div className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => setExpanded(isOpen ? null : c.id)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: statusColor(c.percent) }}>
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.ganhos} ganhos . {c.perdidos} perdidos</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-gray-900">{fmtN(c.realizado)}</p>
                    <p className="text-xs" style={{ color: statusColor(c.percent) }}>{pct(c.percent)} da meta</p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${pctBar}%`, background: `linear-gradient(90deg, ${statusColor(c.percent)}, ${statusColor(c.percent)}cc)` }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400" style={{ left: `${metaBar}%` }} title={`Meta: ${fmtN(c.meta)}`} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400">R$ 0</span>
                <span className="text-[10px] text-gray-400">Meta: {fmt(c.meta)}</span>
              </div>
            </div>

            {isOpen && c.deals.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['Negocio', 'Valor', 'Criado', 'Pago', 'Lead Time'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.deals.map(d => (
                      <tr key={d.id} className="border-b border-gray-100 last:border-0 hover:bg-white/60">
                        <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[250px] truncate">{d.title}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-900">{fmtN(d.valor)}</td>
                        <td className="px-4 py-2.5 text-gray-500">{d.criadoEm}</td>
                        <td className="px-4 py-2.5 text-gray-500">{d.pagoEm}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: d.leadTimeDays <= 7 ? C.ok : d.leadTimeDays <= 30 ? C.warn : C.bad }}>
                            <Clock className="w-3 h-3" /> {d.leadTimeDays}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── SDRs ─────────────────────────────────────────────── */
function SDRsView({ data }: { data: DashboardData }) {
  const { sdrs } = data
  const maxLeads = Math.max(...sdrs.map(s => s.leadsPerdidos), 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {sdrs.map((s, i) => (
          <div key={s.id} className={`animate-in animate-in-${i + 1} bg-white rounded-xl p-5 shadow-xs border border-gray-100`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: C.navy600 }}>
                {s.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-500">Nivel {s.nivel}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Meta agendamentos</span>
                  <span className="font-bold text-gray-900">{s.meta}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Leads perdidos</span>
                  <span className="font-bold" style={{ color: C.bad }}>{s.leadsPerdidos}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.leadsPerdidos / maxLeads) * 100}%`, background: C.bad }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-xs border border-gray-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Volume de Leads por SDR</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sdrs.map(s => ({ name: s.name, perdidos: s.leadsPerdidos, meta: s.meta }))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="meta" name="Meta" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="perdidos" name="Leads Perdidos" fill={C.bad} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ── NEGOCIOS ─────────────────────────────────────────── */
function NegociosView({ data, closerFilter }: { data: DashboardData; closerFilter: string }) {
  const [sortField, setSortField] = useState<'valor' | 'leadTimeDays'>('valor')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const allDeals = useMemo(() => {
    const deals: (DealDetail & { closerName: string })[] = []
    for (const c of data.closers) {
      if (closerFilter !== 'all' && c.name !== closerFilter) continue
      for (const d of c.deals) {
        deals.push({ ...d, closerName: c.name })
      }
    }
    deals.sort((a, b) => sortDir === 'desc' ? b[sortField] - a[sortField] : a[sortField] - b[sortField])
    return deals
  }, [data, closerFilter, sortField, sortDir])

  type DealWithCloser = (typeof allDeals)[number]

  function toggleSort(field: 'valor' | 'leadTimeDays') {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortField(field); setSortDir('desc') }
  }

  const sortIcon = (field: string) => sortField === field ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden animate-in">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">{allDeals.length} negocios fechados</h3>
        <p className="text-xs text-gray-400">Total: <span className="font-bold text-gray-900">{fmtN(allDeals.reduce((s, d) => s + d.valor, 0))}</span></p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Closer</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Negocio</th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort('valor')}>
                Valor{sortIcon('valor')}
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Criado</th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Pago</th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort('leadTimeDays')}>
                Lead Time{sortIcon('leadTimeDays')}
              </th>
            </tr>
          </thead>
          <tbody>
            {allDeals.map(d => (
              <tr key={d.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: statusColor(data.closers.find(c => c.name === d.closerName)?.percent ?? 0) }} />
                    <span className="font-medium text-gray-700">{d.closerName.split(' ')[0]}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-800 max-w-[280px] truncate">{d.title}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtN(d.valor)}</td>
                <td className="px-4 py-3 text-center text-gray-500">{d.criadoEm}</td>
                <td className="px-4 py-3 text-center text-gray-500">{d.pagoEm}</td>
                <td className="px-4 py-3 text-center">
                  <span className="font-medium" style={{ color: d.leadTimeDays <= 7 ? C.ok : d.leadTimeDays <= 30 ? C.warn : C.bad }}>
                    {d.leadTimeDays}d
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── PERDAS ───────────────────────────────────────────── */
function PerdasView({ data }: { data: DashboardData }) {
  const { motivosPerda, kpis } = data
  const totalReceita = motivosPerda.reduce((s, m) => s + m.receitaPerdida, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Perdidos', value: String(kpis.totalDealsLost), color: C.bad },
          { label: 'Receita Perdida', value: fmtN(totalReceita), color: C.warn },
          { label: 'Motivos Mapeados', value: String(motivosPerda.length), color: C.navy500 },
        ].map((k, i) => (
          <div key={k.label} className={`animate-in animate-in-${i + 1} bg-white rounded-xl p-5 shadow-xs border border-gray-100`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{k.label}</p>
            <p className="text-2xl font-extrabold mt-1 text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-xs border border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Receita Perdida por Motivo</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={motivosPerda.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: unknown) => fmt(Number(v))} />
              <YAxis dataKey="motivo" type="category" tick={{ fontSize: 10, fill: '#6b7280' }} width={140} />
              <Tooltip formatter={(v: unknown) => fmtN(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="receitaPerdida" fill={C.bad} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-xs border border-gray-100 overflow-auto max-h-[420px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Detalhamento</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Motivo</th>
                <th className="pb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">Qty</th>
                <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Receita</th>
              </tr>
            </thead>
            <tbody>
              {motivosPerda.map((m, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2.5 text-gray-800 pr-3">{m.motivo}</td>
                  <td className="py-2.5 text-center font-bold text-gray-700">{m.deals}</td>
                  <td className="py-2.5 text-right font-medium" style={{ color: m.receitaPerdida > 100000 ? C.bad : '#6b7280' }}>{fmtN(m.receitaPerdida)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── MAIN DASHBOARD ───────────────────────────────────── */

export default function Dashboard() {
  const now = new Date()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('overview')
  const [closerFilter, setCloserFilter] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard?_t=${Date.now()}&month=${selectedMonth}&year=${selectedYear}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [selectedMonth, selectedYear])

  useEffect(() => { fetchData() }, [fetchData])

  if (!data && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.navy950 }}>
        <div className="text-center">
          <IcomLogo className="w-32 mx-auto mb-6 text-white" />
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
          <p className="text-xs text-gray-500 mt-3">Conectando ao Pipedrive...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.navy950 }}>
        <div className="bg-white rounded-xl p-8 max-w-sm w-full text-center">
          <p className="text-red-600 font-bold mb-2">Erro ao carregar</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={fetchData} className="px-5 py-2 bg-navy-500 text-white text-sm rounded-lg font-semibold" style={{ background: C.navy500 }}>Tentar novamente</button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const viewTitle: Record<View, string> = {
    overview: 'Overview', closers: 'Performance Closers',
    sdrs: 'Pre-Vendas (SDRs)', negocios: 'Negocios Fechados', perdas: 'Analise de Perdas',
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside className="w-[240px] flex-shrink-0 flex flex-col text-white overflow-y-auto" style={{ background: C.navy900 }}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <IcomLogo className="w-28 text-white" />
          <p className="text-[10px] uppercase tracking-[3px] mt-2" style={{ color: C.gold }}>Cockpit RevOps Comercial</p>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 space-y-0.5">
          {NAV.map(n => {
            const active = view === n.id
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                style={active ? { background: `${C.navy500}22`, borderLeft: `3px solid ${C.navy500}` } : { borderLeft: '3px solid transparent' }}
              >
                <n.icon className="w-4 h-4" style={active ? { color: C.navy500 } : undefined} />
                {n.label}
              </button>
            )
          })}
        </nav>

        {/* Ranking Closers */}
        <div className="px-5 mt-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: C.gold }}>Ranking Closers</p>
          <div className="space-y-2.5">
            {data.closers.map((c, i) => {
              const max = data.closers[0]?.realizado || 1
              return (
                <button key={c.id} onClick={() => { setView('closers'); setCloserFilter(c.name) }} className="w-full text-left group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold w-3" style={{ color: C.gold }}>{i + 1}</span>
                    <span className="text-xs text-gray-300 group-hover:text-white truncate flex-1">{c.name.split(' ')[0]}</span>
                    <span className="text-[10px] font-bold text-gray-400">{fmt(c.realizado)}</span>
                  </div>
                  <div className="ml-5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.realizado / max) * 100}%`, background: statusColor(c.percent) }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Ranking SDRs */}
        <div className="px-5 mt-5">
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: C.gold }}>SDRs</p>
          <div className="space-y-1.5">
            {data.sdrs.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{s.name}</span>
                <span className="text-[10px] font-bold text-gray-500">{s.leadsPerdidos} leads</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-5 py-4 border-t border-white/10">
          <p className="text-[9px] uppercase tracking-widest text-gray-500">Atualizado</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{data.lastUpdated}</p>
          <p className="text-[9px] text-gray-600 mt-0.5">Horario de Sao Paulo</p>
        </div>
      </aside>

      {/* ── CONTENT ── */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: '#f1f3f7' }}>
        {/* Top bar */}
        <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-900">{viewTitle[view]}</h1>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{data.period.month} {data.period.year}</span>
            <span className="text-[10px] text-gray-400">{data.period.daysElapsed}/{data.period.totalDays} dias ({pct(data.period.percentElapsed)})</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={e => { const [y, m] = e.target.value.split('-').map(Number); setSelectedYear(y); setSelectedMonth(m) }}
              className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const m = now.getMonth() - i
                const d = new Date(now.getFullYear(), m, 1)
                const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                return <option key={i} value={`${d.getFullYear()}-${d.getMonth() + 1}`}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
              })}
            </select>
            <select
              value={closerFilter}
              onChange={e => setCloserFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Todos os Closers</option>
              {data.closers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>

            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-60"
              style={{ background: C.navy500 }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'overview' && <OverviewView data={data} />}
          {view === 'closers' && <ClosersView data={data} />}
          {view === 'sdrs' && <SDRsView data={data} />}
          {view === 'negocios' && <NegociosView data={data} closerFilter={closerFilter} />}
          {view === 'perdas' && <PerdasView data={data} />}
        </div>
      </main>
    </div>
  )
}
