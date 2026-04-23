'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Nav from '../../components/Nav'

interface FileUpload {
  file: File
  month: string
  status: 'pending' | 'processing' | 'success' | 'error'
  result?: any
  error?: string
}

function UploadContent() {
  const searchParams = useSearchParams()
  const clientSlug = searchParams.get('client') || 'andpizza'

  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('clients').select('*').order('name')
      if (data) {
        setClients(data)
        const match = data.find((c: any) => c.slug === clientSlug) || data[0]
        setSelectedClient(match)
      }
    }
    load()
  }, [clientSlug])

  // Try to parse month from filename e.g. 2026_03_AndPizza.pdf -> 2026-03
  function guessMonth(filename: string): string {
    const match = filename.match(/(\d{4})[_\-](\d{2})/)
    if (match) return `${match[1]}-${match[2]}`
    return ''
  }

  const addFiles = (files: File[]) => {
    const newUploads: FileUpload[] = files
      .filter(f => f.name.endsWith('.pdf') || f.name.endsWith('.pptx'))
      .map(f => ({
        file: f,
        month: guessMonth(f.name),
        status: 'pending',
      }))
    setUploads(prev => [...prev, ...newUploads])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }

  const updateUpload = (index: number, updates: Partial<FileUpload>) => {
    setUploads(prev => prev.map((u, i) => i === index ? { ...u, ...updates } : u))
  }

  const removeUpload = (index: number) => {
    setUploads(prev => prev.filter((_, i) => i !== index))
  }

  const processAll = async () => {
    if (!selectedClient) return
    setIsProcessing(true)

    for (let i = 0; i < uploads.length; i++) {
      const upload = uploads[i]
      if (upload.status === 'success') continue
      if (!upload.month) {
        updateUpload(i, { status: 'error', error: 'Please set the report month' })
        continue
      }

      updateUpload(i, { status: 'processing' })

      try {
        const [year, month] = upload.month.split('-')
        const reportMonthDate = `${year}-${month}-01`

        const formData = new FormData()
        formData.append('file', upload.file)
        formData.append('clientId', selectedClient.id)
        formData.append('reportMonth', reportMonthDate)

        const res = await fetch('/api/extract', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) throw new Error(data.error || 'Upload failed')
        updateUpload(i, { status: 'success', result: data })
      } catch (err: any) {
        updateUpload(i, { status: 'error', error: err.message })
      }

      // Small delay between requests to avoid rate limiting
      if (i < uploads.length - 1) await new Promise(r => setTimeout(r, 3000))
    }

    setIsProcessing(false)
  }

  const allDone = uploads.length > 0 && uploads.every(u => u.status === 'success')
  const hasErrors = uploads.some(u => u.status === 'error')
  const pendingCount = uploads.filter(u => u.status === 'pending').length
  const successCount = uploads.filter(u => u.status === 'success').length

  const statusColor = (status: string) => {
    if (status === 'success') return '#4ade80'
    if (status === 'error') return '#F87171'
    if (status === 'processing') return '#E8272A'
    return '#4A4A4A'
  }

  const statusLabel = (status: string) => {
    if (status === 'success') return '✓ Done'
    if (status === 'error') return '✗ Error'
    if (status === 'processing') return '⟳ Processing...'
    return '○ Pending'
  }

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 40 }}>
        <p className="stat-label" style={{ marginBottom: 4 }}>REPORT INGESTION</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', letterSpacing: '0.06em', color: '#E8E8E8' }}>UPLOAD REPORTS</h1>
        <p style={{ color: '#6B6B6B', fontSize: '0.85rem', marginTop: 8 }}>Upload multiple reports at once — Claude will process them one by one automatically.</p>
      </div>

      <div style={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 12, padding: 32, marginBottom: 24 }}>

        {/* Client selector */}
        <div style={{ marginBottom: 24 }}>
          <label className="stat-label" style={{ display: 'block', marginBottom: 8 }}>CLIENT</label>
          <select
            value={selectedClient?.id || ''}
            onChange={e => setSelectedClient(clients.find(c => c.id === e.target.value))}
            className="input-field"
            style={{ maxWidth: 320 }}
            disabled={isProcessing}
          >
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Drop zone */}
        <div style={{ marginBottom: 24 }}>
          <label className="stat-label" style={{ display: 'block', marginBottom: 8 }}>ADD REPORT FILES</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#E8272A' : '#2E2E2E'}`,
              borderRadius: 8,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: dragOver ? '#1a0f0f' : 'transparent',
            }}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,.pptx"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <p style={{ color: '#6B6B6B', fontSize: '0.9rem', marginBottom: 4 }}>
              Drop multiple files here or click to browse
            </p>
            <p style={{ color: '#4A4A4A', fontSize: '0.78rem' }}>
              Select all monthly PDFs at once — months are auto-detected from filenames
            </p>
          </div>
        </div>

        {/* File list */}
        {uploads.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p className="stat-label" style={{ margin: 0 }}>{uploads.length} REPORT{uploads.length !== 1 ? 'S' : ''} QUEUED</p>
              {!isProcessing && <button onClick={() => setUploads([])} style={{ background: 'none', border: 'none', color: '#4A4A4A', fontSize: '0.78rem', cursor: 'pointer' }}>Clear all</button>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {uploads.map((upload, i) => (
                <div key={i} style={{
                  background: '#0F0F0F',
                  border: `1px solid ${upload.status === 'success' ? '#1a3a1a' : upload.status === 'error' ? '#3a1a1a' : upload.status === 'processing' ? '#3a1a1a' : '#2E2E2E'}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  {/* Status */}
                  <span style={{ color: statusColor(upload.status), fontSize: '0.78rem', minWidth: 100, fontWeight: 500 }}>
                    {upload.status === 'processing' ? <span className="loading-pulse">{statusLabel(upload.status)}</span> : statusLabel(upload.status)}
                  </span>

                  {/* Filename */}
                  <span style={{ color: '#A0A0A0', fontSize: '0.82rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {upload.file.name}
                  </span>

                  {/* Month input */}
                  <input
                    type="month"
                    value={upload.month}
                    onChange={e => updateUpload(i, { month: e.target.value })}
                    disabled={isProcessing || upload.status === 'success'}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #2E2E2E',
                      borderRadius: 4,
                      color: upload.month ? '#E8E8E8' : '#F87171',
                      padding: '4px 8px',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-body)',
                      outline: 'none',
                    }}
                  />

                  {/* Remove */}
                  {!isProcessing && upload.status !== 'success' && (
                    <button onClick={() => removeUpload(i)} style={{ background: 'none', border: 'none', color: '#4A4A4A', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
                  )}
                </div>
              ))}
            </div>

            {/* Error details */}
            {uploads.some(u => u.status === 'error') && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#1a0a0a', borderRadius: 6, border: '1px solid #3a1a1a' }}>
                {uploads.filter(u => u.status === 'error').map((u, i) => (
                  <p key={i} style={{ color: '#F87171', fontSize: '0.75rem', marginBottom: 4 }}>
                    {u.file.name}: {u.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Process button */}
        {uploads.length > 0 && !allDone && (
          <button
            onClick={processAll}
            disabled={isProcessing || uploads.every(u => u.status === 'success') || uploads.some(u => !u.month && u.status === 'pending')}
            className="btn-primary w-full"
            style={{ padding: '14px', fontSize: '0.9rem', letterSpacing: '0.06em' }}
          >
            {isProcessing
              ? <span className="loading-pulse">PROCESSING {successCount + 1} OF {uploads.length}...</span>
              : `PROCESS ${pendingCount} REPORT${pendingCount !== 1 ? 'S' : ''}`}
          </button>
        )}

        {/* Progress bar */}
        {isProcessing && (
          <div style={{ marginTop: 16 }}>
            <div style={{ background: '#2E2E2E', borderRadius: 4, height: 4, overflow: 'hidden' }}>
              <div style={{ background: '#E8272A', height: '100%', width: `${(successCount / uploads.length) * 100}%`, transition: 'width 0.5s ease' }} />
            </div>
            <p style={{ color: '#6B6B6B', fontSize: '0.75rem', marginTop: 8 }}>
              {successCount} of {uploads.length} complete — do not close this tab
            </p>
          </div>
        )}

        {/* All done */}
        {allDone && (
          <div className="slide-up" style={{ marginTop: 16, padding: 20, background: '#0a1a0a', borderRadius: 8, border: '1px solid #1a3a1a', textAlign: 'center' }}>
            <p style={{ color: '#4ade80', fontWeight: 500, fontSize: '1rem', marginBottom: 8 }}>✓ All {uploads.length} reports processed successfully</p>
            <a href={`/dashboard?client=${selectedClient?.slug}`} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
              View Dashboard →
            </a>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 24px', background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 8 }}>
        <p className="stat-label" style={{ marginBottom: 12 }}>TIPS</p>
        {[
          'Months are auto-detected from filenames like 2026_03_Client.pdf — check they look right before processing',
          'Reports are processed one at a time with a short pause between each to avoid API rate limits',
          'Keep this tab open while processing — it takes 20-40 seconds per report',
          'If a report fails, fix the issue and reprocess just that one — successful ones are skipped',
        ].map((tip, i) => (
          <div key={i} className="flex items-start gap-3" style={{ marginBottom: 10 }}>
            <span style={{ color: '#E8272A', fontFamily: 'var(--font-display)', fontSize: '1rem', minWidth: 20 }}>{i + 1}</span>
            <p style={{ color: '#6B6B6B', fontSize: '0.83rem', lineHeight: 1.6 }}>{tip}</p>
          </div>
        ))}
      </div>
    </main>
  )
}

export default function UploadPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0F0F0F' }}>
      <Suspense fallback={<div />}>
        <Nav active="upload" />
        <UploadContent />
      </Suspense>
    </div>
  )
}
