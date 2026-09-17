import { z } from "zod";

export const screeningStates = [
  "pending",
  "clear",
  "held",
  "review",
  "manual_clear",
] as const;
export const screeningReasons = [
  "none",
  "invalid_values",
  "missing_source",
  "unclear",
  "contradictory",
  "unavailable",
] as const;
export const screeningDecisionInput = z
  .object({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
    action: z.enum(["retry", "release", "hold"]),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();

export const screeningLabels = {
  ar: {
    pending: "بانتظار الفحص",
    clear: "اجتاز فحص المحتوى",
    held: "محجوب تلقائيًا",
    review: "يحتاج مراجعة بشرية",
    manual_clear: "تم رفع الحجب يدويًا",
    none: "لم يرصد الفحص مشكلة في المحتوى",
    invalid_values: "سعر أو حدود طلب غير صالحة",
    missing_source: "الخدمة غير موجودة في آخر مزامنة صحيحة",
    unclear: "وصف الخدمة غير مفهوم أو غير كافٍ",
    contradictory: "معلومات متناقضة في وصف الخدمة",
    unavailable: "المصدر يذكر أن الخدمة غير متوفرة",
  },
  en: {
    pending: "Awaiting screening",
    clear: "Content screening passed",
    held: "Automatically hidden",
    review: "Human review needed",
    manual_clear: "Manually released",
    none: "No content issue detected",
    invalid_values: "Invalid price or order limits",
    missing_source: "Absent from the last valid source snapshot",
    unclear: "Unclear or insufficient service description",
    contradictory: "Contradictory service information",
    unavailable: "Source says the service is unavailable",
  },
};
