import { ENV } from "../server/_core/env";
import { getUserByOpenId } from "../server/db";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const user = await getUserByOpenId(ENV.ownerOpenId);
if (!user) throw new Error("Project owner user is not available in the development database");
const ctx = { user, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const result = await appRouter.createCaller(ctx).admin.ai.analyzeProvider({ providerId: 1, locale: "ar" });
console.log(JSON.stringify({ riskLevel: result.riskLevel, confidence: result.confidence, recommendedAction: result.recommendedAction, model: result.model, signalCount: result.signals.length }, null, 2));
process.exit(0);
