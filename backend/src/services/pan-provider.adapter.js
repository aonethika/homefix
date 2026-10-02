// No provider contract is assumed. Supply the licensed provider's documentation,
// then implement these TWO ADAPT points and add a response fixture test.
const unavailable = () => Object.assign(new Error('PAN verification is temporarily unavailable'), { status: 503 });
export const PAN_PROVIDER_ADAPTER_READY = false;

export function buildPanRequest({ panNumber, apiKey }) {
  // ADAPT 1: Return { headers, body } using the documented auth header and PAN
  // request-body field. body must be a JSON-serializable object, NOT a guess.
  // Never put a PAN in the URL and never log this object.
  throw unavailable();
}

export function mapPanResponse(payload, status) {
  // ADAPT 2: Map the documented success/not-found statuses and response fields
  // to { found: boolean, registeredName: string | null }. Reject unexpected
  // structures with unavailable(); do not mistake provider errors for a miss.
  // The registeredName is compared in memory only; never log or return it.
  throw unavailable();
}
