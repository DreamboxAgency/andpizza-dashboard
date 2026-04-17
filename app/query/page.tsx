'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Nav from '../../components/Nav'

const SUGGESTED_QUESTIONS = [
  'Which channel delivered the highest ROAS last month?',
  'How has store visit performance trended over the last 4 months?',
  'Where should we reallocate budget based on current performance?',
  'Compare Meta vs Search efficiency across all months',
  'What was our best performing ad creative and why?',
  'Flag any performance anomalies in the data',
]

export default function QueryPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{ q: string; a: string }[]>([])

  const ask = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setAnswer('')

    try {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', 'andpizza')
        .single()

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, clientId: client?.id }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setAnswer(data.answer)
      setHistory(prev => [{ q, a: data.answer }, ...prev].slice(0, 10))
      setQuestion('')
    } catch (err: any) {
      setAnswer(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0F0F0F' }}>
      <Nav active="query" />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ marginBottom: 40 }}>
          <p className="stat-label" style={{ marginBottom: 4 }}>AI ANALYSIS</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', letterSpacing: '0.06em', color: '#E8E8E8' }}>
            ASK THE DATA
          </h1>
          <p style={{ color: '#6B6B6B', fontSize: '0.85rem', marginTop: 8 }}>
            Ask any question about &Pizza's paid media performance across all months.
          </p>
        </div>

        {/* Query input */}
        <div style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question) } }}
            placeholder="e.g. Which channel had the best ROAS in February?"
            className="input-field"
            style={{ minHeight: 80, resize: 'vertical', lineHeight: 1.6 }}
          />
          <div className="flex justify-end" style={{ marginTop: 12 }}>
            <button
              onClick={() => ask(question)}
              disabled={!question.trim() || loading}
              className="btn-primary"
            >
              {loading ? <span className="loading-pulse">Analyzing...</span> : 'Ask →'}
            </button>
          </div>
        </div>

        {/* Suggested questions */}
        {!answer && !loading && (
          <div style={{ marginBottom: 32 }}>
            <p className="stat-label" style={{ marginBottom: 12 }}>SUGGESTED QUESTIONS</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  style={{
                    background: '#1A1A1A',
                    border: '1px solid #2E2E2E',
                    borderRadius: 6,
                    padding: '12px 16px',
                    textAlign: 'left',
                    color: '#A0A0A0',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'var(--font-body)',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.borderColor = '#E8272A'
                    ;(e.target as HTMLElement).style.color = '#E8E8E8'
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.borderColor = '#2E2E2E'
                    ;(e.target as HTMLElement).style.color = '#A0A0A0'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 8, padding: 24, marginBottom: 24 }}>
            <p className="loading-pulse" style={{ color: '#E8272A', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
              ANALYZING DATA...
            </p>
          </div>
        )}

        {/* Current answer */}
        {answer && !loading && (
          <div className="slide-up" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 8, padding: 24, marginBottom: 32 }}>
            <p className="stat-label" style={{ marginBottom: 12 }}>ANALYSIS</p>
            <div style={{ color: '#E8E8E8', fontSize: '0.9rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {answer}
            </div>
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <button onClick={() => { setAnswer(''); setQuestion('') }} className="btn-ghost" style={{ fontSize: '0.8rem', padding: '8px 16px' }}>
                Ask another
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(answer)}
                className="btn-ghost"
                style={{ fontSize: '0.8rem', padding: '8px 16px' }}
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 1 && (
          <div>
            <p className="stat-label" style={{ marginBottom: 16 }}>PREVIOUS QUESTIONS</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {history.slice(1).map((h, i) => (
                <div
                  key={i}
                  style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 8, padding: 16, cursor: 'pointer' }}
                  onClick={() => { setAnswer(h.a); setQuestion(h.q) }}
                >
                  <p style={{ color: '#A0A0A0', fontSize: '0.82rem', marginBottom: 6 }}>{h.q}</p>
                  <p style={{ color: '#4A4A4A', fontSize: '0.78rem', lineHeight: 1.5 }}>
                    {h.a.slice(0, 140)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
