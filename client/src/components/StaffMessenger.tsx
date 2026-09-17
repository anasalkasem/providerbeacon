import { useEffect, useRef, useState } from "react";
import { MessageCircle, Plus, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { ConversationCursor } from "../../../shared/messaging";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocale, localeNames, type Locale } from "@/contexts/LocaleContext";
import { usePageVisible } from "@/hooks/usePageVisible";
import { messagingCopy, messagingError } from "@/i18n/messaging";
import MessageThread from "./MessageThread";

export default function StaffMessenger() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [readyUser, setReadyUser] = useState<number | null>(null);
  useEffect(() => {
    const clear = () =>
      queryClient.removeQueries({
        predicate: query =>
          Array.isArray(query.queryKey[0]) &&
          query.queryKey[0][0] === "messaging",
      });
    clear();
    setReadyUser(user?.id ?? null);
    return clear;
  }, [user?.id, queryClient]);
  const access = trpc.admin.access.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });
  if (!user || readyUser !== user.id || !access.data?.role) return null;
  return <Messenger key={user.id} />;
}
function Messenger() {
  const { locale, dir } = useLocale(),
    t = messagingCopy[locale],
    visible = usePageVisible(),
    utils = trpc.useUtils();
  const [open, setOpen] = useState(false),
    [active, setActive] = useState<string | null>(null),
    [tab, setTab] = useState<"team" | "customers">("team"),
    [showPeople, setShowPeople] = useState(false),
    [search, setSearch] = useState(""),
    [before, setBefore] = useState<ConversationCursor | undefined>(),
    [failure, setFailure] = useState<string | null>(null);
  const launcher = useRef<HTMLButtonElement>(null),
    observed = useRef<Map<string, number> | null>(null);
  const profile = trpc.messaging.profile.useQuery(undefined, {
    retry: false,
    staleTime: 30000,
  });
  const list = trpc.messaging.list.useQuery(
    before === undefined ? undefined : { before },
    {
      enabled: visible && !!profile.data,
      refetchInterval: visible ? (open && !before ? 3000 : 12000) : false,
      refetchIntervalInBackground: false,
      retry: 1,
    }
  );
  const people = trpc.messaging.directory.useQuery(undefined, {
    enabled: open,
    staleTime: 15000,
    refetchInterval: open && visible ? 30000 : false,
  });
  const presence = trpc.messaging.presence.useMutation(),
    direct = trpc.messaging.direct.useMutation(),
    claim = trpc.messaging.assign.useMutation();
  const language = profile.data?.locale ?? locale;
  useEffect(() => {
    if (!visible || !profile.data) return;
    const pulse = () => presence.mutate({ locale: language });
    pulse();
    const timer = setInterval(pulse, 30000);
    return () => clearInterval(timer);
  }, [visible, !!profile.data, language]);
  useEffect(() => {
    if (!list.data || before !== undefined) return;
    const next = new Map(
      list.data.items.map(item => [item.id, item.lastMessageId])
    );
    if (observed.current) {
      const changed = list.data.items.find(
        item =>
          item.unread > 0 &&
          item.lastMessageId > (observed.current!.get(item.id) ?? 0) &&
          (!open || active !== item.id)
      );
      if (changed)
        toast(t.newMessage, {
          description: changed.name ?? t.visitor,
          action: {
            label: t.open,
            onClick: () => {
              setActive(changed.id);
              setOpen(true);
            },
          },
        });
    }
    observed.current = next;
  }, [list.data, open, active, before]);
  const unread =
    (list.data?.items.reduce((sum, item) => sum + item.unread, 0) ?? 0) +
    (list.data?.queue.length ?? 0);
  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  async function updateSettings(value: {
    locale: Locale;
    available?: boolean;
  }) {
    try {
      setFailure(null);
      await presence.mutateAsync(value);
      await profile.refetch();
      await list.refetch();
    } catch (e) {
      setFailure(messagingError(locale, e));
    }
  }
  return (
    <div dir={dir} translate="no">
      <button
        ref={launcher}
        type="button"
        aria-label={t.title}
        aria-expanded={open}
        aria-controls="staff-messenger"
        onClick={() => setOpen(!open)}
        className={`fixed bottom-5 end-5 z-[65] flex items-center gap-2 rounded-full bg-ink px-5 py-3.5 font-bold text-white shadow-xl ring-1 ring-white/20 ${open ? "hidden" : ""}`}
      >
        <MessageCircle className="size-5 text-beacon-300" />
        {t.title}
        {unread > 0 && (
          <span className="rounded-full bg-beacon-300 px-2 py-0.5 text-xs text-ink">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <section
          id="staff-messenger"
          role="dialog"
          aria-label={t.title}
          onKeyDown={e => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
          className="fixed inset-x-2 bottom-2 z-[70] flex h-[min(750px,calc(100dvh-20px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:end-5 sm:w-[min(860px,calc(100vw-40px))]"
        >
          <header className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
            <MessageCircle className="size-5 text-beacon-300" />
            <h2 className="flex-1 font-bold">{t.title}</h2>
            <button
              type="button"
              aria-label={t.close}
              onClick={close}
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b bg-slate-50 px-4 py-3 text-xs sm:text-sm">
            <label className="flex items-center gap-2">
              {t.language}
              <select
                aria-label={t.language}
                value={language}
                disabled={presence.isPending}
                onChange={e =>
                  void updateSettings({ locale: e.target.value as Locale })
                }
                className="max-w-32 rounded-lg border bg-white px-2 py-1.5"
              >
                {Object.entries(localeNames).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {profile.data?.canSupport && (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={t.available}
                  checked={profile.data.available}
                  disabled={presence.isPending}
                  onChange={e =>
                    void updateSettings({
                      locale: language,
                      available: e.target.checked,
                    })
                  }
                  className="size-4 accent-[#5b7029]"
                />
                {profile.data.available ? t.available : t.unavailable}
              </label>
            )}
          </div>
          {(failure || list.isError || profile.isError) && (
            <p
              role="alert"
              className="bg-amber-50 px-4 py-2 text-sm text-amber-900"
            >
              {failure ?? t.connectionError}
              <button
                className="ms-2 underline"
                onClick={() => {
                  void profile.refetch();
                  void list.refetch();
                }}
              >
                {t.retry}
              </button>
            </p>
          )}
          {profile.data && !profile.data.translationAvailable && (
            <p className="bg-amber-50 px-4 py-2 text-xs text-amber-900">
              {t.translationOff}
            </p>
          )}
          <div className="flex min-h-0 flex-1">
            <aside
              className={`min-h-0 w-full shrink-0 flex-col border-e bg-white sm:w-64 ${active ? "hidden sm:flex" : "flex"}`}
            >
              <div className="flex items-center gap-1 border-b p-2">
                <button
                  type="button"
                  aria-pressed={tab === "team"}
                  onClick={() => {
                    setTab("team");
                    setShowPeople(false);
                    setBefore(undefined);
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${tab === "team" ? "bg-beacon-100 text-beacon-900" : "text-slate-500"}`}
                >
                  {t.team}
                </button>
                <button
                  type="button"
                  aria-pressed={tab === "customers"}
                  onClick={() => {
                    setTab("customers");
                    setShowPeople(false);
                    setBefore(undefined);
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${tab === "customers" ? "bg-beacon-100 text-beacon-900" : "text-slate-500"}`}
                >
                  {t.customers}
                  {!!list.data?.queue.length && ` (${list.data.queue.length})`}
                </button>
              </div>
              {tab === "team" && (
                <button
                  type="button"
                  onClick={() => setShowPeople(!showPeople)}
                  className="m-3 flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  <Plus className="size-4" />
                  {t.newChat}
                </button>
              )}
              {showPeople && (
                <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border px-2">
                  <Search className="size-4 text-slate-400" />
                  <input
                    aria-label={t.newChat}
                    placeholder={t.newChat}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
                  />
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {showPeople ? (
                  <>
                    {people.data
                      ?.filter(person =>
                        (person.name ?? "")
                          .toLowerCase()
                          .includes(search.toLowerCase())
                      )
                      .map(person => (
                        <button
                          key={person.id}
                          type="button"
                          disabled={direct.isPending}
                          onClick={async () => {
                            try {
                              const result = await direct.mutateAsync({
                                recipientId: person.id,
                              });
                              setActive(result.id);
                              setShowPeople(false);
                              await list.refetch();
                            } catch (e) {
                              setFailure(messagingError(locale, e));
                            }
                          }}
                          className="mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-start hover:bg-beacon-50"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold">
                            {person.name?.slice(0, 2) ?? "…"}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {person.name ?? t.team}
                            </span>
                            <span className="text-xs text-slate-500">
                              {person.online ? t.online : t.offline}
                            </span>
                          </span>
                        </button>
                      ))}
                    {people.data?.length === 0 && (
                      <p className="p-3 text-sm leading-6 text-slate-500">
                        {t.noTeam}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {tab === "customers" && (
                      <div className="mb-3">
                        {!profile.data?.available &&
                          profile.data?.canSupport && (
                            <p className="px-2 py-2 text-xs leading-5 text-slate-500">
                              {t.leaveOffline}
                            </p>
                          )}
                        {list.data?.queue.map(item => (
                          <div
                            key={item.id}
                            className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3"
                          >
                            <p className="text-sm font-bold">
                              {item.name ?? t.visitor}
                            </p>
                            <p className="mt-1 text-xs text-amber-800">
                              {t.waiting} ·{" "}
                              {localeNames[item.locale as Locale] ??
                                item.locale}
                            </p>
                            <button
                              type="button"
                              disabled={
                                claim.isPending || !profile.data?.available
                              }
                              className="mt-2 rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                              onClick={async () => {
                                try {
                                  await claim.mutateAsync({
                                    conversationId: item.id,
                                    userId: profile.data!.userId,
                                  });
                                  setActive(item.id);
                                  await list.refetch();
                                } catch (e) {
                                  setFailure(messagingError(locale, e));
                                }
                              }}
                            >
                              {t.accept}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {list.data?.items
                      .filter(
                        item =>
                          item.kind === (tab === "team" ? "direct" : "support")
                      )
                      .map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActive(item.id)}
                          className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-start ${active === item.id ? "bg-beacon-100" : "hover:bg-slate-50"}`}
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100">
                            <Users className="size-4 text-slate-500" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">
                              {item.name ?? t.visitor}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {item.status === "closed"
                                ? t.closed
                                : new Date(item.updatedAt).toLocaleDateString(
                                    locale,
                                    { month: "short", day: "numeric" }
                                  )}
                            </span>
                          </span>
                          {item.unread > 0 && (
                            <span className="rounded-full bg-beacon-600 px-2 py-0.5 text-xs text-white">
                              {item.unread}
                            </span>
                          )}
                        </button>
                      ))}
                    {!list.isLoading &&
                      !list.data?.items.some(
                        item =>
                          item.kind === (tab === "team" ? "direct" : "support")
                      ) && (
                        <p className="p-3 text-sm leading-6 text-slate-500">
                          {t.empty}
                        </p>
                      )}
                    {list.data?.nextCursor != null && (
                      <button
                        type="button"
                        onClick={() => setBefore(list.data!.nextCursor!)}
                        className="p-3 text-xs font-bold underline"
                      >
                        {t.more}
                      </button>
                    )}
                    {before !== undefined && (
                      <button
                        type="button"
                        onClick={() => setBefore(undefined)}
                        className="p-3 text-xs font-bold underline"
                      >
                        {t.latest}
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="border-t px-3 py-2 text-[11px] leading-5 text-slate-500">
                {t.privacy}
              </p>
            </aside>
            {active ? (
              <MessageThread
                key={active}
                id={active}
                mode="staff"
                userId={profile.data?.userId}
                canAssign={profile.data?.canAssign}
                directory={people.data}
                onBack={() => setActive(null)}
              />
            ) : (
              <div className="hidden flex-1 flex-col items-center justify-center gap-4 bg-[#f4f6ef] p-8 text-center sm:flex">
                <span className="grid size-16 place-items-center rounded-2xl bg-beacon-100">
                  <MessageCircle className="size-8 text-beacon-800" />
                </span>
                <p className="max-w-60 text-sm leading-7 text-slate-500">
                  {t.choose}
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
