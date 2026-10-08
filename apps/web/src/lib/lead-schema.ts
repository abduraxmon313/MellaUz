import { z } from "zod";
import { locales } from "@/i18n/config";

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  // Telefon: raqam, bo'sh joy, +, -, ( ) belgilariga ruxsat; kamida 7 ta raqam
  phone: z
    .string()
    .trim()
    .min(7)
    .max(25)
    .regex(/^[+()\d][\d\s()-]{6,24}$/),
  product: z.string().trim().max(160).optional().or(z.literal("")),
  note: z.string().trim().max(600).optional().or(z.literal("")),
  locale: z.enum(locales),
  // Oddiy bot-tuzoq (honeypot): odam to'ldirmaydigan maydon
  company: z.string().max(0).optional(),
});

export type LeadPayload = z.infer<typeof leadSchema>;
