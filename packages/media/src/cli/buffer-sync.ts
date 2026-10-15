/**
 * Adds the plan's feed posts to Buffer for Instagram and Facebook: schedules them at their Mecca time
 * while each channel has room (10 on the free plan), saves the rest as drafts, and skips any post Buffer
 * already has (matched by caption), so it can be re-run at any time. Quotes always go in as drafts until
 * the content reviewer approves them. Stories stay manual.
 *   pnpm --filter @daydan/media buffer:sync            preview only, changes nothing
 *   pnpm --filter @daydan/media buffer:sync --apply    creates the posts
 *   pnpm --filter @daydan/media buffer:sync --inspect  prints the API types this script relies on
 *   --from 2026-10-19                                  only the plan's posts from that date on
 * Reads BUFFER_API_KEY from the repo's .env. Images must be public: deploy the site after render:marketing.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_URL } from "@daydan/core";
import {
  bufferPosts,
  planActions,
  type Action,
  type BufferPost,
  type ExistingPost,
} from "../marketing/buffer";
import { PLAN } from "../marketing/plan";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const API = "https://api.buffer.com";
const MEDIA_BASE = `${SITE_URL}/marketing`;
const SERVICES = ["instagram", "facebook"] as const;

let apiKey = "";

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length || !body.data) {
    throw new Error(`Buffer API: ${body.errors?.map((e) => e.message).join("; ") ?? response.status}`);
  }
  return body.data;
}

/** Prints the types this script depends on, to check them against the live schema. */
async function inspect(): Promise<void> {
  const names = [
    "CreatePostInput",
    "AssetInput",
    "PostInputMetaData",
    "InstagramPostMetadataInput",
    "FacebookPostMetadataInput",
    "PostType",
    "PostTypeFacebook",
    "SchedulingType",
    "ShareMode",
    "PostStatus",
    "PostsInput",
    "PostsFiltersInput",
  ];
  for (const name of names) {
    const data = await gql<{ __type: unknown }>(
      `query($name: String!) { __type(name: $name) { name kind
        inputFields { name type { kind name ofType { kind name ofType { kind name } } } }
        enumValues { name } } }`,
      { name },
    );
    console.log(JSON.stringify(data.__type));
  }
  const query = await gql<{ __schema: { queryType: { fields: unknown[] } } }>(
    `{ __schema { queryType { fields { name args { name type { kind name ofType { kind name } } } } } } }`,
  );
  console.log(
    JSON.stringify(query.__schema.queryType.fields.filter((f) => (f as { name: string }).name === "posts")),
  );
}

interface Channel {
  id: string;
  service: string;
  name: string;
}

async function channels(): Promise<{ organizationId: string; channels: Channel[] }> {
  const { account } = await gql<{ account: { organizations: { id: string }[] } }>(
    `{ account { organizations { id } } }`,
  );
  const organizationId = account.organizations[0]?.id;
  if (!organizationId) throw new Error("No Buffer organization on this account");
  const data = await gql<{ channels: Channel[] }>(
    `query($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id service name } }`,
    { organizationId },
  );
  return { organizationId, channels: data.channels };
}

async function existingPosts(organizationId: string, channelId: string): Promise<ExistingPost[]> {
  const found: ExistingPost[] = [];
  let after: string | null = null;
  for (;;) {
    const data: {
      posts: {
        edges: { node: { text: string | null; status: string; dueAt: string | null } }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await gql(
      `query($organizationId: OrganizationId!, $channelId: ChannelId!, $after: String) {
        posts(first: 100, after: $after, input: { organizationId: $organizationId, filter: { channelIds: [$channelId] } }) {
          edges { node { text status dueAt } } pageInfo { hasNextPage endCursor } } }`,
      { organizationId, channelId, after },
    );
    found.push(...data.posts.edges.map((e) => ({ ...e.node, text: e.node.text ?? "" })));
    if (!data.posts.pageInfo.hasNextPage) return found;
    after = data.posts.pageInfo.endCursor;
  }
}

async function createPost(channel: Channel, post: BufferPost, action: "schedule" | "draft"): Promise<void> {
  const input = {
    channelId: channel.id,
    text: post.text,
    schedulingType: "automatic",
    needsApproval: false,
    assets: post.images.map((url) => ({ image: { url } })),
    metadata:
      channel.service === "instagram"
        ? { instagram: { type: "post", shouldShareToFeed: true } }
        : { facebook: { type: "post" } },
    // Drafts keep their planned time too, so they open ready to schedule and re-runs can tell the
    // Friday posts (same caption) apart by date.
    mode: "customScheduled",
    dueAt: post.dueAt,
    ...(action === "draft" ? { saveToDraft: true } : {}),
  };
  const data = await gql<{ createPost: { __typename: string; message?: string } }>(
    `mutation($input: CreatePostInput!) { createPost(input: $input) {
      __typename ... on MutationError { message } } }`,
    { input },
  );
  if (data.createPost.message)
    throw new Error(`${post.date} on ${channel.service}: ${data.createPost.message}`);
}

/** Every image must be online before Buffer can fetch it. */
async function checkMedia(posts: BufferPost[]): Promise<void> {
  const missing: string[] = [];
  for (const url of posts.flatMap((p) => p.images)) {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) missing.push(url);
  }
  if (missing.length > 0) {
    throw new Error(`Images not online yet (deploy the site first):\n${missing.slice(0, 5).join("\n")}`);
  }
}

const LABEL: Record<Action, string> = {
  "skip-exists": "موجود في Buffer",
  "skip-past": "موعده مضى",
  schedule: "جدولة",
  draft: "مسودة",
};

async function main(): Promise<void> {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {
    // No .env: the key may come from the shell.
  }
  apiKey = process.env.BUFFER_API_KEY?.trim() ?? "";
  if (!apiKey) throw new Error(`BUFFER_API_KEY is missing: add it to ${path.join(ROOT, ".env")}`);
  if (process.argv.includes("--inspect")) return inspect();
  const apply = process.argv.includes("--apply");

  const { organizationId, channels: all } = await channels();
  const fromIndex = process.argv.indexOf("--from");
  const from = fromIndex > 0 ? process.argv[fromIndex + 1]! : "";
  const posts = bufferPosts(PLAN, MEDIA_BASE).filter((p) => p.date >= from);
  for (const service of SERVICES) {
    const channel = all.find((c) => c.service === service);
    if (!channel) {
      console.log(`⚠️ No ${service} channel in Buffer, skipped`);
      continue;
    }
    const actions = planActions(posts, await existingPosts(organizationId, channel.id), new Date());
    console.log(`\n${service} (${channel.name})`);
    for (const { post, action } of actions) console.log(`  ${post.date} ${post.title}: ${LABEL[action]}`);
    if (!apply) continue;

    const toCreate = actions.filter((a) => a.action === "schedule" || a.action === "draft");
    await checkMedia(toCreate.map((a) => a.post));
    for (const { post, action } of toCreate) {
      await createPost(channel, post, action as "schedule" | "draft");
      console.log(`  ✅ ${post.date} ${LABEL[action]}`);
    }
  }
  if (!apply) console.log("\nPreview only. Run with --apply to create these posts.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
