'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Nav from '../../components/Nav'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [reportMonth, setReportMonth] = useState('')
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const handleUpload = async () => {
    if (!file || !reportMonth) return

    setStatus('processing')
    setErrorMsg('')

    try {
      // Get &Pizza client ID
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', 'andpizza')
        .single()

      if (!client) throw new Error('Client not found')

      // Convert month string to first-of-month date
      const [year, month] = reportMonth.split('-')
      const reportMonthDate = `${year}-${month}-01`

      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', client.id)
      formData.append('reportMonth', reportMonthDate)

      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Upload failed')

      setResult(data)
      setStatus('success')
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.pptx') || f.name.endsWith('.pdf'))) {
      setFile(f)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0F0F0F' }}>
      <Nav active="upload" />

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ marginBottom: 40 }}>
          <p className="stat-label" style={{ marginBottom: 4 }}>REPORT INGESTION</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', letterSpacing: '0.06em', color: '#E8E8E8' }}>
            UPLOAD REPORT
          </h1>
        </div>

        <div style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 12, padding: 32 }}>

          {/* Month selector */}
          <div style={{ marginBottom: 24 }}>
            <label className="stat-label" style={{ display: 'block', marginBottom: 8 }}>
              REPORT MONTH
            </label>
            <input
              type="month"
              value={reportMonth}
              onChange={e => setReportMonth(e.target.value)}
              className="input-field"
              style={{ maxWidth: 220 }}
            />
          </div>

          {/* File drop zone */}
          <div style={{ marginBottom: 28 }}>
            <label className="stat-label" style={{ display: 'block', marginBottom: 8 }}>
              REPORT FILE (.PPTX OR .PDF)
            </label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#E8272A' : file ? '#2E6E2E' : '#2E2E2E'}`,
                borderRadius: 8,
                padding: '40px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: dragOver ? '#1a0f0f' : 'transparent',
              }}
            >
              <input
                id="file-input"
                type="file"
                accept=".pptx,.pdf"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
              />
              {file ? (
                <div>
                  <p style={{ color: '#4ade80', fontSize: '0.9rem', fontWeight: 500, marginBottom: 4 }}>
                    ✓ {file.name}
                  </p>
                  <p style={{ color: '#6B6B6B', fontSize: '0.78rem' }}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB — click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ color: '#6B6B6B', fontSize: '0.9rem', marginBottom: 4 }}>
                    Drop report here or click to browse
                  </p>
                  <p style={{ color: '#4A4A4A', fontSize: '0.78rem' }}>
                    Supports .pptx and .pdf
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleUpload}
            disabled={!file || !reportMonth || status === 'processing'}
            className="btn-primary w-full"
            style={{ padding: '14px', fontSize: '0.9rem', letterSpacing: '0.06em' }}
          >
            {status === 'processing' ? (
              <span className="loading-pulse">EXTRACTING DATA...</span>
            ) : 'PROCESS REPORT'}
          </button>

          {/* Processing state */}
          {status === 'processing' && (
            <div style={{ marginTop: 24, padding: '16px', background: '#0F0F0F', borderRadius: 8, border: '1px solid #2E2E2E' }}>
              <p style={{ color: '#6B6B6B', fontSize: '0.82rem', lineHeight: 1.7 }}>
                Claude is reading your report and extracting all KPIs — spend, ROAS, impressions, store visits, platform breakdowns, and insights. This typically takes 20–40 seconds.
              </p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && result && (
            <div className="slide-up" style={{ marginTop: 24, padding: 20, background: '#0a1a0a', borderRadius: 8, border: '1px solid #1a3a1a' }}>
              <p style={{ color: '#4ade80', fontWeight: 500, marginBottom: 12, fontSize: '0.9rem' }}>
                ✓ Report processed successfully
              </p>
              {result.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['Total Spend', `$${result.summary.total_spend?.toLocaleString()}`],
                    ['Purchase ROAS', `${result.summary.purchase_roas}%`],
                    ['Store Visits', result.summary.tracked_store_visits?.toLocaleString()],
                    ['Online Purchases', result.summary.tracked_online_purchases?.toLocaleString()],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p style={{ color: '#4A4A4A', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{k}</p>
                      <p style={{ color: '#A0A0A0', fontSize: '0.88rem' }}>{v || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.anomalies?.length > 0 && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#1a0a0a', borderRadius: 6, border: '1px solid #3a1a1a' }}>
                  <p style={{ color: '#F87171', fontSize: '0.78rem', fontWeight: 500, marginBottom: 6 }}>⚠ Anomalies flagged</p>
                  {result.anomalies.map((a: any, i: number) => (
                    <p key={i} style={{ color: '#6B6B6B', fontSize: '0.75rem', lineHeight: 1.6 }}>
                      {a.field}: {a.value} — {a.note}
                    </p>
                  ))}
                </div>
              )}
              <a href="/dashboard" style={{ display: 'inline-block', marginTop: 16 }} className="btn-ghost">
                View Dashboard →
              </a>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="slide-up" style={{ marginTop: 24, padding: 16, background: '#1a0a0a', borderRadius: 8, border: '1px solid #3a1a1a' }}>
              <p style={{ color: '#F87171', fontSize: '0.85rem' }}>✗ {errorMsg}</p>
            </div>
          )}

        </div>

        {/* Instructions */}
        <div style={{ marginTop: 32, padding: '20px 24px', background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 8 }}>
          <p className="stat-label" style={{ marginBottom: 12 }}>HOW IT WORKS</p>
          {[
            'Select the report month from the dropdown above',
            'Upload the monthly media report (.pptx or .pdf)',
            'Claude reads the report and extracts all KPIs automatically',
            'Data is written to the database and the dashboard updates',
            'Any anomalies or unusual values are flagged for review',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3" style={{ marginBottom: 10 }}>
              <span style={{ color: '#E8272A', fontFamily: 'var(--font-display)', fontSize: '1rem', minWidth: 20 }}>{i + 1}</span>
              <p style={{ color: '#6B6B6B', fontSize: '0.83rem', lineHeight: 1.6 }}>{step}</p>
            </div>
          ))}
        </div>

      </main>
    </div>
  )
}
