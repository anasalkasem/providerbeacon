import { getMarketplaceSnapshot } from "../server/marketplaceDb";

const snapshot = await getMarketplaceSnapshot();
console.log(JSON.stringify({ source: snapshot.source, providers: snapshot.providers.length, services: snapshot.services.length }));
process.exit(snapshot.source === "database" && snapshot.providers.length === 8 && snapshot.services.length === 16 ? 0 : 1);
