'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

export default function Nav({ active }: { active: string }) {
  const { data: session } = useSession()

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
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'white' }}>&P</span>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', letterSpacing: '0.1em', color: '#6B6B6B' }}>
            MEDIA INTEL
          </span>
        </div>

        {/* Links */}
        <Link href="/dashboard" className={`nav-link ${active === 'dashboard' ? 'active' : ''}`}>
          Dashboard
        </Link>
        <Link href="/upload" className={`nav-link ${active === 'upload' ? 'active' : ''}`}>
          Upload Report
        </Link>
        <Link href="/query" className={`nav-link ${active === 'query' ? 'active' : ''}`}>
          Ask AI
        </Link>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User */}
        {session?.user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#4A4A4A', fontSize: '0.78rem' }}>
              {session.user.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="btn-ghost"
              style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
