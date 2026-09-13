import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import { authRouter } from "./routers/auth";
import { marketplaceRouter } from "./routers/marketplace";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  marketplace: marketplaceRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
