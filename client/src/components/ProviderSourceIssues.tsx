import { useState } from "react";
import { useAdminText } from "@/i18n/admin";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";

const issueLabels = {
  invalid_id: "syncIssueIdentity",
  invalid_name: "syncIssueName",
  invalid_price: "syncIssuePrice",
  invalid_minimum: "syncIssueMinimum",
  invalid_maximum: "syncIssueMaximum",
} as const;

// Mounted only after an administrator opens a report. The server returns at
// most 25 whitelisted issue summaries, independently of catalogue size.
export default function ProviderSourceIssues({ jobId }: { jobId: number }) {
  const text = useAdminText();
  const [cursors, setCursors] = useState<number[]>([0]);
  const issues = trpc.admin.integrations.issues.useQuery(
    { jobId, cursor: cursors.at(-1) },
    { retry: false }
  );
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs leading-5 text-secondary-foreground">
        {text("syncIssuesBody")}
      </p>
      {issues.isLoading ? (
        <p>{text("loading")}</p>
      ) : issues.error ? (
        <p role="alert">
          {text("loadError")}{" "}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void issues.refetch()}
          >
            {text("retry")}
          </Button>
        </p>
      ) : !issues.data?.items.length ? (
        <p className="text-sm text-secondary-foreground">{text("syncNoIssues")}</p>
      ) : (
        issues.data.items.map(item => (
          <div
            key={item.ordinal}
            className="min-w-0 rounded-xl border border-warning-border bg-card p-4"
          >
            <p className="break-words text-xs font-bold text-muted-foreground">
              {text("syncIssueId")}: <bdi>{item.externalId}</bdi>
            </p>
            <p
              dir="auto"
              className="mt-1 break-words text-sm font-semibold text-foreground"
            >
              {item.name ?? "—"}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
              {(
                [
                  ["syncIssueRate", item.rate],
                  ["syncIssueMin", item.min],
                  ["syncIssueMax", item.max],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="text-muted-foreground">{text(key)}</dt>
                  <dd className="mt-1 break-words font-bold">
                    <bdi>{value ?? "—"}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 space-y-1 text-xs text-warning">
              {item.problems.map(problem => (
                <li key={problem}>
                  {text(
                    issueLabels[problem as keyof typeof issueLabels] ??
                      "syncDetails"
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={cursors.length === 1 || issues.isFetching}
          onClick={() => setCursors(values => values.slice(0, -1))}
        >
          {text("previous")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!issues.data?.nextCursor || issues.isFetching}
          onClick={() =>
            setCursors(values => [...values, issues.data!.nextCursor!])
          }
        >
          {text("next")}
        </Button>
      </div>
    </div>
  );
}
