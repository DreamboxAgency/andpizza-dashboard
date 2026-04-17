import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '../../../lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const { question, clientId } = await req.json()

    const supabase = createServerClient()

    // Pull all available data to give Claude context
    const [summaries, platforms, ads, insights] = await Promise.all([
      supabase.from('monthly_summaries')
        .select('*')
        .eq('client_id', clientId)
        .order('report_month', { ascending: true }),
      supabase.from('platform_monthly')
        .select('*')
        .eq('client_id', clientId)
        .order('report_month', { ascending: true }),
      supabase.from('ad_performance')
        .select('*')
        .eq('client_id', clientId)
        .order('report_month', { ascending: true }),
      supabase.from('monthly_insights')
        .select('*')
        .eq('client_id', clientId)
        .order('report_month', { ascending: true }),
    ])

    const context = {
      monthly_summaries: summaries.data || [],
      platform_monthly: platforms.data || [],
      ad_performance: ads.data || [],
      insights: insights.data || [],
    }

    const systemPrompt = `You are a paid media analyst assistant for Dreambox, a digital media agency. 
You have access to &Pizza's paid media performance data across Meta, Google Search, Amazon DSP, and Google PMax.

Key context:
- Average order value: $15.00
- ROAS values are percentages (e.g. 307.9 means 307.9%)
- CTR values are decimals (e.g. 0.0479 means 4.79%)
- report_month dates are stored as the first of the month (e.g. 2025-12-01 = December 2025)
- Store visit revenue uses a 40-70% attribution range (industry standard)

When answering:
- Be specific and cite actual numbers from the data
- Call out month-over-month trends when relevant
- Flag anything anomalous
- Give a clear strategic recommendation when appropriate
- Keep answers concise but substantive — this is for an internal team, not a client

Here is all available data:
${JSON.stringify(context, null, 2)}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    })

    const answer = message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ answer })

  } catch (err: any) {
    console.error('Query error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
