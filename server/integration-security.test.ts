import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./marketplaceDb";

describe("provider integration network policy", () => {
  it.each(["127.0.0.1", "10.0.0.8", "172.16.0.1", "172.31.255.255", "192.168.1.20", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1"])("blocks private address %s", address => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"])("allows public address %s", address => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});
