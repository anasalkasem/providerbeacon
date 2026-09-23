import { describe, expect, it } from "vitest";
import { assertSameCatalogueSource, sourceHost, sourceMatchesWebsite } from "../shared/providerSourceIdentity";

describe("provider source identity signals", () => {
  it("compares complete host boundaries and never treats a lookalike domain as the provider", () => {
    expect(sourceMatchesWebsite("https://www.provider.example", "https://api.provider.example/v2")).toBe(true);
    expect(sourceMatchesWebsite("https://provider.example", "https://provider.example.attacker.example/v2")).toBe(false);
    expect(sourceMatchesWebsite("https://provider.example", "https://otherprovider.example/v2")).toBe(false);
    expect(sourceMatchesWebsite(null, "https://provider.example/v2")).toBeNull();
  });
  it("withholds unsafe or missing source URLs from reports", () => {
    for (const url of [null, "broken", "http://provider.example", "https://user:secret@provider.example/api"]) {
      expect(sourceHost(url)).toBeNull();
    }
    expect(sourceHost("https://WWW.Provider.Example/api/v2")).toBe("provider.example");
    expect(sourceHost("https://provider.example/api?key=private#fragment")).toBe("provider.example");
    expect(sourceMatchesWebsite("https://provider.example", "https://other.example/api?mode=services")).toBe(false);
  });
  it("allows path updates and legacy unknown sources, but rejects source substitution", () => {
    expect(() => assertSameCatalogueSource("https://provider.example/v1", "https://provider.example/v2")).not.toThrow();
    expect(() => assertSameCatalogueSource(null, "https://provider.example/v2")).not.toThrow();
    expect(() => assertSameCatalogueSource("https://provider.example/api", "https://provider.example/api?mode=services")).not.toThrow();
    for (const previous of ["https://other.example/api", "https://provider.example:8443/api", "malformed"]) {
      expect(() => assertSameCatalogueSource(previous, "https://provider.example/api")).toThrow("catalogue_source_conflict");
    }
  });
});
