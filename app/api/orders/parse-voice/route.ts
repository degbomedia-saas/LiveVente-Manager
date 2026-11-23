import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { DEFAULT_LOME_ZONES } from '@/lib/config/lome-zones'
import { checkAndConsumeAiQuota } from '@/lib/quotas'

export interface ParsedVoiceOrderItem {
  product_id: string | null
  product_name: string
  quantity: number
  unit_price_fcfa: number
}

export interface ParsedVoiceOrderResult {
  transcript: string
  customer_name: string
  phone: string
  zone_name: string
  delivery_fee_fcfa: number
  address_note: string
  payment_method: 'cash' | 'tmoney' | 'flooz' | 'online'
  items: ParsedVoiceOrderItem[]
  missing_fields: string[]
  is_missing_info: boolean
}

const MAX_AUDIO_BYTES = 2 * 1024 * 1024 // 2 Mo maximum
const MAX_AUDIO_SECONDS = 30 // 30 secondes maximum

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'La variable GROQ_API_KEY est manquante dans les variables d’environnement.',
        },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const durationSec = Number(formData.get('duration_sec') || 0)
    const rawText = ((formData.get('raw_text') as string | null) || '').trim()
    const sellerIdParam = (formData.get('seller_id') as string | null) || null
    const companyIdParam =
      (formData.get('company_id') as string | null) || null

    if (!audioFile && !rawText) {
      return NextResponse.json(
        { error: 'Veuillez enregistrer un audio ou coller un message WhatsApp.' },
        { status: 400 }
      )
    }

    if (audioFile) {
      if (audioFile.size > MAX_AUDIO_BYTES) {
        return NextResponse.json(
          {
            error:
              'L’enregistrement vocal dépasse la taille maximale autorisée (2 Mo / 30 secondes max).',
          },
          { status: 413 }
        )
      }
      if (durationSec > MAX_AUDIO_SECONDS) {
        return NextResponse.json(
          {
            error:
              'L’enregistrement vocal ne doit pas dépasser 30 secondes.',
          },
          { status: 400 }
        )
      }
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let targetCompanyId = companyIdParam
    let effectiveStoreId = sellerIdParam

    if (user) {
      const profile = await getOrCreateProfile(supabase, user)
      targetCompanyId = profile.company_id

      // Vérifier le quota d'essais IA (free_mvp = 3 essais max)
      const quotaCheck = await checkAndConsumeAiQuota(
        supabase,
        user.id,
        profile.company_id
      )
      if (!quotaCheck.allowed) {
        return NextResponse.json(
          {
            error: quotaCheck.message,
            quotaReached: true,
          },
          { status: 403 }
        )
      }

      if (!effectiveStoreId) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()
        effectiveStoreId = storeData?.id ?? null
      }
    }

    // Récupérer les produits et zones de livraison de cette boutique
    const { data: productsData } = targetCompanyId
      ? await supabase
          .from('products')
          .select('id, name, base_price, price_fcfa')
          .eq('company_id', targetCompanyId)
          .eq('is_active', true)
      : { data: [] }

    let zonesList = DEFAULT_LOME_ZONES.map((z) => ({
      zone_name: z.zone_name,
      fee_fcfa: z.fee_fcfa,
    }))

    if (effectiveStoreId) {
      const { data: dbZones } = await supabase
        .from('delivery_zones')
        .select('zone_name, fee_fcfa')
        .eq('seller_id', effectiveStoreId)
        .eq('is_active', true)

      if (dbZones && dbZones.length > 0) {
        zonesList = dbZones
      }
    }

    const productsCatalog = (productsData ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price_fcfa: Math.round(Number(p.price_fcfa ?? p.base_price ?? 0)),
    }))

    // Étape 1 : Soit texte brut WhatsApp collé, soit appel Groq Speech-to-Text (whisper-large-v3-turbo)
    let transcript = rawText

    if (!transcript && audioFile) {
      const sttForm = new FormData()
      sttForm.append('file', audioFile, audioFile.name || 'dictation.webm')
      sttForm.append('model', 'whisper-large-v3-turbo')
      sttForm.append('language', 'fr')
      sttForm.append('response_format', 'json')

      const sttRes = await fetch(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: sttForm,
        }
      )

      if (!sttRes.ok) {
        const errText = await sttRes.text()
        return NextResponse.json(
          { error: `Erreur transcription Groq STT : ${errText}` },
          { status: 502 }
        )
      }

      const sttJson = (await sttRes.json()) as { text?: string }
      transcript = (sttJson.text || '').trim()
    }

    if (!transcript) {
      return NextResponse.json(
        { error: 'Aucun texte détecté.' },
        { status: 422 }
      )
    }

    // Étape 2 : Extraction JSON structurée via openai/gpt-oss-20b sur Groq
    const systemPrompt = `Tu es un assistant de prise de commande pour une boutique e-commerce à Lomé (Togo) sur TikTok et WhatsApp.
Catalogue produits de la boutique : ${JSON.stringify(productsCatalog)}
Zones de livraison disponibles : ${JSON.stringify(zonesList)}

Extrais les informations du message (dictée vocale ou message WhatsApp collé) et retourne UNIQUEMENT un objet JSON strict respectant exactement ce schéma :
{
  "customer_name": "string (vide si non mentionné)",
  "phone": "string (numéro téléphone, vide si non mentionné)",
  "zone_name": "string (nom du quartier/zone à Lomé, vide si non mentionné)",
  "address_note": "string (repère local ex: Face pharmacie Nation, vide si non mentionné)",
  "payment_method": "cash" | "tmoney" | "flooz" | "online",
  "items": [
    {
      "product_id": "string | null (id exact du catalogue si trouvé, sinon null)",
      "product_name": "string (nom du produit)",
      "quantity": number
    }
  ],
  "missing_fields": ["liste en français des champs critiques manquants parmi: Nom cliente, Téléphone, Quartier/Zone, Produit"]
}`

    const chatRes = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Message commande : "${transcript}"` },
          ],
        }),
      }
    )

    if (!chatRes.ok) {
      const errText = await chatRes.text()
      return NextResponse.json(
        { error: `Erreur extraction Groq LLM : ${errText}` },
        { status: 502 }
      )
    }

    const chatJson = (await chatRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const rawContent = chatJson.choices?.[0]?.message?.content || '{}'
    let extracted: any = {}
    try {
      extracted = JSON.parse(rawContent)
    } catch {
      extracted = {}
    }

    const customerName = String(extracted.customer_name || '').trim()
    const phone = String(extracted.phone || '').trim()
    const zoneName = String(extracted.zone_name || '').trim()
    const addressNote = String(extracted.address_note || '').trim()
    const rawMethod = String(extracted.payment_method || 'cash').toLowerCase()
    const paymentMethod: ParsedVoiceOrderResult['payment_method'] =
      rawMethod === 'tmoney' ||
      rawMethod === 'flooz' ||
      rawMethod === 'online'
        ? rawMethod
        : 'cash'

    const matchedZone = zonesList.find(
      (z) => z.zone_name.toLowerCase() === zoneName.toLowerCase()
    )
    const deliveryFeeFcfa = matchedZone ? matchedZone.fee_fcfa : 1000

    const rawItems = Array.isArray(extracted.items) ? extracted.items : []
    const items: ParsedVoiceOrderItem[] =
      rawItems.length > 0
        ? rawItems.map((it: any) => {
            const byId = productsCatalog.find((p) => p.id === it.product_id)
            const byName = productsCatalog.find((p) =>
              p.name
                .toLowerCase()
                .includes(String(it.product_name || '').toLowerCase())
            )
            const matchedProd = byId || byName
            return {
              product_id: matchedProd?.id ?? null,
              product_name:
                String(it.product_name || '').trim() ||
                matchedProd?.name ||
                'Article Live TikTok',
              quantity: Math.max(1, Number(it.quantity) || 1),
              unit_price_fcfa: matchedProd?.price_fcfa ?? 10000,
            }
          })
        : [
            {
              product_id: productsCatalog[0]?.id ?? null,
              product_name: productsCatalog[0]?.name || 'Article Live TikTok',
              quantity: 1,
              unit_price_fcfa: productsCatalog[0]?.price_fcfa ?? 10000,
            },
          ]

    const computedMissing = new Set<string>(
      Array.isArray(extracted.missing_fields)
        ? extracted.missing_fields.map((m: any) => String(m))
        : []
    )
    if (!customerName) computedMissing.add('Nom cliente')
    if (!phone) computedMissing.add('Téléphone')
    if (!zoneName) computedMissing.add('Quartier / Zone')

    const missingFields = Array.from(computedMissing)

    const result: ParsedVoiceOrderResult = {
      transcript,
      customer_name: customerName,
      phone,
      zone_name: zoneName,
      delivery_fee_fcfa: deliveryFeeFcfa,
      address_note: addressNote,
      payment_method: paymentMethod,
      items,
      missing_fields: missingFields,
      is_missing_info: missingFields.length > 0,
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur serveur lors de l’analyse.' },
      { status: 500 }
    )
  }
}
