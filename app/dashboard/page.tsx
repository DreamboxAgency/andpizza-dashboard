'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import Nav from '../../components/Nav'

const CLIENT_ID_PLACEHOLDER = 'YOUR_CLIENT_UUID' // replaced via env or lookup

function fmt(n: number | null, prefix = '', suffix = '', decimals = 1) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M${suffix}`
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K${suffix}`
  return `${prefix}${n.toFixed(decimals)}${suffix}`
}

function delta(current: number | null, previous: number | null) {
  if (!current || !previous) return null
  return ((current - previous) / previous) * 100
}

const PLATFORM_COLORS: Record<string, string> = {
  meta: '#60a5fa',
  search: '#4ade80',
  amazon_dsp: '#fbbf24',
  pmax: '#c084fc',
}

const MONTH_LABELS: Record<string, string> = {
  '2025-12-01': 'Dec',
  '2026-01-01': 'Jan',
  '2026-02-01': 'Feb',
  '2026-03-01': 'Mar',
}

export default function DashboardPage() {
  const [summaries, setSummaries] = useState<any[]>([])
  const [platforms, setPlatforms] = useState<any[]>([])
  const [insights, setInsights] = useState<any[]>([])
  const [clientId, setClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeMonth, setActiveMonth] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // Get client ID for &Pizza
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', 'andpizza')
        .single()

      if (!client) return
      setClientId(client.id)

      const [s, p, i] = await Promise.all([
        supabase.from('monthly_summaries')
          .select('*').eq('client_id', client.id)
          .order('report_month', { ascending: true }),
        supabase.from('platform_monthly')
          .select('*').eq('client_id', client.id)
          .order('report_month', { ascending: true }),
        supabase.from('monthly_insights')
          .select('*').eq('client_id', client.id)
          .order('report_month', { ascending: false })
          .limit(6),
      ])

      setSummaries(s.data || [])
      setPlatforms(p.data || [])
      setInsights(i.data || [])
      if (s.data?.length) setActiveMonth(s.data[s.data.length - 1].report_month)
      setLoading(false)
    }
    load()
  }, [])

  const latest = summaries[summaries.length - 1]
  const previous = summaries[summaries.length - 2]

  const spendByMonth = summaries.map(s => ({
    month: MONTH_LABELS[s.report_month] || s.report_month,
    spend: s.total_spend,
    roas: s.purchase_roas,
    store_visits: s.tracked_store_visits,
    purchases: s.tracked_online_purchases,
  }))

  const platformByMonth = ['meta', 'search', 'amazon_dsp', 'pmax'].map(plt => {
    const row: any = { platform: plt.replace('_', ' ').toUpperCase() }
    summaries.forEach(s => {
      const p = platforms.find(p => p.report_month === s.report_month && p.platform === plt)
      const label = MONTH_LABELS[s.report_month] || s.report_month
      row[label] = p?.spend || 0
    })
    return row
  })

  const monthLabels = summaries.map(s => MONTH_LABELS[s.report_month] || s.report_month)

  const spendChartData = summaries.map(s => {
    const row: any = { month: MONTH_LABELS[s.report_month] || s.report_month }
    platforms.filter(p => p.report_month === s.report_month).forEach(p => {
      row[p.platform] = p.spend || 0
    })
    return row
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="loading-pulse" style={{ color: '#E8272A', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', fontSize: '1.2rem' }}>
          LOADING DATA
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0F0F0F' }}>
      <Nav active="dashboard" />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="stat-label" style={{ marginBottom: 4 }}>PAID MEDIA INTELLIGENCE</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', letterSpacing: '0.06em', lineHeight: 1, color: '#E8E8E8' }}>
              &PIZZA
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="stat-label">REPORTING PERIOD</p>
            <p style={{ color: '#A0A0A0', fontSize: '0.9rem' }}>
              Dec 2025 — Mar 2026
            </p>
          </div>
        </div>

        {/* Top KPI cards */}
        {latest && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[
              { label: 'Total Spend', value: fmt(latest.total_spend, '$'), d: delta(latest.total_spend, previous?.total_spend) },
              { label: 'Purchase ROAS', value: latest.purchase_roas ? `${latest.purchase_roas.toFixed(1)}%` : '—', d: delta(latest.purchase_roas, previous?.purchase_roas) },
              { label: 'Online Purchases', value: fmt(latest.tracked_online_purchases), d: delta(latest.tracked_online_purchases, previous?.tracked_online_purchases) },
              { label: 'Store Visits', value: fmt(latest.tracked_store_visits), d: delta(latest.tracked_store_visits, previous?.tracked_store_visits) },
              { label: 'Total Impressions', value: fmt(latest.total_impressions), d: delta(latest.total_impressions, previous?.total_impressions) },
              { label: 'Cost / Acquisition', value: fmt(latest.cost_per_acquisition, '$'), d: delta(latest.cost_per_acquisition, previous?.cost_per_acquisition), invertDelta: true },
            ].map(card => (
              <div key={card.label} className="stat-card slide-up">
                <p className="stat-label">{card.label}</p>
                <p className="stat-value">{card.value}</p>
                {card.d != null && (
                  <p className={card.invertDelta ? (card.d < 0 ? 'stat-delta-up' : 'stat-delta-down') : (card.d >= 0 ? 'stat-delta-up' : 'stat-delta-down')}
                    style={{ marginTop: 6 }}>
                    {card.d >= 0 ? '↑' : '↓'} {Math.abs(card.d).toFixed(1)}% MoM
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>

          {/* ROAS trend */}
          <div className="stat-card">
            <p className="section-title" style={{ marginBottom: 20, fontSize: '1rem' }}>PURCHASE ROAS</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={spendByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                <XAxis dataKey="month" tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 6 }}
                  labelStyle={{ color: '#A0A0A0', fontSize: 11 }}
                  itemStyle={{ color: '#E8272A' }}
                  formatter={(v: any) => [`${v.toFixed(1)}%`, 'ROAS']}
                />
                <Line type="monotone" dataKey="roas" stroke="#E8272A" strokeWidth={2} dot={{ fill: '#E8272A', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Spend by platform */}
          <div className="stat-card">
            <p className="section-title" style={{ marginBottom: 20, fontSize: '1rem' }}>SPEND BY PLATFORM</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={spendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
                <XAxis dataKey="month" tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 6 }}
                  labelStyle={{ color: '#A0A0A0', fontSize: 11 }}
                  formatter={(v: any, name: string) => [`$${v.toLocaleString()}`, name.replace('_', ' ').toUpperCase()]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#6B6B6B' }} />
                {['meta', 'search', 'amazon_dsp', 'pmax'].map(p => (
                  <Bar key={p} dataKey={p} stackId="a" fill={PLATFORM_COLORS[p]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* Store visits + purchases */}
        <div className="stat-card" style={{ marginBottom: 32 }}>
          <p className="section-title" style={{ marginBottom: 20, fontSize: '1rem' }}>STORE VISITS & ONLINE PURCHASES</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={spendByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
              <XAxis dataKey="month" tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 6 }}
                labelStyle={{ color: '#A0A0A0', fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#6B6B6B' }} />
              <Line type="monotone" dataKey="store_visits" name="Store Visits" stroke="#4ade80" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="purchases" name="Online Purchases" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Platform table */}
        <div className="stat-card" style={{ marginBottom: 32 }}>
          <p className="section-title" style={{ marginBottom: 20, fontSize: '1rem' }}>PLATFORM BREAKDOWN — LATEST MONTH</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2E2E2E' }}>
                  {['Platform', 'Impressions', 'Clicks', 'CTR', 'CPC', 'Spend', 'Purchases / Orders', 'Store Visits'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6B6B6B', fontWeight: 400, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platforms
                  .filter(p => p.report_month === latest?.report_month)
                  .map(p => (
                    <tr key={p.platform} style={{ borderBottom: '1px solid #1E1E1E' }}>
                      <td style={{ padding: '12px 12px' }}>
                        <span className={`pill pill-${p.platform}`}>{p.platform.replace('_', ' ').toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px', color: '#A0A0A0' }}>{fmt(p.impressions)}</td>
                      <td style={{ padding: '12px', color: '#A0A0A0' }}>{fmt(p.clicks)}</td>
                      <td style={{ padding: '12px', color: '#A0A0A0' }}>{p.ctr ? `${(p.ctr * 100).toFixed(2)}%` : '—'}</td>
                      <td style={{ padding: '12px', color: '#A0A0A0' }}>{p.cpc ? `$${p.cpc.toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '12px', color: '#E8E8E8', fontWeight: 500 }}>{p.spend ? `$${p.spend.toLocaleString()}` : '—'}</td>
                      <td style={{ padding: '12px', color: '#A0A0A0' }}>{fmt(p.purchases || p.online_orders)}</td>
                      <td style={{ padding: '12px', color: '#A0A0A0' }}>{fmt(p.store_visits)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div>
            <p className="section-title" style={{ marginBottom: 16, fontSize: '1rem' }}>LATEST INSIGHTS</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {insights.slice(0, 6).map(i => (
                <div key={i.id} className="stat-card slide-up" style={{ borderLeft: `2px solid ${i.insight_type === 'anomaly' ? '#F87171' : i.insight_type === 'recommendation' ? '#E8272A' : '#2E2E2E'}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="stat-label" style={{ margin: 0 }}>{i.insight_type.replace('_', ' ').toUpperCase()}</span>
                    <span style={{ color: '#4A4A4A', fontSize: '0.72rem' }}>
                      {MONTH_LABELS[i.report_month] || i.report_month}
                    </span>
                  </div>
                  <p style={{ color: '#E8E8E8', fontSize: '0.85rem', fontWeight: 500, marginBottom: 6 }}>{i.title}</p>
                  <p style={{ color: '#6B6B6B', fontSize: '0.8rem', lineHeight: 1.6 }}>{i.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
