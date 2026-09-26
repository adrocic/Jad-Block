import type { SemanticClassifier } from "@jad-block/classifier";
import { type CandidateFeatures, type Classification, ClassifyResponse } from "@jad-block/schemas";

const TIMEOUT_MS = 3000;
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

export class RemoteUnavailableError extends Error {}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Calls our classification API (apps/api). It never talks to Jev directly, since the API key only
 * lives on the server. The response is validated against the strict schema, so anything but
 * probabilities is rejected. After a failure it stays off for a cooldown (a circuit breaker),
 * so a down or rate-limited service costs one request, not one per page.
 */
export class RemoteClassifier implements SemanticClassifier {
  modelVersion = "remote-unknown";
  private blockedUntil = 0;

  constructor(
    private readonly apiUrl: string,
    private readonly installId: () => Promise<string>,
    // Wrapped, not stored bare: browsers throw "Illegal invocation" when fetch is called with
    // `this` set to another object (here it would be the RemoteClassifier instance).
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly now: () => number = Date.now,
  ) {}

  get available(): boolean {
    return this.apiUrl !== "" && this.now() >= this.blockedUntil;
  }

  async classify(candidates: readonly CandidateFeatures[]): Promise<Classification[]> {
    if (!this.available) throw new RemoteUnavailableError("remote classification cooling down");
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiUrl}/v1/classify`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-install-id": await this.installId() },
        body: JSON.stringify({ candidates }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        credentials: "omit",
      });
    } catch (error) {
      this.trip(DEFAULT_COOLDOWN_MS);
      throw new RemoteUnavailableError(String(error));
    }
    if (!response.ok) {
      const retryAfter = Number(response.headers.get("retry-after"));
      this.trip(retryAfter > 0 ? retryAfter * 1000 : DEFAULT_COOLDOWN_MS);
      throw new RemoteUnavailableError(`HTTP ${response.status}`);
    }

    const parsed = ClassifyResponse.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      this.trip(DEFAULT_COOLDOWN_MS);
      throw new RemoteUnavailableError("response failed schema validation");
    }
    this.modelVersion = parsed.data.modelVersion;
    const byFingerprint = new Map(
      parsed.data.results.map((r) => [r.fingerprint, r.classification]),
    );
    return candidates.map((c) => {
      const classification = byFingerprint.get(c.fingerprint);
      if (!classification) throw new RemoteUnavailableError(`no result for ${c.fingerprint}`);
      return classification;
    });
  }

  private trip(ms: number): void {
    this.blockedUntil = this.now() + ms;
  }
}
