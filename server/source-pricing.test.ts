import { describe, expect, it } from "vitest";
import { sourcePricingInput } from "../shared/sourcePricing";
import { sourcePricingIdentity } from "./sourcePricing";

const confirmation = { items: [{id: 1, revision: 2}], unit: "per_1000", evidenceUrl: "https://provider.example/services", confirmed: true, reason: "Checked each selected source service" };
describe("API pricing evidence", () => {
  it("requires deliberate, bounded and evidenced confirmation without a default unit", () => {
    expect(sourcePricingInput.safeParse(confirmation).success).toBe(true);
    for (const patch of [{unit: undefined}, {unit: "each"}, {evidenceUrl: null}, {evidenceUrl: "invalid"}, {evidenceUrl: "https://provider.example?key=secret"}, {confirmed: false}, {reason: "short"}, {items: []}, {items: [{id:1,revision:2},{id:1,revision:2}]}, {items: Array.from({length:51},(_,n)=>({id:n+1,revision:1}))}]) expect(sourcePricingInput.safeParse({...confirmation,...patch}).success).toBe(false);
    expect(sourcePricingInput.safeParse({...confirmation,unit:"package"}).success).toBe(false);
    expect(sourcePricingInput.safeParse({...confirmation,unit:"package",packageDescription:"One fixed package of 10 posts"}).success).toBe(true);
    expect(sourcePricingInput.safeParse({...confirmation,unit:null,evidenceUrl:null}).success).toBe(true);
  });
  it("preserves a unit through price updates but invalidates changed service meaning or account", () => {
    const row = {service:1,name:"TikTok Views",type:"Default",category:"Views",rate:"1.25",min:100,max:1000};
    const identity = (source = row, currency = "USD", endpoint = "https://provider.example/api", unit = "per_1000") => sourcePricingIdentity(source,currency,endpoint,unit);
    expect(identity({...row,rate:"2.50",max:10000})).toBe(identity());
    for (const patch of [{name:"TikTok Package"},{type:"Package"},{category:"Custom"}]) expect(identity({...row,...patch})).not.toBe(identity());
    expect(identity(row,"EUR")).not.toBe(identity());
    expect(identity(row,"USD","https://another.example/api")).not.toBe(identity());
    expect(identity({...row,max:10000},"USD","https://provider.example/api","package")).not.toBe(identity(row,"USD","https://provider.example/api","package"));
  });
});
