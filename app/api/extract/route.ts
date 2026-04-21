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
    const reportMonth = formData.get('reportMonth') as string
 
    if (!file || !clientId || !reportMonth) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
 
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
 
    const supabase = createServerClient()
 
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
 
    const extractionPrompt = `You are extracting paid media performance data from a monthly digital ads report for &Pizza.
 
Report month: ${reportMonth}
 
Read the document and extract the key metrics. Return ONLY a JSON object, nothing else. No markdown, no backticks, no explanation before or after.
 
Use this structure and fill in the real numbers you find:
 
{"monthly_summary":{"total_impressions":0,"get_directions":0,"tracked_store_visits":0,"tracked_online_purchases":0,"total_spend":0,"cost_per_acquisition":0,"purchase_roas":0,"est_total_roas_low":0,"est_total_roas_high":0,"store_visits_est_revenue_low":0,"store_visits_est_revenue_high":0,"tracked_purchases_est_revenue":0,"paid_traffic_pct":null,"paid_new_users_pct":null,"ytd_avg_purchase_roas":0},"platforms":[{"platform":"meta","impressions":0,"clicks":0,"ctr":0,"cpc":0,"cpm":0,"spend":0,"purchases":0,"online_orders":null,"store_visits":null,"get_directions":null,"reach":0,"impression_share":null,"off_amazon_purchases":null,"cpm_standard_low":6.80,"cpm_standard_high":8.20,"notes":null},{"platform":"search","impressions":0,"clicks":0,"ctr":0,"cpc":0,"cpm":null,"spend":0,"purchases":null,"online_orders":0,"store_visits":0,"get_directions":null,"reach":null,"impression_share":0,"off_amazon_purchases":null,"cpm_standard_low":null,"cpm_standard_high":null,"notes":null},{"platform":"amazon_dsp","impressions":0,"clicks":0,"ctr":0,"cpc":0,"cpm":0,"spend":0,"purchases":null,"online_orders":null,"store_visits":null,"get_directions":null,"reach":null,"impression_share":null,"off_amazon_purchases":null,"cpm_standard_low":5,"cpm_standard_high":15,"notes":null}],"ads":[],"locations":[],"insights":[{"insight_type":"observation","title":"Summary","body":"Report processed successfully","platform":null}],"anomalies":[]}`
 
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
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
 
    let extracted
    try {
      extracted = JSON.parse(rawText.trim())
    } catch {
      try {
        const stripped = rawText.replace(/```json\n?|\n?```/g, '').trim()
        extracted = JSON.parse(stripped)
      } catch {
        try {
          const match = rawText.match(/\{[\s\S]*\}/)
          if (match) {
            const fixed = match[0].replace(/,(\s*[}\]])/g, '$1')
            extracted = JSON.parse(fixed)
          } else {
            throw new Error('No JSON found')
          }
        } catch {
          console.error('Parse failed. Raw:', rawText.substring(0, 500))
          return NextResponse.json({ error: 'Failed to parse extracted data. Please try again.' }, { status: 500 })
        }
      }
    }
 
    const month = reportMonth
 
    if (extracted.monthly_summary) {
      await supabase.from('monthly_summaries').upsert({
        client_id: clientId,
        report_month: month,
        ...extracted.monthly_summary,
      }, { onConflict: 'client_id,report_month' })
    }
 
    if (extracted.platforms?.length) {
      for (const p of extracted.platforms) {
        await supabase.from('platform_monthly').upsert({
          client_id: clientId,
          report_month: month,
          ...p,
        }, { onConflict: 'client_id,report_month,platform' })
      }
    }
 
    if (extracted.ads?.length) {
      await supabase.from('ad_performance').delete().eq('client_id', clientId).eq('report_month', month)
      await supabase.from('ad_performance').insert(
        extracted.ads.map((a: any) => ({ client_id: clientId, report_month: month, ...a }))
      )
    }
 
    if (extracted.locations?.length) {
      await supabase.from('location_performance').delete().eq('client_id', clientId).eq('report_month', month)
      await supabase.from('location_performance').insert(
        extracted.locations.map((l: any) => ({ client_id: clientId, report_month: month, ...l }))
      )
    }
 
    if (extracted.insights?.length) {
      await supabase.from('monthly_insights').delete().eq('client_id', clientId).eq('report_month', month).eq('source', 'report')
      await supabase.from('monthly_insights').insert(
        extracted.insights.map((i: any) => ({ client_id: clientId, report_month: month, source: 'report', ...i }))
      )
    }
 
    if (uploadRecord) {
      await supabase.from('report_uploads').update({
        status: 'complete',
        raw_extraction: rawText.substring(0, 10000),
      }).eq('id', uploadRecord.id)
    }
 
    return NextResponse.json({
      success: true,
      uploadId: uploadRecord?.id,
      summary: extracted.monthly_summary,
      anomalies: extracted.anomalies || [],
    })
 
  } catch (err: any) {
    console.error('Extraction error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
