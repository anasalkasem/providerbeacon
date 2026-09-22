import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { reviewWorkspaceText } from "@/i18n/reviewWorkspace";
import { reviewWorkspaceInput } from "../../../shared/reviewWorkspace";
import {
  BusinessCard,
  BusinessError,
  BusinessStatus,
  businessField,
  businessPrimary,
} from "./BusinessUi";

export function AdminReviewWorkspace() {
  const { locale } = useLocale();
  const t = reviewWorkspaceText(locale);
  const utils = trpc.useUtils();
  const query = trpc.admin.business.reviewWorkspace.state.useQuery(undefined, {
    retry: false,
    staleTime: 0,
  });
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const save = trpc.admin.business.reviewWorkspace.provision.useMutation({
    onSuccess: async () => {
      toast.success(t.saved);
      setConfirmed(false);
      await Promise.all([
        utils.admin.business.invalidate(),
        utils.business.invalidate(),
      ]);
    },
  });
  if (query.isError) return <BusinessError />;
  return (
    <BusinessCard>
      <h2 className="text-xl font-bold">{t.title}</h2>
      <p className="mt-3 text-sm leading-7 text-secondary-foreground">
        {t.help}
      </p>
      {query.data && (
        <div className="mt-5 rounded-xl bg-muted p-4 space-y-2">
          <p className="font-bold" dir="ltr">
            {query.data.name}
          </p>
          <p dir="ltr">{query.data.email}</p>
          <BusinessStatus value={query.data.state} />
          {query.data.endsAt && (
            <p>
              {t.expires}:{" "}
              <bdi>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(query.data.endsAt)}
              </bdi>
            </p>
          )}
        </div>
      )}
      <form
        className="mt-6 space-y-4"
        onSubmit={event => {
          event.preventDefault();
          const input = reviewWorkspaceInput.safeParse({
            email,
            note,
            privateOnly: confirmed,
          });
          if (input.success && !save.isPending) save.mutate(input.data);
        }}
      >
        <fieldset
          disabled={save.isPending || query.isLoading}
          className="space-y-4"
        >
          <label className="block text-sm font-semibold">
            {t.email}
            <input
              className={businessField}
              type="email"
              dir="ltr"
              required
              maxLength={320}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            {t.note}
            <textarea
              className={businessField}
              required
              minLength={8}
              maxLength={600}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </label>
          <label className="flex gap-3 text-sm leading-7">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            {t.confirm}
          </label>
          {save.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t.unavailable}
            </p>
          )}
          <button
            type="submit"
            className={businessPrimary}
            disabled={!confirmed}
          >
            {t.save}
          </button>
        </fieldset>
      </form>
    </BusinessCard>
  );
}
