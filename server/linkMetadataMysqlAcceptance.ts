import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  importedMedia,
  linkMetadataCache,
} from "../drizzle/linkMetadataSchema";
import { communityGroups } from "../drizzle/communitySchema";
import { memberAuthBuckets } from "../drizzle/memberSchema";
import { providerRecords, teamMembers, users } from "../drizzle/schema";
import { groupInput, groupListInput } from "../shared/community";
import type { LinkMetadata } from "../shared/linkMetadata";
import {
  metadataKey,
  savedLinkMetadata,
  cleanupImportedMedia,
  metadataBudget,
} from "./linkMetadata";
import { createProviderDraft } from "./marketplaceDb";
import {
  createGroup,
  editGroup,
  publicGroups,
  reviewGroup,
} from "./communityDb";
import { registerImportedMediaRoutes } from "./importedMediaRoutes";
import { appRouter } from "./routers";
import * as metadataService from "./linkMetadata";
import { repairImportedProviderLogos } from "./providerLogoRepair";

export function linkMetadataAcceptanceCases(
  database: () => any,
  actorId: () => number,
  providerId: () => number
) {
  describe("imported identity and group metadata persistence", () => {
    const image = (id = "a".repeat(64)) =>
      `https://providerbeacon.com/api/imported-media/${id}`;
    const input = (patch = {}) =>
      groupInput.parse({
        name: "Community",
        description: "A public community for provider discussions.",
        url: "https://t.me/provider_group",
        topic: "providers",
        language: "en",
        ...patch,
      });
    beforeEach(async () => {
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      await database().delete(communityGroups);
      await database().delete(linkMetadataCache);
      await database().delete(importedMedia);
      await database().delete(memberAuthBuckets);
    });
    it("repairs a stored empty SVG across legacy table collations while preserving the rest of the profile", async () => {
      const content = Buffer.from(
        '<svg><rect width="131" height="59" fill="url(#missing)"/></svg>'
      );
      await database()
        .insert(importedMedia)
        .values({
          id: "a".repeat(64),
          mime: "image/svg+xml",
          content: content.toString("base64"),
          bytes: content.length,
        });
      await database()
        .update(providerRecords)
        .set({
          logoUrl: image(),
          websiteUrl: "https://provider.com/",
          websitePreviewUrl: image("c".repeat(64)),
          profileRevision: 7,
        })
        .where(eq(providerRecords.id, providerId()));
      const [before] = await database()
        .select()
        .from(providerRecords)
        .where(eq(providerRecords.id, providerId()));
      const fetch = vi
        .spyOn(metadataService, "fetchWebsiteLogo")
        .mockResolvedValue(image("b".repeat(64)));
      try {
        expect(await repairImportedProviderLogos()).toBe(1);
        const [after] = await database()
          .select()
          .from(providerRecords)
          .where(eq(providerRecords.id, providerId()));
        expect(after).toMatchObject({
          name: before.name,
          websiteUrl: before.websiteUrl,
          websitePreviewUrl: before.websitePreviewUrl,
          logoUrl: image("b".repeat(64)),
          profileRevision: 8,
        });
      } finally {
        fetch.mockRestore();
      }
    });
    async function seed(
      kind: LinkMetadata["kind"] = "website",
      sourceUrl = "https://provider.com/"
    ) {
      const data: LinkMetadata = {
        parserVersion: 3,
        key: metadataKey(kind, sourceUrl),
        kind,
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        name: "Imported Provider",
        description: "A public description from the source",
        logoUrl: kind === "website" ? image() : null,
        websitePreviewUrl: kind === "website" ? image("b".repeat(64)) : null,
        telegramUrl: null,
        avatarUrl: kind !== "website" ? image() : null,
        audience:
          kind === "whatsapp" && sourceUrl.includes("/channel/")
            ? { count: 4300000, kind: "followers", approximate: true }
            : kind === "telegram" || kind === "discord"
              ? {
                  count: 1234,
                  kind: "members",
                  approximate: kind === "discord",
                }
              : null,
        language: "en",
        topic: "providers",
        aiSuggested: false,
        complete: true,
      };
      await database()
        .insert(linkMetadataCache)
        .values({
          key: data.key,
          kind,
          payload: data,
          expiresAt: new Date(Date.now() + 86400000),
        });
      return data;
    }
    async function caller(origin = "https://providerbeacon.com") {
      const [user] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      return appRouter.createCaller({
        user,
        authMode: "staff",
        req: { headers: { origin }, ip: "127.0.0.1" },
        res: { setHeader: vi.fn() },
      } as any);
    }
    it("saves imported images on creation without publishing or verifying the provider", async () => {
      const data = await seed();
      const provider = await (
        await caller()
      ).admin.providers.createDraft({
        name: "Imported Provider",
        websiteUrl: data.sourceUrl,
        metadataKey: data.key,
      });
      expect(provider).toMatchObject({
        logoUrl: data.logoUrl,
        websitePreviewUrl: data.websitePreviewUrl,
        description: data.description,
        status: "draft",
        verified: false,
        apiCataloguePublished: false,
      });
      await database()
        .update(providerRecords)
        .set({
          logoUrl: "https://provider.com/manual.png",
          description: "Manually updated description",
        })
        .where(eq(providerRecords.id, provider.id));
      const again = await createProviderDraft({
        name: "Imported Provider",
        websiteUrl: data.sourceUrl,
        metadataKey: data.key,
        actorUserId: actorId(),
      });
      expect(again.logoUrl).toBe("https://provider.com/manual.png");
      expect(again.description).toBe("Manually updated description");
    });
    it("uses a hostname slug when an automatically retrieved provider name is Arabic", async () => {
      const data = await seed();
      const provider = await createProviderDraft({
        name: "مزود الخدمات",
        websiteUrl: data.sourceUrl,
        metadataKey: data.key,
        actorUserId: actorId(),
      });
      expect(provider.name).toBe("مزود الخدمات");
      expect(provider.slug).toBe("provider-com");
    });
    it("binds imported metadata to its exact source and rejects reuse for a different group or website", async () => {
      const data = await seed();
      await expect(
        savedLinkMetadata(data.key, "website", "https://other-provider.com/")
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        createGroup({ actorId: actorId() }, input({ metadataKey: data.key }))
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await database().select().from(communityGroups)).toHaveLength(0);
    });
    it("preserves manual group fields, publishes observed counts only after review, and clears metadata on link changes", async () => {
      const data = await seed("telegram", "https://t.me/provider_group");
      const created = await createGroup(
        { actorId: actorId() },
        input({ name: "Edited group name", metadataKey: data.key })
      );
      expect((await publicGroups(groupListInput.parse({}))).items).toHaveLength(
        0
      );
      await reviewGroup(actorId(), {
        id: created.id,
        revision: 1,
        decision: "approved",
        note: "Reviewed the public group destination",
        groupConfirmed: true,
        providerConfirmed: false,
      });
      const group = (await publicGroups(groupListInput.parse({}))).items[0];
      expect(group.name).toBe("Edited group name");
      expect(group.linkMetadata).toEqual({
        avatarUrl: data.avatarUrl,
        audience: data.audience,
        fetchedAt: data.fetchedAt,
      });
      await editGroup(
        { actorId: actorId() },
        {
          ...input({ name: "Another manual edit" }),
          id: created.id,
          revision: 2,
        }
      );
      let [row] = await database()
        .select()
        .from(communityGroups)
        .where(eq(communityGroups.id, created.id));
      expect(row.linkMetadata.audience.count).toBe(1234);
      expect(row.status).toBe("pending");
      await editGroup(
        { actorId: actorId() },
        {
          ...input({ url: "https://t.me/another_group" }),
          id: created.id,
          revision: 3,
        }
      );
      [row] = await database()
        .select()
        .from(communityGroups)
        .where(eq(communityGroups.id, created.id));
      expect(row.linkMetadata).toBeNull();
    });
    it.each([
      {
        kind: "whatsapp" as const,
        url: "https://www.whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M",
        shared:
          "https://whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M/?lang=es",
      },
      {
        kind: "whatsapp" as const,
        url: "https://chat.whatsapp.com/AbCdEf1234567890123456",
        shared: "https://chat.whatsapp.com/AbCdEf1234567890123456?mode=ac_t",
      },
      {
        kind: "discord" as const,
        url: "https://discord.gg/Beacon_Test",
        shared: "https://discord.com/invite/Beacon_Test",
      },
    ])(
      "saves and reviews $kind metadata with canonical source binding",
      async scenario => {
        const data = await seed(scenario.kind, scenario.url);
        expect(
          await (
            await caller()
          ).admin.groups.previewGroup({ url: scenario.shared })
        ).toEqual(data);
        const created = await createGroup(
          { actorId: actorId() },
          input({ url: scenario.shared, metadataKey: data.key })
        );
        const [row] = await database()
          .select()
          .from(communityGroups)
          .where(eq(communityGroups.id, created.id));
        expect(row).toMatchObject({
          platform: scenario.kind,
          url: scenario.url,
          status: "pending",
          linkMetadata: {
            avatarUrl: data.avatarUrl,
            audience: data.audience,
            fetchedAt: data.fetchedAt,
          },
        });
        expect(
          (await publicGroups(groupListInput.parse({}))).items
        ).toHaveLength(0);
        await expect(
          createGroup(
            { actorId: actorId() },
            input({ url: "https://t.me/another_group", metadataKey: data.key })
          )
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        if (scenario.url.includes("/channel/")) {
          // The same code on the group-invite host is a different source.
          await expect(
            createGroup(
              { actorId: actorId() },
              input({
                url: "https://chat.whatsapp.com/0029Va4K0PZ5a245NkngBA2M",
                metadataKey: data.key,
              })
            )
          ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        }
        await reviewGroup(actorId(), {
          id: created.id,
          revision: 1,
          decision: "approved",
          note: "Reviewed the actual group invitation",
          groupConfirmed: true,
          providerConfirmed: false,
        });
        const group = (await publicGroups(groupListInput.parse({}))).items[0];
        expect(group).toMatchObject({
          url: scenario.url,
          platform: scenario.kind,
          linkMetadata: { avatarUrl: data.avatarUrl, audience: data.audience },
        });
        expect(group).not.toHaveProperty("metadataKey");
      }
    );
    it("requires write permission and trusted origins for previews, including the www staff origin", async () => {
      const website = await seed();
      const telegram = await seed("telegram", "https://t.me/provider_group");
      expect(
        await (
          await caller("https://www.providerbeacon.com")
        ).admin.providers.previewWebsite({ url: website.sourceUrl })
      ).toEqual(website);
      expect(
        await (
          await caller("https://www.providerbeacon.com")
        ).admin.groups.previewTelegram({ url: telegram.sourceUrl })
      ).toEqual(telegram);
      await expect(
        (await caller("https://evil.com")).admin.providers.previewWebsite({
          url: website.sourceUrl,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        (await caller("https://evil.com")).admin.groups.previewGroup({
          url: telegram.sourceUrl,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await database()
        .update(teamMembers)
        .set({ role: "auditor" })
        .where(eq(teamMembers.userId, actorId()));
      await expect(
        (await caller()).admin.providers.previewWebsite({
          url: website.sourceUrl,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        (await caller()).admin.groups.previewGroup({
          url: telegram.sourceUrl,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const anonymous = appRouter.createCaller({
        user: null,
        req: { headers: { origin: "https://providerbeacon.com" } },
        res: { setHeader: vi.fn() },
      } as any);
      await expect(
        anonymous.community.previewGroup({ url: telegram.sourceUrl })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
    it("enforces shared request budgets across calls", async () => {
      for (let i = 0; i < 20; i++) await metadataBudget("acceptance-actor");
      await expect(metadataBudget("acceptance-actor")).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
    });
    it("serves cached media with restrictive headers and removes only abandoned assets", async () => {
      for (const id of ["a", "b", "c"])
        await database()
          .insert(importedMedia)
          .values({
            id: id.repeat(64),
            mime: "image/png",
            bytes: 12,
            content: Buffer.from("saved bitmap").toString("base64"),
            createdAt: new Date("2020-01-01"),
          });
      await database()
        .update(providerRecords)
        .set({ logoUrl: image() })
        .where(eq(providerRecords.id, providerId()));
      const data = await seed("telegram", "https://t.me/provider_group");
      const group = await createGroup(
        { actorId: actorId() },
        input({ metadataKey: data.key })
      );
      await database()
        .update(communityGroups)
        .set({
          linkMetadata: {
            avatarUrl: image("b".repeat(64)),
            audience: null,
            fetchedAt: new Date().toISOString(),
          },
        })
        .where(eq(communityGroups.id, group.id));
      await cleanupImportedMedia();
      expect(
        (await database().select({ id: importedMedia.id }).from(importedMedia))
          .map((row: any) => row.id)
          .sort()
      ).toEqual(["a".repeat(64), "b".repeat(64)]);
      let handle: any;
      registerImportedMediaRoutes({
        get: (_path: string, handler: unknown) => {
          handle = handler;
        },
      } as any);
      const response: any = {
        setHeader: vi.fn(),
        status: vi.fn(() => response),
        end: vi.fn(),
        send: vi.fn(),
      };
      await handle({ params: { id: "a".repeat(64) }, headers: {} }, response);
      expect(response.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "image/png"
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        "Content-Security-Policy",
        "sandbox; default-src 'none'; img-src data:"
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        "X-Content-Type-Options",
        "nosniff"
      );
      expect(response.send.mock.calls[0][0].toString()).toBe("saved bitmap");
      await handle(
        {
          params: { id: "a".repeat(64) },
          headers: { "if-none-match": `"${"a".repeat(64)}"` },
        },
        response
      );
      expect(response.status).toHaveBeenCalledWith(304);
    });
  });
}
