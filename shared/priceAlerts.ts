import type { Service } from "../client/src/data/marketplace";
import { watchChange, type SavedPrice } from "./buyerWorkspace";

export const PRICE_ALERT_CONSENT_VERSION = "price-target-v1";
export const PRICE_ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PRICE_ALERT_CHECK_MS = 5 * 60 * 1000;

export type PriceAlertReference = {
  watchId: number;
  revision: number;
  historyKey: string;
  total: string;
  target: string;
  currency: string;
  quantity: number;
  observedAt: string;
};
export type PriceTargetEmail = {
  service: string;
  provider: string;
  quantity: number;
  currency: string;
  original: string;
  current: string;
  target: string;
  observedAt: string;
};

// A target uses the original, confirmed currency and exact saved quantity. FX
// movements never masquerade as provider price reductions.
export function priceAlertQuote(
  baseline: SavedPrice,
  service: Service | null,
  quantity: number,
  target: string | null,
  now = Date.now()
) {
  const change = watchChange(baseline, service, quantity, target);
  const observed = service?.checkedAt ? Date.parse(service.checkedAt) : NaN;
  const fresh =
    Number.isFinite(observed) &&
    observed <= now + 60000 &&
    now - observed <= PRICE_ALERT_MAX_AGE_MS;
  const comparable =
    ["same", "lower", "higher"].includes(change.status) &&
    baseline.priceCurrency === service?.priceCurrency &&
    baseline.priceUnit === service?.priceUnit;
  return {
    ...change,
    ready: !!target && comparable && fresh,
    reached: !!target && comparable && fresh && change.targetReached,
  };
}
