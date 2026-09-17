import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LocaleProvider } from "./contexts/LocaleContext";
import { MarketplaceDataProvider } from "./contexts/MarketplaceDataContext";
import { SiteAppearanceProvider } from "./contexts/SiteAppearanceContext";

const Find = lazy(() => import("@/pages/Find"));
const Groups = lazy(() => import("@/pages/Groups"));
const MemberGroups = lazy(() => import("@/pages/MemberGroups"));
const AdminGroups = lazy(() => import("@/pages/AdminGroups"));
const MemberWorkspace = lazy(() => import("@/pages/MemberWorkspace"));
const Home = lazy(() => import("@/pages/Home"));
const ServiceGuide = lazy(() =>
  import("@/pages/DiscoveryDetail").then(m => ({ default: m.ServiceGuide }))
);
const DirectoryProfile = lazy(() =>
  import("@/pages/DiscoveryDetail").then(m => ({ default: m.DirectoryProfile }))
);
const Services = lazy(() => import("@/pages/Services"));
const Compare = lazy(() => import("@/pages/Compare"));
const Providers = lazy(() => import("@/pages/Providers"));
const Provider = lazy(() => import("@/pages/Provider"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminEmail = lazy(() => import("@/pages/AdminEmail"));
const AdminProviderAnalytics = lazy(
  () => import("@/pages/AdminProviderAnalytics")
);
const ProviderBusiness = lazy(() => import("@/pages/ProviderBusiness"));
const AdminProviderBusiness = lazy(
  () => import("@/pages/AdminProviderBusiness")
);
const ProviderOffers = lazy(() => import("@/pages/ProviderOffers"));
const VipProviders = lazy(() => import("@/pages/VipProviders"));
const AdminModule = lazy(() => import("@/pages/AdminModule"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const Login = lazy(() => import("@/pages/Login"));
const Setup = lazy(() => import("@/pages/Setup"));
const Security = lazy(() => import("@/pages/Security"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const BeaconAssistant = lazy(() => import("@/components/BeaconAssistant"));
const StaffMessenger = lazy(() => import("@/components/StaffMessenger"));
function MessagingMount() {
  const [path] = useLocation();
  return path === "/admin" || path.startsWith("/admin/") ? (
    <Suspense fallback={null}>
      <StaffMessenger />
    </Suspense>
  ) : null;
}
const MemberSignIn = lazy(() =>
  import("@/pages/MemberAuth").then(m => ({ default: m.MemberSignIn }))
);
const MemberSignUp = lazy(() =>
  import("@/pages/MemberAuth").then(m => ({ default: m.MemberSignUp }))
);
const MemberAccount = lazy(() =>
  import("@/pages/MemberAuth").then(m => ({ default: m.MemberAccount }))
);
const MemberRecovery = lazy(() =>
  import("@/pages/MemberAuth").then(m => ({ default: m.MemberRecovery }))
);
const MemberPrivacy = lazy(() =>
  import("@/pages/MemberAuth").then(m => ({ default: m.MemberPrivacy }))
);
const MemberEmailPage = lazy(() => import("@/pages/MemberEmail"));

function Router() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-background">
          <div
            className="size-10 animate-spin rounded-full border-4 border-border border-t-ring"
            aria-label="Loading page"
          />
        </div>
      }
    >
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/find" component={Find} />
        <Route path="/groups" component={Groups} />
        <Route path="/offers" component={ProviderOffers} />
        <Route path="/vip" component={VipProviders} />
        <Route path="/services" component={Services} />
        <Route path="/services/:slug" component={ServiceGuide} />
        <Route path="/directory/:slug" component={DirectoryProfile} />
        <Route path="/compare" component={Compare} />
        <Route path="/providers" component={Providers} />
        <Route path="/providers/:slug" component={Provider} />
        <Route path="/login" component={Login} />
        <Route path="/sign-in" component={MemberSignIn} />
        <Route path="/sign-up" component={MemberSignUp} />
        <Route path="/account" component={MemberWorkspace} />
        <Route path="/account/groups" component={MemberGroups} />
        <Route path="/account/provider" component={ProviderBusiness} />
        <Route path="/account/settings" component={MemberAccount} />
        <Route path="/recover-account" component={MemberRecovery} />
        <Route path="/privacy" component={MemberPrivacy} />
        <Route path="/verify-email" component={MemberEmailPage} />
        <Route path="/forgot-password" component={MemberEmailPage} />
        <Route path="/reset-password" component={MemberEmailPage} />
        <Route path="/unsubscribe" component={MemberEmailPage} />
        <Route path="/setup" component={Setup} />
        <Route path="/admin" component={Admin} />
        <Route path="/admin/security" component={Security} />
        <Route path="/admin/email" component={AdminEmail} />
        <Route path="/admin/groups" component={AdminGroups} />
        <Route path="/admin/analytics" component={AdminProviderAnalytics} />
        <Route path="/admin/subscriptions" component={AdminProviderBusiness} />
        <Route path="/admin/:module" component={AdminModule} />
        <Route path="/team/accept" component={AcceptInvite} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LocaleProvider>
        <MarketplaceDataProvider>
          <TooltipProvider>
            <SiteAppearanceProvider>
              <Toaster richColors />
              <Router />
              <MessagingMount />
              <Suspense fallback={null}>
                <BeaconAssistant />
              </Suspense>
            </SiteAppearanceProvider>
          </TooltipProvider>
        </MarketplaceDataProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}
