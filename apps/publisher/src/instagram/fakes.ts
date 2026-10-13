import { INSTAGRAM_API, type ContainerStatus, type Ledger } from "./instagram";

/** Test doubles for the Instagram API and KV. */
export function memoryLedger(): Ledger & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return { entries, get: async (key) => entries.get(key) ?? null, put: async (key, value) => void entries.set(key, value) };
}

/** A fake Instagram API that tracks containers the way Instagram does. */
export function fakeInstagramApi(options: { remaining?: number; statuses?: ContainerStatus[]; failPublish?: number; publishLands?: boolean } = {}) {
  const calls: { method: string; path: string; body: Record<string, string>; auth: string | null }[] = [];
  const containers = new Map<string, ContainerStatus>();
  const pending = [...(options.statuses ?? [])];
  let failPublish = options.failPublish ?? 0;
  let next = 0;
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const path = url.replace(`${INSTAGRAM_API}/`, "");
    const body = Object.fromEntries(new URLSearchParams(String(init.body ?? "")));
    calls.push({ method: init.method ?? "GET", path, body, auth: new Headers(init.headers).get("authorization") });
    if (path.includes("/content_publishing_limit")) {
      return Response.json({ data: [{ config: { quota_total: 100 }, quota_usage: 100 - (options.remaining ?? 50) }] });
    }
    if (path.endsWith("/media")) {
      const id = `c${++next}`;
      containers.set(id, "IN_PROGRESS");
      return Response.json({ id });
    }
    if (path.endsWith("/media_publish")) {
      const id = body.creation_id!;
      if (failPublish-- > 0) {
        if (options.publishLands) containers.set(id, "PUBLISHED");
        throw new Error("timeout");
      }
      containers.set(id, "PUBLISHED");
      return Response.json({ id: `m-${id}` });
    }
    const id = path.split("?")[0]!;
    const current = containers.get(id);
    if (!current) return Response.json({ error: { message: "Unsupported get request", code: 100 } }, { status: 400 });
    const code = current === "IN_PROGRESS" ? (pending.shift() ?? "FINISHED") : current;
    containers.set(id, code);
    return Response.json({ status_code: code });
  }) as typeof fetch;
  const publishes = () => calls.filter((c) => c.path.endsWith("/media_publish")).length;
  return { fetchImpl, calls, containers, publishes };
}
