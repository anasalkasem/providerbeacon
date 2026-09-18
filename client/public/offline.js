(() => {
  const copy = {
    en: [
      "Let's reconnect.",
      "You need an internet connection to search, see current prices and use Beacon AI. Your saved services will be available after you reconnect and sign in.",
      "Try again",
    ],
    ar: [
      "خلّينا نرجع نتصل.",
      "تحتاج اتصالًا بالإنترنت للبحث وعرض الأسعار الحالية واستخدام مساعد Beacon. خدماتك المحفوظة ستظهر بعد الاتصال وتسجيل الدخول.",
      "حاول مجددًا",
    ],
    es: [
      "Volvamos a conectarnos.",
      "Necesitas internet para buscar, ver precios actuales y usar Beacon AI. Tus servicios guardados estarán disponibles al reconectar e iniciar sesión.",
      "Reintentar",
    ],
    hi: [
      "फिर से कनेक्ट करें।",
      "खोज, वर्तमान कीमतों और Beacon AI के लिए इंटरनेट ज़रूरी है। दोबारा कनेक्ट करके साइन इन करने पर सहेजी गई सेवाएँ उपलब्ध होंगी।",
      "फिर कोशिश करें",
    ],
    zh: [
      "重新连接。",
      "搜索、查看最新价格和使用 Beacon AI 需要联网。重新连接并登录后，即可查看已保存的服务。",
      "重试",
    ],
  };
  let saved;
  try {
    saved = localStorage.getItem("providerbeacon-locale");
  } catch {
    /* restricted storage */
  }
  const requested = new URLSearchParams(location.search).get("lang");
  const locale = [
    requested,
    saved,
    navigator.language.split("-")[0],
    "en",
  ].find(value => Object.hasOwn(copy, value));
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  const [title, body, retry] = copy[locale];
  document.title = `ProviderBeacon — ${title}`;
  document.getElementById("offline-title").textContent = title;
  document.getElementById("offline-body").textContent = body;
  document.getElementById("offline-retry").textContent = retry;
  document
    .getElementById("offline-retry")
    .addEventListener("click", () => location.reload());
})();
