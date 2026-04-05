import OpenAI from 'openai';

export type ParsedOrder = {
  provider: 'amazon' | 'uber' | 'uber_eats' | 'doordash' | 'other';
  orderId?: string | null;
  orderDate?: string | null;
  promisedDeliveryTime?: string | null;
  actualDeliveryTime?: string | null;
  orderValueCents?: number | null;
  currency?: string | null;
  merchantName?: string | null;
};

const systemPrompt = `
You are an assistant that extracts structured order and delivery information from email receipts and confirmations.
Supported providers: Amazon, Uber, Uber Eats, DoorDash, or other delivery services.

Given the raw email text (including any OCR'd attachment text), return a compact JSON object with:
- provider: "amazon" | "uber" | "uber_eats" | "doordash" | "other"
- orderId
- orderDate (ISO 8601)
- promisedDeliveryTime (ISO 8601 if a promised delivery time/date is mentioned)
- actualDeliveryTime (ISO 8601 if an actual or delivered timestamp is mentioned)
- orderValueCents (integer, in cents)
- currency (e.g. "USD")
- merchantName

If a field is unknown, use null. Only output JSON, no explanation.
`.trim();

export async function parseReceiptText(
  text: string
): Promise<ParsedOrder | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Without an API key we can't use the AI parser; caller can fall back to heuristics.
    return null;
  }

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text.slice(0, 8000) },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as ParsedOrder;
    return parsed;
  } catch {
    return null;
  }
}

