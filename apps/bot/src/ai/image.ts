import { config } from "../config.js";

/**
 * Mahsulot rasmining fonini tozalash — OpenAI Images API (POST /v1/images/edits).
 * Hujjat: https://developers.openai.com/api/reference/resources/images/methods/edit
 *
 * Kalit faqat env'da (OPENAI_API_KEY). Model, sifat, o'lcham va prompt env orqali almashtiriladi.
 */

export const DEFAULT_PROMPT = [
  "Turn this photo into a professional e-commerce catalog photo of the product.",
  "Keep the product itself EXACTLY as it is: same shape, proportions, color, material texture, stitching,",
  "seams, hardware, buckles, soles, logos and details. Do not redesign, restyle, recolor, add or remove any part of the product.",
  "Remove everything that is not the product: background, floor, walls, furniture, hands, people, mannequins,",
  "hangers, price tags, labels, packaging, other items, text and watermarks.",
  "Place the product centered on a clean, seamless, light warm-white studio background (#F7F4EF),",
  "with a soft natural shadow beneath it. Soft, even studio lighting, sharp focus, true-to-life colors.",
  "The whole product must be fully visible with some margin around it. Vertical 4:5 framing.",
  "No text, no watermark, no props, no extra objects.",
].join(" ");

export class AiImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiImageError";
  }
}

interface EditResponse {
  data?: { b64_json?: string }[];
  output_format?: string;
  error?: { message?: string; code?: string };
}

function explain(status: number, body: EditResponse | null): string {
  const msg = body?.error?.message ?? "";
  if (status === 401) return "OPENAI_API_KEY noto‘g‘ri yoki bekor qilingan.";
  if (status === 429) return `OpenAI limiti yoki balansi tugagan. ${msg}`.trim();
  if (status === 400 && /safety|moderation/i.test(msg)) return "OpenAI rasmni xavfsizlik filtri sababli rad etdi.";
  return `OpenAI xatosi (${status}): ${msg || "noma’lum"}`;
}

/**
 * Rasmni AI'ga yuboradi va ishlov berilgan JPEG'ni qaytaradi.
 * Odatda 20–90 soniya davom etadi.
 */
export async function cleanProductPhoto(
  photo: Buffer,
  mime: string,
  opts: { safetyId?: string } = {},
): Promise<{ data: Buffer; contentType: string }> {
  const { apiKey, apiUrl, model, quality, size, prompt } = config.openai;
  if (!apiKey) throw new AiImageError("OPENAI_API_KEY o‘rnatilmagan.");

  const res = await fetch(`${apiUrl}/images/edits`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      images: [{ image_url: `data:${mime};base64,${photo.toString("base64")}` }],
      prompt: prompt || DEFAULT_PROMPT,
      size,
      quality,
      background: "opaque",
      output_format: "jpeg",
      output_compression: 90,
      n: 1,
      ...(opts.safetyId ? { safety_identifier: opts.safetyId } : {}),
    }),
    signal: AbortSignal.timeout(240_000),
  }).catch((e: Error) => {
    throw new AiImageError(e.name === "TimeoutError" ? "OpenAI javob bermadi (4 daqiqa)." : `OpenAI'ga ulanib bo‘lmadi: ${e.message}`);
  });

  const text = await res.text();
  let body: EditResponse | null = null;
  try {
    body = text ? (JSON.parse(text) as EditResponse) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw new AiImageError(explain(res.status, body));

  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new AiImageError("OpenAI rasm qaytarmadi.");
  const fmt = body?.output_format ?? "jpeg";
  return { data: Buffer.from(b64, "base64"), contentType: `image/${fmt === "jpg" ? "jpeg" : fmt}` };
}
