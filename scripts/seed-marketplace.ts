import { seedMarketplaceIfEmpty } from "../server/marketplaceDb";

const result = await seedMarketplaceIfEmpty();
console.log(JSON.stringify(result));
process.exit(0);
