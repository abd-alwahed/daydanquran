/**
 * The Meta Graph API version every call uses. Each version is supported for about two years:
 * check https://developers.facebook.com/docs/graph-api/changelog before it expires.
 */
export const GRAPH_VERSION = "v24.0";

const GRAPH_HOST = "https://graph.facebook.com";
/** Video uploads by URL go to this host (Facebook Page videos). */
export const GRAPH_VIDEO_HOST = "https://graph-video.facebook.com";

/** The Graph API answered with an error, so the call did not take effect. */
export class GraphError extends Error {
  constructor(
    message: string,
    readonly code: number,
    /** Meta's own hint that retrying later may succeed. */
    readonly transient: boolean,
  ) {
    super(message);
  }
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; is_transient?: boolean; error_user_msg?: string };
}

export type GraphParams = Record<string, string | number | boolean>;

const form = (params: GraphParams) => new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));

/** The few Graph API calls we make, authenticated with one Page access token. */
export class GraphClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly token: string,
    fetchImpl: typeof fetch = fetch,
  ) {
    if (!token) throw new Error("META_ACCESS_TOKEN غير موجود أو فارغ");
    // Workers throw "Illegal invocation" when fetch is called as a method of another object.
    this.fetchImpl = (input, init) => fetchImpl(input, init);
  }

  get<T>(path: string, params: GraphParams = {}): Promise<T> {
    const query = form(params).toString();
    return this.call<T>("GET", `${GRAPH_HOST}/${GRAPH_VERSION}/${path}${query ? `?${query}` : ""}`);
  }

  post<T>(path: string, params: GraphParams, host = GRAPH_HOST): Promise<T> {
    return this.call<T>("POST", `${host}/${GRAPH_VERSION}/${path}`, form(params));
  }

  private async call<T>(method: string, url: string, body?: URLSearchParams): Promise<T> {
    // The token goes in a header, never in the URL, so it cannot leak into logs or error messages.
    const response = await this.fetchImpl(url, { method, headers: { authorization: `Bearer ${this.token}` }, body });
    const json = (await response.json().catch(() => ({}))) as T & GraphErrorBody;
    if (!response.ok || json.error) {
      const error = json.error ?? {};
      const path = new URL(url).pathname.replace(`/${GRAPH_VERSION}/`, "");
      const detail = error.error_user_msg ?? error.message ?? `HTTP ${response.status}`;
      throw new GraphError(`Graph ${method} ${path}: ${detail}`, error.code ?? response.status, error.is_transient ?? false);
    }
    return json;
  }
}
