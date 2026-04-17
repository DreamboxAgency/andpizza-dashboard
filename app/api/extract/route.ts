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
 
    const extractionPrompt = `You are extracting paid media performance data from a monthly digital ads report.
 
The report month is: ${reportMonth}
Client: &Pizza
 
Extract ALL data you can find and return it as a single valid JSON object.
Return ONLY valid JSON — no markdown, no backticks, no explanation, no trailing commas, no comments.
 
Important notes:
- Ignore any "July 2025" text in slide headers — it is a template artifact. Use the report month provided above.
- If a value appears anomalous (e.g. Meta CPM of $1,000,000+), set it to null and note it in anomalies.
- Store CTR as a decimal (e.g. 4.79% = 0.0479)
- Store ROAS as a percentage number (e.g. 307.9% = 307.9)
- All spend and revenue as plain numbers without dollar signs
 
Return this exact JSON structure with real values filled in:
 
{
  "monthly_summary": {
    "total_impressions": 0,
    "get_directions": 0,
    "tracked_store_visits": 0,
    "tracked_online_purchases": 0,
    "total_spend": 0,
    "cost_per_acquisition": 0,
    "purchase_roas": 0,
    "est_total_roas_low": 0,
    "est_total_roas_high": 0,
    "store_visits_est_revenue_low": 0,
    "store_visits_est_revenue_high": 0,
    "tracked_purchases_est_revenue": 0,
    "paid_traffic_pct": null,
    "paid_new_users_pct": null,
    "ytd_avg_purchase_roas": 0
  },
  "platforms": [
    {
      "platform": "meta",
      "impressions": 0,
      "clicks": 0,
      "ctr": 0,
      "cpc": 0,
      "cpm": 0,
      "spend": 0,
      "purchases": 0,
      "online_orders": null,
      "store_visits": null,
      "get_directions": null,
      "reach": 0,
      "impression_share": null,
      "off_amazon_purchases": null,
      "cpm_standard_low": 6.80,
      "cpm_standard_high": 8.20,
      "notes": null
    }
  ],
  "ads": [
    {
      "platform": "meta",
      "store_type": "corporate",
      "campaign_name": null,
      "ad_name": "Ad name here",
      "impressions": 0,
      "reach": 0,
      "clicks": 0,
      "cpc": 0,
      "ctr": 0,
      "spend": 0,
      "purchases": 0,
      "online_orders": null,
      "store_visits": null
    }
  ],
  "locations": [
    {
      "location_name": "Location name",
      "store_type": "corporate",
      "platform": "meta",
      "impressions": 0,
      "reach": 0,
      "clicks": 0,
      "cpc": 0,
      "ctr": 0,
      "spend": null,
      "purchases": 0,
      "online_orders": null,
      "store_visits": null
    }
  ],
  "insights": [
    {
      "insight_type": "observation",
      "title": "Insight title",
      "body": "Insight body text",
      "platform": null
    }
  ],
  "anomalies": []
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
    
    // Robust JSON cleaning
    let cleanJson = rawText
      .replace(/```json\n?|\n?```/g, '')
      .replace(/,(\s*[}\]])/g, '$1')  // remove trailing commas
      .trim()
 
    // Extract JSON if wrapped in other text
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanJson = jsonMatch[0]
    }
 
    let extracted
    try {
      extracted = JSON.parse(cleanJson)
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr)
      console.error('Raw text:', rawText.substring(0, 500))
      return NextResponse.json({ 
        error: 'Failed to parse extracted data. Please try again.',
        raw: rawText.substring(0, 200)
      }, { status: 500 })
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
      await supabase.from('ad_performance')
        .delete()
        .eq('client_id', clientId)
        .eq('report_month', month)
      await supabase.from('ad_performance').insert(
        extracted.ads.map((a: any) => ({ client_id: clientId, report_month: month, ...a }))
      )
    }
 
    if (extracted.locations?.length) {
      await supabase.from('location_performance')
        .delete()
        .eq('client_id', clientId)
        .eq('report_month', month)
      await supabase.from('location_performance').insert(
        extracted.locations.map((l: any) => ({ client_id: clientId, report_month: month, ...l }))
      )
    }
 
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
 
    if (uploadRecord) {
      await supabase.from('report_uploads').update({
        status: 'complete',
        raw_extraction: cleanJson,
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
