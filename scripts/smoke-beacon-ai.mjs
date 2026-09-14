const base = process.env.BEACON_SMOKE_URL || "https://providerbeacon.com";
if (!/^https:\/\/[^/]+$/.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) {
  throw new Error("Use an HTTPS site origin or an explicit local test server");
}
const status = await fetch(`${base}/api/trpc/assistant.status`, {signal:AbortSignal.timeout(15000)});
const availability = (await status.json()).result?.data?.json;
if (!availability?.available) {
  console.error("Beacon AI is not configured. Add OPENAI_API_KEY to the server before a live model test.");
  process.exit(2);
}
const response = await fetch(`${base}/api/trpc/assistant.chat`, {
  method:"POST", headers:{"content-type":"application/json"}, signal:AbortSignal.timeout(65000),
  body:JSON.stringify({json:{message:"بدي متابعين إنستغرام، اعرضلي الخيارات المتاحة بدون تخمين الأسعار",locale:"ar",history:[],context:{path:"/services",offerIds:[]}}}),
});
const payload = await response.json();
const reply = payload.result?.data?.json;
if (!response.ok || !reply || !reply.explanationAvailable) throw new Error("Live assistant request did not complete successfully");
if (!reply.answer || !Array.isArray(reply.offers) || reply.offers.length>4) throw new Error("Invalid assistant response");
for (const offer of reply.offers) {
  if (!/^service-[1-9]\d*$/.test(offer.service.id) || !offer.provider.slug) throw new Error("An offer has no public identity");
  if ((!offer.service.priceCurrency || !offer.service.priceUnit) && (offer.total!=null || offer.lowest)) throw new Error("Unconfirmed pricing was quoted or ranked");
}
console.log(JSON.stringify({ok:true,offers:reply.offers.length,explanationAvailable:reply.explanationAvailable,generatedAt:reply.generatedAt}));
