import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Megaphone, Plus, ExternalLink } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminVip } from "@/components/AdminVip";
import { AdminVipGrants } from "@/components/AdminVipGrants";
import { PromotionForm } from "@/components/PromotionForm";
import ProviderPicker from "@/components/ProviderPicker";
import {
  BusinessCard,
  BusinessError,
  businessField,
  businessPrimary,
  businessSecondary,
} from "@/components/BusinessUi";
import { OffersQueue, type Offer } from "./AdminProviderBusiness";
import { useLocale } from "@/contexts/LocaleContext";
import { adText } from "@/i18n/advertising";
import { businessError, businessText } from "@/i18n/providerBusiness";
import { trpc } from "@/lib/trpc";

export default function AdminAds() {
  return (
    <DashboardLayout>
      <AdvertisingPanel />
    </DashboardLayout>
  );
}
export function AdvertisingPanel() {
  const { locale } = useLocale();
  const a = adText(locale),
    b = businessText(locale);
  const access = trpc.admin.access.useQuery();
  const read = access.data?.permissions.includes("business.read");
  const manage = access.data?.permissions.includes("business.manage") ?? false;
  const owner = access.data?.role === "owner" && manage;
  const [tab, setTab] = useState("review");
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  if (access.isError || (access.data && !read)) return <BusinessError />;
  if (!read) return <p role="status">{b.loading}</p>;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold">
            <Megaphone className="size-7 text-primary" />
            {a.admin}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            {a.adminHelp}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={businessSecondary} href="/ads">
            {a.preview}
            <ExternalLink className="size-4" />
          </Link>
          {owner && (
            <button
              className={businessPrimary}
              onClick={() => {
                setTab("review");
                setEditing("new");
              }}
            >
              <Plus className="size-4" />
              {a.create}
            </button>
          )}
        </div>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label={a.admin}>
        {[
          { key: "review", label: a.review },
          { key: "placements", label: a.placements },
          ...(owner ? [{ key: "grants", label: a.grants }] : []),
        ].map(item => (
          <button
            key={item.key}
            aria-pressed={tab === item.key}
            className={tab === item.key ? businessPrimary : businessSecondary}
            onClick={() => {
              setTab(item.key);
              setEditing(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === "review" &&
        (editing && owner ? (
          <OwnerAdEditor
            key={
              editing === "new"
                ? "new"
                : editing.promotion.id + ":" + editing.promotion.revision
            }
            initial={editing === "new" ? undefined : editing}
            close={() => setEditing(null)}
          />
        ) : (
          <OffersQueue
            manage={manage}
            pendingDefault={false}
            onEdit={owner ? setEditing : undefined}
          />
        ))}
      {tab === "placements" && <AdminVip manage={manage} />}
      {tab === "grants" && owner && <AdminVipGrants />}
    </div>
  );
}
function OwnerAdEditor({
  initial,
  close,
}: {
  initial?: Offer;
  close: () => void;
}) {
  const { locale } = useLocale();
  const a = adText(locale),
    b = businessText(locale);
  const [providerId, setProvider] = useState(
    initial ? String(initial.promotion.providerId) : ""
  );
  const [showInExplorer, setExplorer] = useState(
    initial?.promotion.showInExplorer ?? false
  );
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();
  const save = trpc.admin.business.savePromotion.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.business.promotions.invalidate(),
        utils.business.promotions.invalidate(),
        utils.business.promotions.mine.invalidate(),
      ]);
      toast.success(a.saved);
      close();
    },
    onError: error => toast.error(businessError(error.message, locale)),
  });
  return (
    <BusinessCard>
      <h2 className="mb-5 text-xl font-bold">{initial ? a.edit : a.create}</h2>
      {initial ? (
        <p className="text-sm">
          <bdi>{initial.providerName}</bdi>
        </p>
      ) : (
        <ProviderPicker
          value={providerId}
          onChange={setProvider}
          emptyLabel={b.select}
        />
      )}
      <label className="mt-5 block text-sm font-semibold">
        {a.placement}
        <select
          value={showInExplorer ? "explorer" : "directory"}
          className={businessField}
          disabled={save.isPending}
          onChange={e => setExplorer(e.target.value === "explorer")}
        >
          <option value="directory">{a.directoryOnly}</option>
          <option value="explorer">{a.explorerAlso}</option>
        </select>
      </label>
      <label className="mt-5 block text-sm font-semibold">
        {a.note}
        <input
          className={businessField}
          minLength={8}
          maxLength={600}
          value={note}
          disabled={save.isPending}
          onChange={e => setNote(e.target.value)}
        />
      </label>
      {providerId ? (
        <PromotionForm
          key={providerId}
          providerId={Number(providerId)}
          initial={initial?.promotion}
          pending={save.isPending}
          error={save.error?.message}
          submitLabel={a.save}
          onCancel={close}
          onSave={input => {
            if (note.trim().length < 8) {
              toast.error(businessError("", locale));
              return;
            }
            save.mutate({
              ...input,
              id: initial?.promotion.id,
              revision: initial?.promotion.revision ?? 0,
              showInExplorer,
              note,
            });
          }}
        />
      ) : (
        <button className={`${businessSecondary} mt-5`} onClick={close}>
          {b.cancel}
        </button>
      )}
    </BusinessCard>
  );
}
