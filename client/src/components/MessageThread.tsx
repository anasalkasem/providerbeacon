import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  Languages,
  Loader2,
  Send,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocale, localeNames, type Locale } from "@/contexts/LocaleContext";
import { messagingCopy, messagingError } from "@/i18n/messaging";
import { usePageVisible } from "@/hooks/usePageVisible";
import type { ChatMessage } from "../../../shared/messaging";

export function MessageBubble({
  message,
  locale,
  onRetry,
}: {
  message: ChatMessage;
  locale: Locale;
  onRetry: () => void;
}) {
  const [original, setOriginal] = useState(false),
    t = messagingCopy[locale];
  const translated =
    message.translation?.status === "done" && message.translation.text;
  return (
    <article
      className={`max-w-[90%] rounded-2xl border px-3.5 py-3 sm:max-w-[84%] ${message.own ? "ms-auto rounded-ee-sm border-transparent bg-[#dce8ad] text-[#1e2917]" : "me-auto rounded-es-sm border-slate-200 bg-white text-slate-900"}`}
    >
      {!message.own && (
        <p className="mb-1 text-xs font-bold text-slate-500">
          {message.sender === "assistant"
            ? t.assistant
            : (message.name ?? t.visitor)}
        </p>
      )}
      <p
        dir="auto"
        className="whitespace-pre-wrap break-words text-[15px] leading-7 [overflow-wrap:anywhere]"
      >
        {translated && !original ? message.translation!.text : message.original}
      </p>
      {message.translation && (
        <div className="mt-2 text-xs leading-5 text-slate-600">
          {translated ? (
            <button
              type="button"
              onClick={() => setOriginal(!original)}
              className="flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              <Languages className="size-3" />
              {original ? t.hideOriginal : t.original}
            </button>
          ) : (
            <span role="status">
              {message.translation.status === "failed"
                ? t.translationFailed
                : t.translating}
            </span>
          )}
          {translated && !original && <span>{t.translated}</span>}
          {message.translation.needsReview && (
            <p className="text-amber-800">{t.review}</p>
          )}
          {message.translation.status === "failed" && (
            <button
              type="button"
              className="ms-2 font-semibold underline"
              onClick={onRetry}
            >
              {t.retry}
            </button>
          )}
        </div>
      )}
      <footer className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-500">
        <time dateTime={new Date(message.createdAt).toISOString()}>
          {new Date(message.createdAt).toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
        {message.own &&
          (message.read ? (
            <CheckCheck aria-label={t.read} className="size-4 text-blue-700" />
          ) : (
            <Check aria-label={t.sent} className="size-4" />
          ))}
      </footer>
    </article>
  );
}

export default function MessageThread({
  id,
  mode,
  onBack,
  onDone,
  userId,
  canAssign = false,
  directory = [],
}: {
  id: string;
  mode: "staff" | "visitor";
  onBack: () => void;
  onDone?: () => void;
  userId?: number;
  canAssign?: boolean;
  directory?: {
    id: number;
    name: string | null;
    available: boolean | null;
    online: boolean;
  }[];
}) {
  const { locale } = useLocale(),
    t = messagingCopy[locale],
    visible = usePageVisible(),
    utils = trpc.useUtils();
  const api = mode === "staff" ? trpc.messaging : trpc.messaging.support;
  const [before, setBefore] = useState<number | undefined>(),
    [draft, setDraft] = useState(""),
    [failure, setFailure] = useState<string | null>(null),
    [atBottom, setAtBottom] = useState(true),
    [confirmEnd, setConfirmEnd] = useState(false);
  const log = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    sendLock = useRef(false),
    sendIdentity = useRef<{ text: string; id: string } | null>(null),
    prepared = useRef(""),
    readKey = useRef("");
  const thread = api.thread.useQuery(
    { conversationId: id, before },
    {
      refetchInterval: visible && !before ? 3000 : false,
      refetchIntervalInBackground: false,
      retry: 1,
    }
  );
  const send = api.send.useMutation(),
    read = api.read.useMutation(),
    prepare = api.prepare.useMutation(),
    finish = api.close.useMutation();
  const assign = trpc.messaging.assign.useMutation(),
    language = trpc.messaging.support.language.useMutation();
  const data = thread.data,
    lastId = data?.items.at(-1)?.id ?? 0;
  const pendingTranslations =
    data?.items
      .filter(m => m.translation?.status === "missing")
      .map(m => m.id) ?? [];
  const pendingKey = `${id}:${data?.locale}:${pendingTranslations.join(",")}`;
  useEffect(() => {
    if (
      visible &&
      pendingTranslations.length &&
      prepared.current !== pendingKey
    ) {
      prepared.current = pendingKey;
      prepare.mutate(
        { conversationId: id, messageIds: pendingTranslations, retry: false },
        {
          onError: () => {
            prepared.current = "";
          },
        }
      );
    }
  }, [visible, pendingKey]);
  useEffect(() => {
    if (atBottom && !before)
      log.current?.scrollTo({
        top: log.current.scrollHeight,
        behavior: "instant",
      });
  }, [lastId, before]);
  useEffect(() => {
    const key = `${id}:${lastId}`;
    if (visible && !before && atBottom && lastId && readKey.current !== key) {
      readKey.current = key;
      read.mutate(
        { conversationId: id, messageId: lastId },
        {
          onSuccess: () => {
            if (mode === "staff") void utils.messaging.list.invalidate();
          },
          onError: () => {
            readKey.current = "";
          },
        }
      );
    }
  }, [visible, before, atBottom, lastId, id]);
  useEffect(() => {
    if (
      mode === "visitor" &&
      data &&
      data.locale !== locale &&
      !language.isPending
    )
      language.mutate(
        { conversationId: id, locale },
        {
          onSuccess: () => {
            void thread.refetch();
          },
        }
      );
  }, [mode, data?.locale, locale, id]);
  const refresh = async () => {
    await thread.refetch();
    if (mode === "staff") await utils.messaging.list.invalidate();
  };
  async function submit() {
    const text = draft.trim();
    if (!text || sendLock.current) return;
    sendLock.current = true;
    setFailure(null);
    if (sendIdentity.current?.text !== text)
      sendIdentity.current = { text, id: crypto.randomUUID() };
    try {
      await send.mutateAsync({
        conversationId: id,
        clientId: sendIdentity.current.id,
        text,
        locale,
      });
      setDraft("");
      sendIdentity.current = null;
      setBefore(undefined);
      setAtBottom(true);
      await refresh();
      input.current?.focus();
    } catch (error) {
      setFailure(`${messagingError(locale, error)} ${t.failedSend}`);
    } finally {
      sendLock.current = false;
    }
  }
  const writable =
    data?.status !== "closed" &&
    (mode === "visitor" ||
      data?.kind === "direct" ||
      data?.assignedUserId === userId);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f4f6ef]">
      <header className="flex shrink-0 items-center gap-2 border-b bg-white px-3 py-3">
        <button
          type="button"
          aria-label={t.back}
          onClick={onBack}
          className="rounded-lg p-2 hover:bg-slate-100"
        >
          <ChevronLeft className="size-5 rtl:rotate-180" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold">
            {data?.name ?? (mode === "visitor" ? t.supportTitle : t.visitor)}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {data?.kind === "support"
              ? data.status === "waiting"
                ? t.waiting
                : data.status === "closed"
                  ? t.closed
                  : mode === "visitor"
                    ? `${t.assigned} ${data.agentName ?? ""}`
                    : t.joined
              : `${t.language}: ${localeNames[data?.locale ?? locale]}`}
          </p>
        </div>
        {data?.kind === "support" && data.status !== "closed" && (
          <button
            type="button"
            onClick={() => setConfirmEnd(true)}
            className="rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            {t.finish}
          </button>
        )}
      </header>
      {confirmEnd && (
        <div className="border-b border-amber-200 bg-amber-50 p-3 text-sm">
          <p>{t.finishConfirm}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={finish.isPending}
              className="rounded-lg bg-ink px-3 py-2 font-bold text-white"
              onClick={async () => {
                try {
                  await finish.mutateAsync({ conversationId: id });
                  setConfirmEnd(false);
                  await refresh();
                  onDone?.();
                } catch (e) {
                  setFailure(messagingError(locale, e));
                }
              }}
            >
              {t.finish}
            </button>
            <button
              type="button"
              onClick={() => setConfirmEnd(false)}
              className="px-3"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
      {data?.kind === "support" &&
        mode === "staff" &&
        canAssign &&
        data.status !== "closed" && (
          <label className="flex items-center gap-2 border-b bg-white px-4 py-2 text-xs">
            {t.reassign}
            <select
              aria-label={t.reassign}
              className="min-w-0 flex-1 rounded-md border bg-white p-1.5"
              value={data.assignedUserId ?? ""}
              disabled={assign.isPending}
              onChange={async e => {
                try {
                  await assign.mutateAsync({
                    conversationId: id,
                    userId: Number(e.target.value),
                  });
                  await refresh();
                } catch (error) {
                  setFailure(messagingError(locale, error));
                }
              }}
            >
              <option value="" disabled>
                {t.reassign}
              </option>
              {[
                { id: userId!, name: t.team, available: true, online: true },
                ...directory,
              ]
                .filter(
                  a => (a.available && a.online) || a.id === data.assignedUserId
                )
                .map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? t.team}
                  </option>
                ))}
            </select>
          </label>
        )}
      {thread.isError && (
        <div role="alert" className="bg-amber-50 p-3 text-sm text-amber-900">
          {data ? t.connectionError : t.conversationError}
          <button
            type="button"
            className="ms-2 underline"
            onClick={() => void thread.refetch()}
          >
            {t.retry}
          </button>
        </div>
      )}
      <div
        ref={log}
        role="log"
        aria-label={t.history}
        aria-live="polite"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4"
        onScroll={e => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
        }}
      >
        {thread.isLoading && (
          <p role="status" className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin" />
          </p>
        )}
        {data?.nextCursor && (
          <button
            type="button"
            className="mx-auto block rounded-full border bg-white px-4 py-2 text-xs font-semibold"
            onClick={() => {
              setBefore(data.nextCursor!);
              setAtBottom(false);
            }}
          >
            {t.older}
          </button>
        )}
        {before && (
          <button
            type="button"
            onClick={() => {
              setBefore(undefined);
              setAtBottom(true);
            }}
            className="mx-auto block text-xs font-bold underline"
          >
            {t.latest}
          </button>
        )}
        {data?.status === "waiting" && (
          <p
            role="status"
            className="rounded-xl border border-beacon-200 bg-beacon-50 p-3 text-sm leading-6 text-beacon-900"
          >
            {t.waitHint}
          </p>
        )}
        {data?.items.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            locale={locale}
            onRetry={() =>
              prepare.mutate(
                { conversationId: id, messageIds: [message.id], retry: true },
                {
                  onSuccess: () => void thread.refetch(),
                  onError: e => setFailure(messagingError(locale, e)),
                }
              )
            }
          />
        ))}
      </div>
      {failure && (
        <div
          role="alert"
          className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          {failure}
        </div>
      )}
      {data?.status === "closed" ? (
        <div className="border-t bg-white p-4 text-center text-sm text-slate-500">
          {t.closed}
        </div>
      ) : (
        <form
          className="shrink-0 border-t bg-white p-3"
          onSubmit={e => {
            e.preventDefault();
            void submit();
          }}
        >
          {!writable && data && (
            <p className="mb-2 text-xs text-amber-800">{t.claimFirst}</p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={input}
              aria-label={t.placeholder}
              placeholder={t.placeholder}
              dir="auto"
              rows={2}
              maxLength={2000}
              disabled={!data || !writable || send.isPending}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void submit();
                }
              }}
              className="max-h-32 min-h-14 min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[15px] leading-6 focus:border-beacon-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label={send.isPending ? t.pending : t.send}
              disabled={!data || !writable || send.isPending || !draft.trim()}
              className="rounded-xl bg-ink p-3 text-beacon-300 disabled:opacity-40"
            >
              {send.isPending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Send className="size-5 rtl:-scale-x-100" />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
