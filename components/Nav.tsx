'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Nav({ active }: { active: string }) {
  const [clients, setClients] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('clients').select('*').order('name')
      if (data) {
        setClients(data)
        const slugFromUrl = searchParams.get('client')
        const match = data.find(c => c.slug === slugFromUrl) || data[0]
        setSelected(match)
      }
    }
    load()
  }, [])

  const switchClient = (client: any) => {
    setSelected(client)
    setOpen(false)
    const path = window.location.pathname
    router.push(`${path}?client=${client.slug}`)
  }

  return (
    <nav style={{
      background: '#0F0F0F',
      borderBottom: '1px solid #2E2E2E',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', height: 56, gap: 32 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
          <div style={{
            width: 28, height: 28, background: '#E8272A', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'white' }}>DB</span>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', letterSpacing: '0.1em', color: '#6B6B6B' }}>
            MEDIA INTEL
          </span>
        </div>

        {/* Client switcher */}
        {selected && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(!open)}
              style={{
                background: '#1A1A1A',
                border: '1px solid #2E2E2E',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#E8E8E8',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'border-color 0.2s',
              }}
            >
              <span style={{ color: '#E8272A', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CLIENT</span>
              <span style={{ fontWeight: 500 }}>{selected.name}</span>
              <span style={{ color: '#4A4A4A' }}>▾</span>
            </button>

            {open && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#1A1A1A',
                border: '1px solid #2E2E2E',
                borderRadius: 8,
                minWidth: 220,
                zIndex: 200,
                overflow: 'hidden',
              }}>
                {clients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => switchClient(c)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 16px',
                      background: c.id === selected.id ? '#242424' : 'transparent',
                      border: 'none',
                      color: c.id === selected.id ? '#E8E8E8' : '#A0A0A0',
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      borderBottom: '1px solid #2E2E2E',
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.background = '#242424'}
                    onMouseLeave={e => (e.target as HTMLElement).style.background = c.id === selected.id ? '#242424' : 'transparent'}
                  >
                    {c.name}
                    {c.id === selected.id && <span style={{ color: '#E8272A', marginLeft: 8, fontSize: '0.7rem' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Links */}
        <Link href={`/dashboard${selected ? `?client=${selected.slug}` : ''}`} className={`nav-link ${active === 'dashboard' ? 'active' : ''}`}>
          Dashboard
        </Link>
        <Link href={`/upload${selected ? `?client=${selected.slug}` : ''}`} className={`nav-link ${active === 'upload' ? 'active' : ''}`}>
          Upload Report
        </Link>
        <Link href={`/query${selected ? `?client=${selected.slug}` : ''}`} className={`nav-link ${active === 'query' ? 'active' : ''}`}>
          Ask AI
        </Link>

        <div style={{ flex: 1 }} />

        <span style={{ color: '#4A4A4A', fontSize: '0.75rem' }}>Dreambox Agency</span>
      </div>
    </nav>
  )
}

