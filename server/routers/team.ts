import { z } from "zod";
import {
  assignableTeamRoles,
  teamChangeInput,
  teamInviteInput,
} from "../../shared/team";
import { memberLocale } from "../../shared/memberAuth";
import { permissionProcedure, router } from "../_core/trpc";
import { assertStaffOrigin } from "../staffOrigin";
import { reserveMemberRequests } from "../memberDb";
import { mailConfiguration } from "../emailDb";
import {
  createTeamInvite,
  listTeamMembers,
  removeTeamMember,
  resendTeamInvite,
  setTeamMemberRole,
  setTeamMemberStatus,
} from "../teamDb";
const guard = (permission: "team.read" | "team.write") =>
  permissionProcedure(permission).use(async ({ ctx, type, next }) => {
    ctx.res.setHeader("Cache-Control", "no-store");
    if (type === "mutation") {
      assertStaffOrigin(ctx.req);
      await reserveMemberRequests([
        { key: `staff-team:${ctx.user!.id}`, limit: 60, windowMs: 3600000 },
      ]);
    }
    return next();
  });
export const teamRouter = router({
  mailStatus: guard("team.read").query(() => ({
    enabled: mailConfiguration().enabled,
  })),
  list: guard("team.read").query(() => listTeamMembers()),
  invite: guard("team.write")
    .input(teamInviteInput)
    .mutation(({ ctx, input }) =>
      createTeamInvite({ ...input, actorUserId: ctx.user!.id })
    ),
  resend: guard("team.write")
    .input(teamChangeInput.extend({ locale: memberLocale }))
    .mutation(({ ctx, input }) =>
      resendTeamInvite({ ...input, actorUserId: ctx.user!.id })
    ),
  setRole: guard("team.write")
    .input(teamChangeInput.extend({ role: z.enum(assignableTeamRoles) }))
    .mutation(({ ctx, input }) =>
      setTeamMemberRole({ ...input, actorUserId: ctx.user!.id })
    ),
  setStatus: guard("team.write")
    .input(teamChangeInput.extend({ status: z.enum(["active", "suspended"]) }))
    .mutation(({ ctx, input }) =>
      setTeamMemberStatus({ ...input, actorUserId: ctx.user!.id })
    ),
  remove: guard("team.write")
    .input(teamChangeInput)
    .mutation(({ ctx, input }) =>
      removeTeamMember({ ...input, actorUserId: ctx.user!.id })
    ),
});
