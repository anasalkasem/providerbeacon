import AdminAppearance from "@/components/AdminAppearance";
import DashboardLayout from "@/components/DashboardLayout";
import { useAdminText } from "@/i18n/admin";
import { trpc } from "@/lib/trpc";

export default function AdminThemes() {
  const text = useAdminText();
  const access = trpc.admin.access.useQuery(undefined, { retry: false });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1450px] p-2 sm:p-5">
        <header className="border-b border-border pb-6">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-foreground">
            {text("controlCenter")}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
            {text("themes")}
          </h1>
        </header>
        {access.data?.role === "owner" && !access.isError ? (
          <AdminAppearance />
        ) : (
          <p role="status" className="mt-6 text-sm text-muted-foreground">
            {access.isLoading ? text("loading") : text("accessRestricted")}
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
