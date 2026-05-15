export interface DashboardData {
  period: {
    month: string
    year: number
    startDate: string
    endDate: string
    daysElapsed: number
    totalDays: number
    percentElapsed: number
  }
  kpis: {
    metaTotal: number
    realizado: number
    percentMeta: number
    gap: number
    totalDealsWon: number
    totalDealsLost: number
    ticketMedio: number
  }
  closers: CloserData[]
  sdrs: SDRData[]
  pacing: PacingDay[]
  motivosPerda: LossReason[]
  lastUpdated: string
}

export interface CloserData {
  id: number
  name: string
  meta: number
  realizado: number
  percent: number
  ganhos: number
  perdidos: number
  deals: DealDetail[]
}

export interface DealDetail {
  id: number
  title: string
  valor: number
  criadoEm: string
  pagoEm: string
  leadTimeDays: number
}

export interface SDRData {
  id: number
  name: string
  nivel: number
  meta: number
  realizado: number
  percent: number
  leadsPerdidos: number
}

export interface PacingDay {
  day: number
  date: string
  acumulado: number
  metaLinear: number
}

export interface LossReason {
  motivo: string
  deals: number
  percent: number
  receitaPerdida: number
}

export interface PipedriveUser {
  id: number
  name: string
  email: string
  active_flag: boolean
}

export interface PipedriveDeal {
  id: number
  title: string
  value: number
  currency: string
  user_id: { id: number; name: string; email: string }
  status: string
  stage_id: number
  pipeline_id: number
  won_time: string | null
  lost_time: string | null
  add_time: string
  close_time: string | null
  lost_reason: string
  org_name: string
  person_name: string
}

export interface PipedriveStage {
  id: number
  name: string
  pipeline_id: number
  order_nr: number
  deal_probability: number
}
