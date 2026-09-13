import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LocaleProvider } from "./contexts/LocaleContext";
import { MarketplaceDataProvider } from "./contexts/MarketplaceDataContext";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("@/pages/Home"));
const ServiceGuide = lazy(() => import("@/pages/DiscoveryDetail").then(m=>({default:m.ServiceGuide})));
const DirectoryProfile = lazy(() => import("@/pages/DiscoveryDetail").then(m=>({default:m.DirectoryProfile})));
const Services = lazy(() => import("@/pages/Services"));
const Compare = lazy(() => import("@/pages/Compare"));
const Providers = lazy(() => import("@/pages/Providers"));
const Provider = lazy(() => import("@/pages/Provider"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminModule = lazy(() => import("@/pages/AdminModule"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const Login = lazy(() => import("@/pages/Login"));
const Setup = lazy(() => import("@/pages/Setup"));
const Security = lazy(() => import("@/pages/Security"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function Router() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#F6F8FC]"><div className="size-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" aria-label="Loading page"/></div>}><Switch>
    <Route path="/" component={Home} />
    <Route path="/services" component={Services} />
    <Route path="/services/:slug" component={ServiceGuide} />
    <Route path="/directory/:slug" component={DirectoryProfile} />
    <Route path="/compare" component={Compare} />
    <Route path="/providers" component={Providers} />
    <Route path="/providers/:slug" component={Provider} />
    <Route path="/login" component={Login} />
    <Route path="/setup" component={Setup} />
    <Route path="/admin" component={Admin} />
    <Route path="/admin/security" component={Security} />
    <Route path="/admin/:module" component={AdminModule} />
    <Route path="/team/accept" component={AcceptInvite} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch></Suspense>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><LocaleProvider><MarketplaceDataProvider><TooltipProvider><Toaster richColors /><Router /></TooltipProvider></MarketplaceDataProvider></LocaleProvider></ThemeProvider></ErrorBoundary>;
}
