import { trpc } from "@/lib/trpc";

export function useMember() {
  return trpc.member.me.useQuery(undefined, { staleTime: 30000, retry: false });
}
