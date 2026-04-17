import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '../../../lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const clientId = formData.get('clientId') as string
    const reportMonth = formData.get('reportMonth') as string // e.g. "2025-12-01"

    if (!file || !clientId || !reportMonth) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Convert file to base64 for Claude
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const supabase = createServerClient()

    // Log the upload attempt
    const { data: uploadRecord } = await supabase
      .from('report_uploads')
      .insert({
        client_id: clientId,
        report_month: reportMonth,
        filename: file.name,
        status: 'processing',
      })
      .select()
      .single()

    // Send to Claude for extraction
    const extractionPrompt = `You are extracting paid media performance data from a monthly digital ads report (PowerPoint/PDF).

The report month is: ${reportMonth}
Client: &Pizza

Extract ALL data you can find and return it as a single JSON object with this exact structure.
Return ONLY the JSON — no markdown, no explanation, no preamble.

Important notes:
- Ignore any "July 2025" text in slide headers — it's a template artifact. Use the report month provided above.
- If a value appears anomalous (e.g. Meta CPM of $1,000,000+), set it to null and add a note.
- Store CTR as a decimal (e.g. 4.79% = 0.0479)
- Store ROAS as a percentage number (e.g. 307.9% = 307.9)
- All spend and revenue as numbers without $ signs

{
  "monthly_summary": {
    "total_impressions": number|null,
    "get_directions": number|null,
    "tracked_store_visits": number|null,
    "tracked_online_purchases": number|null,
    "total_spend": number|null,
    "cost_per_acquisition": number|null,
    "purchase_roas": number|null,
    "est_total_roas_low": number|null,
    "est_total_roas_high": number|null,
    "store_visits_est_revenue_low": number|null,
    "store_visits_est_revenue_high": number|null,
    "tracked_purchases_est_revenue": number|null,
    "paid_traffic_pct": number|null,
    "paid_new_users_pct": number|null,
    "ytd_avg_purchase_roas": number|null
  },
  "platforms": [
    {
      "platform": "meta"|"search"|"amazon_dsp"|"pmax",
      "impressions": number|null,
      "clicks": number|null,
      "ctr": number|null,
      "cpc": number|null,
      "cpm": number|null,
      "spend": number|null,
      "purchases": number|null,
      "online_orders": number|null,
      "store_visits": number|null,
      "get_directions": number|null,
      "reach": number|null,
      "impression_share": number|null,
      "off_amazon_purchases": number|null,
      "cpm_standard_low": number|null,
      "cpm_standard_high": number|null,
      "notes": string|null
    }
  ],
  "ads": [
    {
      "platform": "meta"|"search"|"amazon_dsp"|"pmax",
      "store_type": "corporate"|"franchise"|"all",
      "campaign_name": string|null,
      "ad_name": string,
      "impressions": number|null,
      "reach": number|null,
      "clicks": number|null,
      "cpc": number|null,
      "ctr": number|null,
      "spend": number|null,
      "purchases": number|null,
      "online_orders": number|null,
      "store_visits": number|null
    }
  ],
  "locations": [
    {
      "location_name": string,
      "store_type": "corporate"|"franchise",
      "platform": "meta"|"search"|"amazon_dsp"|"pmax",
      "impressions": number|null,
      "reach": number|null,
      "clicks": number|null,
      "cpc": number|null,
      "ctr": number|null,
      "spend": number|null,
      "purchases": number|null,
      "online_orders": number|null,
      "store_visits": number|null
    }
  ],
  "insights": [
    {
      "insight_type": "observation"|"recommendation"|"anomaly"|"external_factor"|"upcoming_event",
      "title": string,
      "body": string,
      "platform": string|null
    }
  ],
  "anomalies": [
    {
      "field": string,
      "value": string,
      "note": string
    }
  ]
}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            } as any,
            {
              type: 'text',
              text: extractionPrompt,
            },
          ],
        },
      ],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleanJson = rawText.replace(/```json\n?|\n?```/g, '').trim()
    const extracted = JSON.parse(cleanJson)

    // Write to Supabase
    const month = reportMonth

    // 1. Monthly summary
    if (extracted.monthly_summary) {
      await supabase.from('monthly_summaries').upsert({
        client_id: clientId,
        report_month: month,
        ...extracted.monthly_summary,
      }, { onConflict: 'client_id,report_month' })
    }

    // 2. Platform totals
    if (extracted.platforms?.length) {
      for (const p of extracted.platforms) {
        await supabase.from('platform_monthly').upsert({
          client_id: clientId,
          report_month: month,
          ...p,
        }, { onConflict: 'client_id,report_month,platform' })
      }
    }

    // 3. Ad performance
    if (extracted.ads?.length) {
      // Delete existing for this month first to avoid dupes
      await supabase.from('ad_performance')
        .delete()
        .eq('client_id', clientId)
        .eq('report_month', month)

      await supabase.from('ad_performance').insert(
        extracted.ads.map((a: any) => ({ client_id: clientId, report_month: month, ...a }))
      )
    }

    // 4. Location performance
    if (extracted.locations?.length) {
      await supabase.from('location_performance')
        .delete()
        .eq('client_id', clientId)
        .eq('report_month', month)

      await supabase.from('location_performance').insert(
        extracted.locations.map((l: any) => ({ client_id: clientId, report_month: month, ...l }))
      )
    }

    // 5. Insights
    if (extracted.insights?.length) {
      await supabase.from('monthly_insights')
        .delete()
        .eq('client_id', clientId)
        .eq('report_month', month)
        .eq('source', 'report')

      await supabase.from('monthly_insights').insert(
        extracted.insights.map((i: any) => ({
          client_id: clientId,
          report_month: month,
          source: 'report',
          ...i,
        }))
      )
    }

    // Update upload record to complete
    await supabase.from('report_uploads').update({
      status: 'complete',
      raw_extraction: cleanJson,
    }).eq('id', uploadRecord.id)

    return NextResponse.json({
      success: true,
      uploadId: uploadRecord.id,
      summary: extracted.monthly_summary,
      anomalies: extracted.anomalies || [],
    })

  } catch (err: any) {
    console.error('Extraction error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
