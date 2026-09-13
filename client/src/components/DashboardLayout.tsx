import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { useLocale, localeNames, type Locale } from "@/contexts/LocaleContext";
import { useAdminText, type AdminTextKey } from "@/i18n/admin";
import { Bell, ClipboardCheck, BadgeCheck, KeyRound, Languages, Layers3, LayoutDashboard, LockKeyhole, LogOut, PanelLeft, ScrollText, Users } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "overview" as AdminTextKey, path: "/admin", permission: null },
  { icon: BadgeCheck, label: "providers" as AdminTextKey, path: "/admin/providers", permission: "providers.read" },
  { icon: Layers3, label: "services" as AdminTextKey, path: "/admin/services", permission: "services.read" },
  { icon: ClipboardCheck, label: "reviewQueue" as AdminTextKey, path: "/admin/review", permission: "services.read" },
  { icon: Bell, label: "alertsTitle" as AdminTextKey, path: "/admin/alerts", permission: "integrations.read" },
  { icon: KeyRound, label: "integrations" as AdminTextKey, path: "/admin/integrations", permission: "integrations.read" },
  { icon: Users, label: "team" as AdminTextKey, path: "/admin/team", permission: "team.read" },
  { icon: Languages, label: "translations" as AdminTextKey, path: "/admin/translations", permission: "translations.read" },
  { icon: ScrollText, label: "audit" as AdminTextKey, path: "/admin/audit", permission: "audit.read" },
  { icon: LockKeyhole, label: "security" as AdminTextKey, path: "/admin/security", permission: null },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const width = Number(saved);
    return saved && Number.isFinite(width) ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const text = useAdminText();
  const access = trpc.admin.access.useQuery(undefined, { enabled: Boolean(user), retry: false });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading || (user && access.isLoading)) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              {text("signInContinue")}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {text("authRequired")}
            </p>
          </div>
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            {text("signIn")}
          </Button>
        </div>
      </div>
    );
  }

  if (access.isError || !access.data?.role) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600"><PanelLeft /></div>
          <h1 className="mt-5 text-2xl font-extrabold text-slate-950">{text("accessRestricted")}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{text("accessBody")}</p>
          <Button className="mt-6 w-full" onClick={() => window.location.assign("/")}>{text("returnHome")}</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth} permissions={access.data.permissions}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  permissions: string[];
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  permissions,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { locale, dir, setLocale } = useLocale();
  const text = useAdminText();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const bounds = sidebarRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const newWidth = dir === "rtl" ? bounds.right - e.clientX : e.clientX - bounds.left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth, dir]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          side={dir === "rtl" ? "right" : "left"}
          className="border-e border-slate-200"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label={text("toggleNavigation")}
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    {text("controlCenter")}
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.filter(item => !item.permission || permissions.includes(item.permission)).map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => { setLocation(item.path); if (isMobile) setOpenMobile(false); }}
                      tooltip={text(item.label)}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{text(item.label)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu dir={dir}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-start group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/admin/security")} className="cursor-pointer">
                  <LockKeyhole className="me-2 h-4 w-4" />
                  <span>{text("security")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="me-2 h-4 w-4" />
                  <span>{text("signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 end-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="min-w-0 bg-slate-50">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
          <span className="text-sm font-semibold text-slate-600">{text("controlCenter")}</span>
          <label className="flex items-center gap-2 text-sm text-slate-600"><Languages className="size-4"/><span className="sr-only">{text("language")}</span><select aria-label={text("language")} className="h-9 rounded-lg border border-slate-200 bg-white px-2" value={locale} onChange={event => setLocale(event.target.value as Locale)}>{(Object.keys(localeNames) as Locale[]).map(value => <option key={value} value={value}>{localeNames[value]}</option>)}</select></label>
        </div>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem ? text(activeMenuItem.label) : text("menu")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
