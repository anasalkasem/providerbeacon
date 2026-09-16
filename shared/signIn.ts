import { safeMemberNext } from "./memberAuth";

export function safeStaffNext(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 600 ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/admin";
  try {
    const url = new URL(value, "https://staff.invalid");
    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      url.origin !== "https://staff.invalid"
    )
      return "/admin";
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
      return `${url.pathname}${url.search}`;
    const next = safeMemberNext(value);
    return next === "/account" ||
      next.startsWith("/account/") ||
      next.startsWith("/account?")
      ? "/admin"
      : next;
  } catch {
    return "/admin";
  }
}
