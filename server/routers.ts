import { ratingsRouter } from "./routers/ratings";
import { appearanceRouter } from "./routers/appearance";
import { workspaceRouter } from "./routers/workspace";
import { communityRouter } from "./routers/community";
import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import { authRouter } from "./routers/auth";
import { marketplaceRouter } from "./routers/marketplace";
import { assistantRouter } from "./routers/assistant";
import { memberRouter } from "./routers/member";
import { businessRouter } from "./routers/business";
import { messagingRouter } from "./routers/messaging";

export const appRouter = router({
  appearance: appearanceRouter,
  system: systemRouter,
  auth: authRouter,
  member: memberRouter,
  business: businessRouter,
  workspace: workspaceRouter,
  community: communityRouter,
  ratings: ratingsRouter,
  marketplace: marketplaceRouter,
  assistant: assistantRouter,
  messaging: messagingRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
