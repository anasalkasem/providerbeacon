import type { Locale } from "@/contexts/LocaleContext";

type PrivacyCopy = {
  updated: string;
  scope: string;
  activity: string;
  messaging: string;
  notifications: string;
  payments: string;
  deleteTitle: string;
  deleteIntro: string;
  steps: [string, string, string];
  openSettings: string;
  emailTitle: string;
  emailBody: string;
  deletedTitle: string;
  deletedBody: string;
  retainedTitle: string;
  retainedBody: string;
  supportTitle: string;
  supportBody: string;
  privacyLink: string;
};

export const privacyCopy: Record<Locale, PrivacyCopy> = {
  en: {
    updated: "Updated 23 September 2026",
    scope:
      "This policy applies to the ProviderBeacon Android app and providerbeacon.com. For privacy questions or requests, contact soporte@providerbeacon.com.",
    activity:
      "When you use them, we store saved comparisons, price watches and alert preferences, provider ratings, community submissions and reports, ownership proofs, offers and VIP card text and images. Search terms and filters are sent to our server to return results; saved comparisons and watches remain until you remove them or delete your account. Content you submit for publication can become publicly visible after review. We do not sell account data or use it for third-party advertising.",
    messaging:
      "If you choose to contact an employee, we store your support conversation, optional name, language and any assistant history you choose to include. The assigned employee and authorized owners/administrators can access customer support conversations. Staff private conversations are accessible to their participants. Messages and limited conversation context may be sent to OpenAI for translation with API response storage disabled. Support uses a separate browser session lasting up to 30 days; it is not linked automatically to your member account. Messages remain on our server until deleted through a verified request; session expiry does not delete the conversation. Do not send passwords or payment credentials in chat.",
    notifications:
      "Only if you enable notifications, we store an encrypted browser push subscription, session identifier, language and expiry to deliver generic new-message alerts through your browser/platform push service. Alerts contain no message text. You can disable notifications in the app or browser settings. Expired subscriptions are removed by hourly maintenance and never authorize delivery after session expiry. We do not collect your phone contacts or precise device location.",
    payments:
      "If you buy a provider subscription, PayPal or NOWPayments handles the checkout you select. We keep the transaction/order identifiers, amount, currency, status and subscription dates to verify purchases and resolve payment issues. We do not store bank card numbers. The payment service processes the information you provide under its own privacy policy.",
    deleteTitle: "Delete your ProviderBeacon account and data",
    deleteIntro:
      "You can delete your account from the app or any browser. You do not need to reinstall the Android app. Deletion is permanent.",
    steps: [
      "Open account settings using the button below and sign in to the account you want to delete.",
      "Enter your current password in the verification field. If you use only Google sign-in, sign in again with Google when prompted.",
      "Select “Delete my account” and confirm. On success, the account and the data listed below are removed from the active database and all member sessions end.",
    ],
    openSettings: "Open account settings",
    emailTitle: "Request deletion by email",
    emailBody:
      "You can also email soporte@providerbeacon.com from your registered address with the subject “ProviderBeacon account deletion”. If you cannot access that address, explain this in your request. We verify ownership before acting and reply with the scope and expected completion time. Never send your password, recovery code or payment credentials.",
    deletedTitle: "What account deletion removes",
    deletedBody:
      "Your member profile (name, email and sign-in credentials), active sessions, recovery and email-verification tokens, account email queue/logs, saved comparisons and price watches, provider ratings, community submissions and reports, ownership claims, offers you authored and VIP cards you own are deleted. Provider ownership is released and its saved verification proof is cleared. Unused imported images become eligible for routine cleanup 30 days after import. Deleting ProviderBeacon does not delete your Google account.",
    retainedTitle: "Records that may remain",
    retainedBody:
      "Public provider catalogue records and anonymous aggregate statistics are separate from your member account. Payment and subscription records remain for transaction verification, accounting and payment disputes, with the deleted member link removed. Hashed email suppression records remain to prevent delivery to blocked addresses. Payment, subscription and suppression records currently have no automatic deletion deadline; contact us to request a review of any retained data and its applicable retention period. Daily analytics identifiers expire within two UTC days and aggregate analytics are kept for up to 400 days. Email delivery logs otherwise expire after 90 days. External services may retain records under their own policies.",
    supportTitle: "Delete support messages or selected data",
    supportBody:
      "Support conversations use a separate browser identity, so deleting a member account does not automatically identify or erase them. You may request deletion of a conversation or selected personal data without closing your account by emailing soporte@providerbeacon.com. Describe the data and the approximate conversation date; keep access to the original browser if possible so we can verify the request. We confirm what can be removed, any necessary retention and the completion time. Support messages have no automatic deletion deadline.",
    privacyLink: "Read the full privacy policy",
  },
  ar: {
    updated: "آخر تحديث: 23 سبتمبر 2026",
    scope:
      "تنطبق هذه السياسة على تطبيق ProviderBeacon لأندرويد وموقع providerbeacon.com. للاستفسارات وطلبات الخصوصية، تواصل عبر soporte@providerbeacon.com.",
    activity:
      "عند استخدام هذه الميزات، نحفظ المقارنات ومتابعات الأسعار وتفضيلات التنبيهات وتقييمات المزودين والمجموعات والبلاغات وإثباتات الملكية والعروض ونصوص بطاقات VIP وصورها. تُرسل كلمات البحث والمرشحات إلى خادمنا لإظهار النتائج، وتبقى المقارنات والمتابعات المحفوظة حتى تحذفها أو تحذف حسابك. قد يظهر المحتوى الذي ترسله للنشر علنًا بعد المراجعة. لا نبيع بيانات الحساب ولا نستخدمها لإعلانات أطراف خارجية.",
    messaging:
      "عند اختيار التواصل مع موظف، نحفظ محادثة الدعم والاسم الاختياري واللغة وسجل المساعد الذي تختار إرفاقه. يستطيع الموظف المكلّف والمالكون والمديرون المخوّلون الاطلاع على محادثات دعم العملاء، أما محادثات الموظفين الخاصة فتتاح للمشاركين فيها. قد تُرسل الرسائل وسياق محدود إلى OpenAI لترجمتها مع تعطيل تخزين استجابة API. يستخدم الدعم جلسة متصفح مستقلة تصل مدتها إلى 30 يومًا، ولا ترتبط تلقائيًا بحساب العضو. تبقى الرسائل على خادمنا حتى حذفها بطلب موثّق؛ انتهاء الجلسة لا يحذف المحادثة. لا ترسل كلمات المرور أو بيانات الدفع في الدردشة.",
    notifications:
      "فقط عند تفعيل الإشعارات، نحفظ اشتراك إشعارات المتصفح مشفّرًا ومعرّف الجلسة واللغة والانتهاء لإرسال تنبيهات عامة بالرسائل الجديدة عبر خدمة إشعارات المتصفح أو المنصة. لا تتضمن التنبيهات نص الرسالة. يمكنك تعطيلها من التطبيق أو إعدادات المتصفح. تزيل الصيانة كل ساعة الاشتراكات المنتهية، ولا يُسمح بالإرسال بعد انتهاء الجلسة. لا نجمع جهات اتصال هاتفك أو موقع جهازك الدقيق.",
    payments:
      "إذا اشتريت اشتراك مزود، تعالج PayPal أو NOWPayments عملية الدفع التي تختارها. نحفظ معرّفات الطلب والمعاملة والمبلغ والعملة والحالة وتواريخ الاشتراك للتحقق من الشراء وحل مشكلات الدفع. لا نحفظ أرقام البطاقات البنكية. تعالج خدمة الدفع ما تقدمه لها وفق سياسة خصوصيتها.",
    deleteTitle: "حذف حسابك وبياناتك في ProviderBeacon",
    deleteIntro:
      "يمكنك حذف حسابك من التطبيق أو أي متصفح، دون إعادة تثبيت تطبيق أندرويد. الحذف نهائي.",
    steps: [
      "افتح إعدادات الحساب بالزر أدناه وسجّل الدخول إلى الحساب الذي تريد حذفه.",
      "أدخل كلمة مرورك الحالية في حقل التحقق. إذا كنت تستخدم تسجيل Google فقط، فأعد تسجيل الدخول باستخدام Google عندما يُطلب منك ذلك.",
      "اختر «حذف حسابي» ثم أكّد. عند نجاح العملية، يُحذف الحساب والبيانات المذكورة أدناه من قاعدة البيانات النشطة وتنتهي جميع جلسات العضو.",
    ],
    openSettings: "فتح إعدادات الحساب",
    emailTitle: "طلب الحذف عبر البريد",
    emailBody:
      "يمكنك أيضًا مراسلة soporte@providerbeacon.com من بريدك المسجّل بعنوان «حذف حساب ProviderBeacon». إذا فقدت الوصول إلى ذلك البريد، وضّح هذا في الطلب. نتحقق من الملكية قبل التنفيذ ونرد بنطاق الحذف والوقت المتوقع لإتمامه. لا ترسل كلمة المرور أو رمز الاستعادة أو بيانات الدفع.",
    deletedTitle: "البيانات التي يحذفها حذف الحساب",
    deletedBody:
      "يُحذف ملف العضو، بما فيه الاسم والبريد وبيانات تسجيل الدخول، والجلسات النشطة ورموز الاستعادة والتحقق والبريد المجدول وسجلات بريد الحساب والمقارنات ومتابعات الأسعار وتقييمات المزودين والمجموعات والبلاغات وطلبات إثبات الملكية والعروض التي أنشأتها وبطاقات VIP التي تملكها. يُفك ارتباط ملكية المزود ويُمسح إثبات التحقق المحفوظ. تصبح الصور المستوردة غير المستخدمة مؤهلة للتنظيف الدوري بعد 30 يومًا من استيرادها. حذف حساب ProviderBeacon لا يحذف حساب Google.",
    retainedTitle: "سجلات قد تبقى بعد الحذف",
    retainedBody:
      "سجلات دليل المزودين العامة والإحصاءات المجمّعة المجهولة منفصلة عن حساب العضو. تبقى سجلات الدفع والاشتراك للتحقق من المعاملات والمحاسبة ونزاعات الدفع، مع إزالة ارتباطها بالعضو المحذوف. تبقى بصمات حظر البريد لمنع الإرسال إلى العناوين المحظورة. لا يوجد حاليًا موعد حذف تلقائي لسجلات الدفع والاشتراك والحظر؛ تواصل معنا لطلب مراجعة البيانات المحتفَظ بها ومدة الاحتفاظ المناسبة لها. تنتهي معرّفات التحليلات اليومية خلال يومين بتوقيت UTC، وتُحتفَظ الإحصاءات المجمّعة حتى 400 يوم. تنتهي سجلات إرسال البريد الأخرى بعد 90 يومًا. قد تحتفظ الخدمات الخارجية بسجلات وفق سياساتها.",
    supportTitle: "حذف محادثة دعم أو بيانات محددة",
    supportBody:
      "تستخدم محادثات الدعم هوية متصفح مستقلة، لذلك لا يؤدي حذف حساب العضو إلى تحديدها أو حذفها تلقائيًا. يمكنك طلب حذف محادثة أو بيانات شخصية محددة دون إغلاق الحساب بمراسلة soporte@providerbeacon.com. صف البيانات واذكر التاريخ التقريبي للمحادثة، واحتفظ بإمكانية الوصول إلى المتصفح الأصلي إن أمكن للتحقق من الطلب. نوضّح ما يمكن حذفه وما يلزم الاحتفاظ به ووقت الإتمام. لا يوجد موعد حذف تلقائي لمحادثات الدعم.",
    privacyLink: "قراءة سياسة الخصوصية كاملة",
  },
  es: {
    updated: "Actualizado el 23 de septiembre de 2026",
    scope:
      "Esta política se aplica a la app Android ProviderBeacon y a providerbeacon.com. Para consultas o solicitudes de privacidad: soporte@providerbeacon.com.",
    activity:
      "Cuando utilizas estas funciones, guardamos comparaciones, seguimientos de precios, preferencias de alertas, valoraciones, grupos y denuncias, pruebas de titularidad, ofertas y textos e imágenes de tarjetas VIP. Los términos y filtros de búsqueda se envían al servidor para obtener resultados. Las comparaciones y seguimientos guardados permanecen hasta que los eliminas o borras tu cuenta. El contenido enviado para publicación puede hacerse público tras su revisión. No vendemos datos de cuentas ni los usamos para publicidad de terceros.",
    messaging:
      "Si eliges hablar con un empleado, guardamos la conversación, el nombre opcional, el idioma y el historial del asistente que decidas incluir. El empleado asignado y los propietarios/administradores autorizados pueden acceder al soporte al cliente; los chats privados del personal solo son accesibles a sus participantes. Los mensajes y un contexto limitado pueden enviarse a OpenAI para traducirlos, con el almacenamiento de respuestas de la API desactivado. El soporte usa una sesión de navegador independiente de hasta 30 días, sin vinculación automática a tu cuenta. Los mensajes permanecen hasta su eliminación mediante una solicitud verificada; el vencimiento de la sesión no borra la conversación. No envíes contraseñas ni credenciales de pago.",
    notifications:
      "Solo si activas las notificaciones, guardamos una suscripción push cifrada, el identificador de sesión, idioma y vencimiento para avisos genéricos mediante el servicio del navegador o plataforma. Los avisos no incluyen el texto del mensaje. Puedes desactivarlos en la app o en el navegador. El mantenimiento horario elimina suscripciones vencidas y no se autoriza el envío tras vencer la sesión. No recopilamos contactos del teléfono ni la ubicación precisa del dispositivo.",
    payments:
      "Si compras una suscripción de proveedor, PayPal o NOWPayments procesa el pago que elijas. Guardamos identificadores de pedido y transacción, importe, moneda, estado y fechas de suscripción para verificar compras y resolver incidencias. No guardamos números de tarjetas bancarias. El servicio de pago trata los datos que le facilitas según su propia política.",
    deleteTitle: "Eliminar tu cuenta y datos de ProviderBeacon",
    deleteIntro:
      "Puedes eliminar tu cuenta desde la app o cualquier navegador, sin reinstalar la app Android. La eliminación es permanente.",
    steps: [
      "Abre los ajustes de cuenta con el botón de abajo e inicia sesión en la cuenta que deseas eliminar.",
      "Introduce la contraseña actual en el campo de verificación. Si solo accedes con Google, vuelve a iniciar sesión con Google cuando se te solicite.",
      "Selecciona «Eliminar mi cuenta» y confirma. Al completarse, se eliminan de la base de datos activa la cuenta y los datos indicados abajo, y se cierran todas las sesiones de miembro.",
    ],
    openSettings: "Abrir ajustes de cuenta",
    emailTitle: "Solicitar la eliminación por correo",
    emailBody:
      "También puedes escribir desde tu dirección registrada a soporte@providerbeacon.com con el asunto «Eliminar cuenta ProviderBeacon». Si ya no tienes acceso a ella, explícalo. Verificamos la titularidad antes de actuar y respondemos indicando el alcance y plazo previsto. No envíes contraseñas, códigos de recuperación ni credenciales de pago.",
    deletedTitle: "Datos que se eliminan",
    deletedBody:
      "Se eliminan el perfil de miembro (nombre, correo y credenciales), sesiones, tokens de recuperación y verificación, cola y registros de correo de la cuenta, comparaciones, seguimientos de precios, valoraciones, grupos y denuncias, solicitudes de titularidad, ofertas que creaste y tarjetas VIP de tu propiedad. Se libera la titularidad del proveedor y se borra su prueba guardada. Las imágenes importadas sin uso pueden limpiarse a partir de los 30 días de su importación. No se elimina tu cuenta de Google.",
    retainedTitle: "Registros que pueden conservarse",
    retainedBody:
      "El catálogo público de proveedores y las estadísticas agregadas anónimas son independientes de la cuenta. Los registros de pagos y suscripciones se conservan para verificar transacciones, contabilidad y disputas, sin el vínculo al miembro eliminado. Se conservan hashes de supresión de correo para evitar envíos a direcciones bloqueadas. Los pagos, suscripciones y supresiones no tienen actualmente un plazo de borrado automático; puedes solicitar una revisión de los datos retenidos y su plazo aplicable. Los identificadores de analítica diaria vencen en dos días UTC y los agregados se conservan hasta 400 días. Los demás registros de entrega de correo vencen a los 90 días. Los servicios externos pueden conservar registros según sus políticas.",
    supportTitle: "Eliminar mensajes de soporte o datos concretos",
    supportBody:
      "El soporte usa una identidad independiente del navegador: eliminar la cuenta no identifica ni borra automáticamente estas conversaciones. Puedes solicitar que eliminemos una conversación o datos personales concretos sin cerrar tu cuenta escribiendo a soporte@providerbeacon.com. Describe los datos y la fecha aproximada; conserva acceso al navegador original si es posible para verificar la solicitud. Confirmaremos qué puede eliminarse, cualquier retención necesaria y el plazo. Los mensajes de soporte no tienen un plazo de borrado automático.",
    privacyLink: "Leer la política de privacidad completa",
  },
  hi: {
    updated: "अद्यतन: 23 सितंबर 2026",
    scope:
      "यह नीति ProviderBeacon Android ऐप और providerbeacon.com पर लागू होती है। गोपनीयता संबंधी प्रश्न या अनुरोध soporte@providerbeacon.com पर भेजें।",
    activity:
      "इन सुविधाओं का उपयोग करने पर हम सहेजी गई तुलनाएँ, मूल्य निगरानी और अलर्ट प्राथमिकताएँ, प्रदाता रेटिंग, समूह और रिपोर्ट, स्वामित्व प्रमाण, ऑफ़र तथा VIP कार्ड के पाठ और चित्र सहेजते हैं। परिणाम दिखाने के लिए खोज शब्द और फ़िल्टर सर्वर पर भेजे जाते हैं। तुलनाएँ और निगरानी आपके उन्हें या खाता हटाने तक रहती हैं। प्रकाशन हेतु भेजी सामग्री समीक्षा के बाद सार्वजनिक हो सकती है। हम खाते का डेटा न बेचते हैं, न तीसरे पक्ष के विज्ञापनों में उपयोग करते हैं।",
    messaging:
      "कर्मचारी से संपर्क चुनने पर हम सहायता वार्तालाप, वैकल्पिक नाम, भाषा और आपके चुने हुए सहायक इतिहास को सहेजते हैं। नियुक्त कर्मचारी और अधिकृत मालिक/प्रशासक ग्राहक सहायता चैट देख सकते हैं; निजी कर्मचारी चैट केवल प्रतिभागियों को उपलब्ध हैं। अनुवाद के लिए संदेश और सीमित संदर्भ OpenAI को भेजे जा सकते हैं, जिसमें API प्रतिक्रिया संग्रह बंद रहता है। सहायता का अलग ब्राउज़र सत्र अधिकतम 30 दिन चलता है और सदस्य खाते से स्वतः नहीं जुड़ता। सत्यापित अनुरोध से हटाए जाने तक संदेश रहते हैं; सत्र समाप्त होने से चैट नहीं मिटती। चैट में पासवर्ड या भुगतान प्रमाण न भेजें।",
    notifications:
      "सूचनाएँ चालू करने पर ही हम एन्क्रिप्टेड ब्राउज़र पुश सदस्यता, सत्र पहचान, भाषा और समाप्ति समय सहेजते हैं। सामान्य नए-संदेश अलर्ट ब्राउज़र/प्लेटफ़ॉर्म की पुश सेवा से आते हैं और संदेश का पाठ नहीं दिखाते। ऐप या ब्राउज़र सेटिंग से इन्हें बंद किया जा सकता है। हर घंटे रखरखाव समाप्त सदस्यताओं को हटाता है; सत्र समाप्त होने के बाद भेजने की अनुमति नहीं रहती। हम फ़ोन संपर्क या उपकरण का सटीक स्थान नहीं लेते।",
    payments:
      "प्रदाता सदस्यता खरीदने पर चुना हुआ PayPal या NOWPayments भुगतान संभालता है। खरीद सत्यापन और विवाद समाधान के लिए हम लेनदेन/ऑर्डर पहचान, राशि, मुद्रा, स्थिति और सदस्यता तिथियाँ रखते हैं। हम बैंक कार्ड नंबर नहीं रखते। भुगतान सेवा अपने नियमों के अनुसार उसे दिए गए डेटा को संसाधित करती है।",
    deleteTitle: "अपना ProviderBeacon खाता और डेटा हटाएँ",
    deleteIntro:
      "ऐप या किसी ब्राउज़र से खाता हटाएँ। Android ऐप दोबारा स्थापित करना आवश्यक नहीं है। हटाना स्थायी है।",
    steps: [
      "नीचे दिए बटन से खाता सेटिंग खोलें और हटाए जाने वाले खाते में प्रवेश करें।",
      "सत्यापन फ़ील्ड में वर्तमान पासवर्ड भरें। केवल Google से प्रवेश करने पर, संकेत मिलने पर Google से फिर प्रवेश करें।",
      "‘मेरा खाता हटाएँ’ चुनकर पुष्टि करें। सफल होने पर नीचे बताया गया खाता डेटा सक्रिय डेटाबेस से हटता है और सभी सदस्य सत्र समाप्त हो जाते हैं।",
    ],
    openSettings: "खाता सेटिंग खोलें",
    emailTitle: "ईमेल द्वारा हटाने का अनुरोध",
    emailBody:
      "अपने पंजीकृत ईमेल से soporte@providerbeacon.com पर ‘ProviderBeacon account deletion’ विषय के साथ लिख सकते हैं। उस पते तक पहुँच न हो तो बताएँ। कार्रवाई से पहले हम स्वामित्व सत्यापित करते हैं और हटाने का दायरा व अनुमानित समय बताते हैं। पासवर्ड, रिकवरी कोड या भुगतान प्रमाण न भेजें।",
    deletedTitle: "खाता हटाने से क्या मिटता है",
    deletedBody:
      "सदस्य प्रोफ़ाइल (नाम, ईमेल और प्रवेश प्रमाण), सत्र, रिकवरी व सत्यापन टोकन, खाते की ईमेल कतार/लॉग, तुलनाएँ, मूल्य निगरानी, रेटिंग, समूह व रिपोर्ट, स्वामित्व दावे, आपके बनाए ऑफ़र और आपके VIP कार्ड मिटते हैं। प्रदाता का स्वामित्व मुक्त होता है और सहेजा सत्यापन प्रमाण मिटता है। अप्रयुक्त आयातित चित्र आयात के 30 दिन बाद नियमित सफ़ाई के पात्र होते हैं। आपका Google खाता नहीं मिटता।",
    retainedTitle: "कौन से रिकॉर्ड रह सकते हैं",
    retainedBody:
      "सार्वजनिक प्रदाता कैटलॉग और अनाम समेकित आँकड़े सदस्य खाते से अलग हैं। भुगतान व सदस्यता रिकॉर्ड लेनदेन सत्यापन, लेखांकन और भुगतान विवादों के लिए रहते हैं, लेकिन हटाए गए सदस्य से उनका लिंक मिटता है। अवरुद्ध पतों पर ईमेल रोकने के लिए हैश किए दमन रिकॉर्ड रहते हैं। भुगतान, सदस्यता और दमन रिकॉर्ड के लिए अभी स्वतः हटाने की समय-सीमा नहीं है; इनके डेटा और लागू अवधि की समीक्षा का अनुरोध कर सकते हैं। दैनिक विश्लेषण पहचान दो UTC दिनों में समाप्त होती है और समेकित आँकड़े अधिकतम 400 दिन रहते हैं। अन्य ईमेल डिलीवरी लॉग 90 दिन बाद समाप्त होते हैं। बाहरी सेवाएँ अपनी नीतियों के अनुसार रिकॉर्ड रख सकती हैं।",
    supportTitle: "सहायता संदेश या चुना हुआ डेटा हटाएँ",
    supportBody:
      "सहायता चैट अलग ब्राउज़र पहचान इस्तेमाल करती है, इसलिए सदस्य खाता हटाना उसे स्वतः पहचानता या मिटाता नहीं है। खाता बंद किए बिना चैट या चुना हुआ निजी डेटा हटाने के लिए soporte@providerbeacon.com पर लिखें। डेटा और बातचीत की अनुमानित तारीख बताएँ; सत्यापन के लिए संभव हो तो मूल ब्राउज़र तक पहुँच बनाए रखें। हम हटाए जा सकने वाले डेटा, आवश्यक प्रतिधारण और पूरा होने का समय बताएँगे। सहायता संदेशों के स्वतः हटने की समय-सीमा नहीं है।",
    privacyLink: "पूरी गोपनीयता नीति पढ़ें",
  },
  zh: {
    updated: "更新于 2026 年 9 月 23 日",
    scope:
      "本政策适用于 ProviderBeacon Android 应用和 providerbeacon.com。隐私问题或请求请联系 soporte@providerbeacon.com。",
    activity:
      "使用相关功能时，我们保存比较、价格关注和提醒偏好、供应商评分、社群提交及举报、所有权证明、优惠和 VIP 卡片文字及图片。搜索词和筛选条件会发送到服务器以返回结果；已保存的比较和关注保留至您删除它们或账户。提交发布的内容经审核后可能公开。我们不出售账户数据，也不将其用于第三方广告。",
    messaging:
      "选择联系员工时，我们保存支持对话、可选姓名、语言和您选择附带的助手历史。指定员工及获授权的所有者或管理员可以查看客户支持对话；员工私人对话仅供参与者访问。消息及有限上下文可能发送至 OpenAI 进行翻译，API 响应存储已关闭。支持对话使用最长 30 天的独立浏览器会话，不会自动关联会员账户。消息保留至经核实的请求将其删除；会话过期不代表对话被删除。请勿在聊天中发送密码或支付凭据。",
    notifications:
      "仅在启用通知后，我们才保存加密的浏览器推送订阅、会话标识、语言和到期时间，通过浏览器或平台推送服务发送通用的新消息提醒。提醒不含消息正文。可在应用或浏览器设置中关闭通知。每小时维护会移除过期订阅，会话过期后不会授权发送。我们不收集手机通讯录或设备精确位置。",
    payments:
      "购买供应商订阅时，您选择的 PayPal 或 NOWPayments 处理结账。我们保存订单或交易标识、金额、币种、状态和订阅日期，以核验购买并处理支付问题。我们不保存银行卡号。支付服务依据其自身隐私政策处理您提供的数据。",
    deleteTitle: "删除您的 ProviderBeacon 账户和数据",
    deleteIntro:
      "您可以在应用或任何浏览器中删除账户，无需重新安装 Android 应用。删除不可撤销。",
    steps: [
      "通过下方按钮打开账户设置，登录要删除的账户。",
      "在验证字段中输入当前密码。若仅使用 Google 登录，请在提示时重新通过 Google 登录。",
      "选择“删除我的账户”并确认。成功后，账户及下方列出的数据将从活动数据库删除，所有会员会话结束。",
    ],
    openSettings: "打开账户设置",
    emailTitle: "通过邮件请求删除",
    emailBody:
      "也可从注册邮箱发送邮件至 soporte@providerbeacon.com，主题为“ProviderBeacon account deletion”。若无法使用该邮箱，请在请求中说明。我们会先核实所有权，再回复删除范围及预计完成时间。请勿发送密码、恢复码或支付凭据。",
    deletedTitle: "删除账户会移除哪些数据",
    deletedBody:
      "将删除会员资料（姓名、邮箱和登录凭据）、活动会话、恢复及邮箱验证令牌、账户邮件队列和日志、已存比较及价格关注、供应商评分、社群提交与举报、所有权申请、您创建的优惠以及您拥有的 VIP 卡片。供应商所有权将被解除，其保存的验证证明会清除。未使用的导入图片在导入 30 天后符合定期清理条件。此操作不会删除您的 Google 账户。",
    retainedTitle: "可能保留的记录",
    retainedBody:
      "公开供应商目录及匿名汇总统计独立于会员账户。支付和订阅记录保留用于交易核验、记账及支付争议，已删除会员的关联将移除。为避免向被阻止的邮箱发送邮件，保留哈希化邮件抑制记录。支付、订阅和抑制记录目前没有自动删除期限；可请求审查保留数据及其适用期限。每日分析标识在两个 UTC 日内过期，汇总分析数据最多保留 400 天。其他邮件投递日志在 90 天后过期。外部服务可能依据各自政策保留记录。",
    supportTitle: "删除支持消息或部分数据",
    supportBody:
      "支持对话使用独立的浏览器身份，因此删除会员账户不会自动识别或删除这些对话。可发送邮件至 soporte@providerbeacon.com 请求删除对话或特定个人数据，无需关闭账户。请描述相关数据及对话大致日期；如可行，请保留原浏览器访问权限以便核实。我们会确认可删除的内容、必要的保留及完成时间。支持消息没有自动删除期限。",
    privacyLink: "阅读完整隐私政策",
  },
};
