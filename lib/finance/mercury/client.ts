import type {
  ListTransactionsOptions,
  MercuryAccount,
  MercuryListAccountsResponse,
  MercuryListTransactionsResponse,
  MercuryOrganization,
  MercuryTransaction,
  MercuryWorkspace,
} from "./types";

const BASE_URL = "https://api.mercury.com/api/v1";

export class MercuryClient {
  private readonly token: string;
  readonly workspace: MercuryWorkspace;

  constructor(workspace: MercuryWorkspace) {
    const env =
      workspace === "business"
        ? process.env.MERCURY_BUSINESS_API_TOKEN
        : process.env.MERCURY_PERSONAL_API_TOKEN;

    if (!env) {
      throw new Error(
        `Missing Mercury ${workspace} token. Set MERCURY_${workspace.toUpperCase()}_API_TOKEN.`,
      );
    }

    this.token = env;
    this.workspace = workspace;
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new MercuryApiError(
        `Mercury API ${res.status} on ${path}: ${body.slice(0, 500)}`,
        res.status,
        path,
      );
    }

    return (await res.json()) as T;
  }

  async getOrganization(): Promise<MercuryOrganization> {
    const json = await this.request<{ organization: MercuryOrganization }>("/organization");
    return json.organization;
  }

  async listAccounts(): Promise<MercuryAccount[]> {
    const json = await this.request<MercuryListAccountsResponse>(
      "/accounts?limit=1000",
    );
    return json.accounts;
  }

  // Paginates through all transactions for an account in the given window.
  // Mercury caps `limit` at 1000; we loop with `offset` until we get less than limit.
  async listTransactions(
    accountId: string,
    opts: ListTransactionsOptions = {},
  ): Promise<MercuryTransaction[]> {
    const limit = opts.limit ?? 500;
    const pageSize = Math.min(limit, 500);
    const all: MercuryTransaction[] = [];
    let offset = opts.offset ?? 0;

    while (true) {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
        order: opts.order ?? "desc",
      });
      if (opts.start) params.set("start", opts.start);
      if (opts.end) params.set("end", opts.end);
      if (opts.search) params.set("search", opts.search);
      if (opts.status) params.set("status", opts.status);

      const json = await this.request<MercuryListTransactionsResponse>(
        `/account/${accountId}/transactions?${params.toString()}`,
      );

      all.push(...json.transactions);
      if (json.transactions.length < pageSize) break;
      offset += pageSize;

      // Safety rail: don't spin forever if Mercury ever loops on pagination.
      if (all.length > 50_000) break;
    }

    return all;
  }
}

export class MercuryApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "MercuryApiError";
    this.status = status;
    this.path = path;
  }
}

export function mercuryConfigured(workspace: MercuryWorkspace): boolean {
  return Boolean(
    workspace === "business"
      ? process.env.MERCURY_BUSINESS_API_TOKEN
      : process.env.MERCURY_PERSONAL_API_TOKEN,
  );
}
