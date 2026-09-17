import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuthText } from "@/i18n/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const copy = {
  en: {
    disable: "Turn off authenticator",
    body: "Sign-in will use your password without an authenticator code. Your other sessions and existing recovery codes will be revoked. Confirm with your current password and an authenticator or recovery code.",
    confirm: "Confirm and turn off",
    cancel: "Cancel",
    done: "Authenticator turned off. You can enable it again at any time.",
    invalid: "Check your current password and authenticator or recovery code.",
    unavailable:
      "Unable to turn off the authenticator. Sign in again and retry.",
  },
  ar: {
    disable: "إيقاف تطبيق المصادقة",
    body: "بعد الإيقاف سيعتمد الدخول على كلمة المرور فقط. ستُلغى الجلسات الأخرى ورموز الاسترداد الحالية. أكّد بكلمة المرور الحالية ورمز التطبيق أو أحد رموز الاسترداد.",
    confirm: "تأكيد إيقاف المصادقة",
    cancel: "إلغاء",
    done: "تم إيقاف تطبيق المصادقة. يمكنك تفعيله مجددًا في أي وقت.",
    invalid: "تحقق من كلمة المرور الحالية ورمز التطبيق أو رمز الاسترداد.",
    unavailable: "تعذر إيقاف المصادقة. سجّل الدخول مجددًا وحاول مرة أخرى.",
  },
  es: {
    disable: "Desactivar autenticador",
    body: "El acceso usará solo tu contraseña. Se revocarán las otras sesiones y los códigos de recuperación actuales. Confirma con tu contraseña actual y un código del autenticador o de recuperación.",
    confirm: "Confirmar y desactivar",
    cancel: "Cancelar",
    done: "Autenticador desactivado. Puedes activarlo de nuevo cuando quieras.",
    invalid:
      "Revisa tu contraseña actual y el código del autenticador o de recuperación.",
    unavailable:
      "No se pudo desactivar el autenticador. Inicia sesión de nuevo e inténtalo otra vez.",
  },
  hi: {
    disable: "ऑथेंटिकेटर बंद करें",
    body: "साइन इन के लिए केवल पासवर्ड लगेगा। अन्य सत्र और पुराने रिकवरी कोड रद्द होंगे। मौजूदा पासवर्ड और ऑथेंटिकेटर या रिकवरी कोड से पुष्टि करें।",
    confirm: "पुष्टि करके बंद करें",
    cancel: "रद्द करें",
    done: "ऑथेंटिकेटर बंद है। आप इसे फिर चालू कर सकते हैं।",
    invalid: "मौजूदा पासवर्ड और ऑथेंटिकेटर या रिकवरी कोड जाँचें।",
    unavailable: "ऑथेंटिकेटर बंद नहीं हुआ। दोबारा साइन इन करके प्रयास करें।",
  },
  zh: {
    disable: "关闭身份验证器",
    body: "关闭后仅使用密码登录。其他会话及现有恢复代码将失效。请使用当前密码和身份验证器代码或恢复代码确认。",
    confirm: "确认关闭",
    cancel: "取消",
    done: "身份验证器已关闭，您可以随时重新启用。",
    invalid: "请检查当前密码及身份验证器代码或恢复代码。",
    unavailable: "无法关闭身份验证器，请重新登录后重试。",
  },
};

export function DisableMfa({
  onDisabled,
}: {
  onDisabled: () => Promise<unknown>;
}) {
  const { locale } = useLocale();
  const t = copy[locale];
  const text = useAuthText();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const close = () => {
    setPassword("");
    setCode("");
    setError("");
    setOpen(false);
  };
  const disable = trpc.auth.security.disableMfa.useMutation({
    onSuccess: async () => {
      close();
      toast.success(t.done);
      await onDisabled();
    },
    onError: error =>
      setError(
        error.message === "auth_mfa_invalid_proof" ? t.invalid : t.unavailable
      ),
  });
  if (!open)
    return (
      <Button
        type="button"
        variant="outline"
        className="mt-6 w-full text-danger"
        onClick={() => setOpen(true)}
      >
        {t.disable}
      </Button>
    );
  return (
    <form
      className="mt-6 grid gap-4 rounded-xl border border-warning-border bg-warning-muted p-4"
      onSubmit={event => {
        event.preventDefault();
        setError("");
        disable.mutate({ currentPassword: password, code, confirm: true });
      }}
    >
      <p className="text-sm leading-6 text-warning">{t.body}</p>
      <label className="grid gap-2 text-sm font-semibold">
        {text("currentPassword")}
        <Input
          dir="ltr"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        {text("verificationCode")}
        <Input
          dir="ltr"
          autoComplete="one-time-code"
          maxLength={32}
          value={code}
          onChange={e => setCode(e.target.value)}
          required
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          disabled={disable.isPending || !password || code.trim().length < 6}
        >
          {disable.isPending && <Loader2 className="size-4 animate-spin" />}
          {t.confirm}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disable.isPending}
          onClick={close}
        >
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
