'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    await signIn('azure-ad', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0F0F' }}>
      <div className="w-full max-w-sm px-6">

        {/* Logo area */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div style={{
              width: 40, height: 40, background: '#E8272A',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'white', letterSpacing: '0.02em' }}>
                &P
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.1em', color: '#E8E8E8' }}>
              MEDIA INTELLIGENCE
            </span>
          </div>
          <p style={{ color: '#6B6B6B', fontSize: '0.85rem', letterSpacing: '0.06em' }}>
            DREAMBOX INTERNAL — AUTHORIZED ACCESS ONLY
          </p>
        </div>

        {/* Login card */}
        <div style={{
          background: '#1A1A1A',
          border: '1px solid #2E2E2E',
          borderRadius: 12,
          padding: '32px 28px',
        }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            letterSpacing: '0.06em',
            marginBottom: 8,
            color: '#E8E8E8'
          }}>
            SIGN IN
          </h1>
          <p style={{ color: '#6B6B6B', fontSize: '0.85rem', marginBottom: 28, lineHeight: 1.5 }}>
            Use your Dreambox Microsoft work account to access the dashboard.
          </p>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-3"
            style={{ padding: '14px 20px', fontSize: '0.9rem', letterSpacing: '0.04em' }}
          >
            {loading ? (
              <span className="loading-pulse">Signing in...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Continue with Microsoft
              </>
            )}
          </button>

          <hr className="divider" style={{ margin: '24px 0' }} />

          <p style={{ color: '#4A4A4A', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.6 }}>
            Access restricted to authorized Dreambox team members.
            Contact your administrator if you need access.
          </p>
        </div>

      </div>
    </div>
  )
}
