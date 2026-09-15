import type { Locale } from "@/contexts/LocaleContext";
const en = {
  inviteBody:
    "Send a secure invitation to the employee's email. Choose their role and invitation language.",
  language: "Invitation language",
  queued: "Invitation queued for email delivery",
  resend: "Resend invitation",
  edit: "Edit permissions",
  remove: "Remove employee",
  cancelInvite: "Delete invitation",
  save: "Save permissions",
  cancel: "Cancel",
  editBody:
    "Choose the employee's role. Saving a change signs them out of all current sessions.",
  removeBody:
    "This removes staff access, credentials and open sessions. A new invitation is required to join again. The audit history is retained.",
  deleteInviteBody: "This deletes the invitation and invalidates its link.",
  changed: "Permissions updated",
  removed: "Team member removed",
  copied: "Invitation link copied",
  copyFailed: "Could not copy. Select and copy the link manually.",
  pending: "Awaiting acceptance",
  expired: "Invitation expired",
  expires: "Link expires",
  delivery: "Invitation email",
  notSent: "Email has not been sent",
  disabled:
    "Invitation email is disabled. Check the email settings before inviting staff.",
  protected: "Owner account protected",
  self: "Your account",
  roleHints: {
    administrator:
      "Manage the platform, integrations and emails. Team access remains with the owner.",
    operations_manager:
      "Manage providers, service reviews and group moderation; view the audit log.",
    provider_reviewer:
      "Review providers, services and groups; view the audit log.",
    catalogue_editor: "Edit services and read provider information.",
    translation_manager:
      "Manage translations and read provider and service information.",
    auditor:
      "Read-only access to providers, services, translations, integrations, groups and audit history.",
  },
  mail: {
    queued: "Waiting to send",
    processing: "Sending",
    accepted: "Sent; awaiting delivery confirmation",
    delivered: "Accepted by recipient mail server",
    delayed: "Delivery delayed",
    failed: "Delivery failed",
    bounced: "Recipient server rejected the email",
    complained: "Recipient reported spam",
    suppressed: "Sending blocked for this address",
    cancelled: "Email cancelled",
  },
  errors: {
    team_owner_only: "Only the owner can manage employees.",
    team_missing: "This employee no longer exists. Refresh the list.",
    team_protected: "The owner and your own account cannot be changed here.",
    team_changed: "This record changed. Refresh and try again.",
    team_mail_disabled:
      "Email is disabled or unconfigured. Check email settings.",
    team_mail_suppressed:
      "Delivery to this address is blocked after a bounce or spam report. Check the address and delivery log.",
    team_exists:
      "This email already has a staff account or invitation. Use Edit permissions or Resend invitation.",
    team_not_invited: "Only pending invitations can be resent.",
    team_resend_wait: "Wait one minute before sending another invitation.",
    team_not_registered:
      "The invitation must be accepted before changing account status.",
    team_invalid_invite:
      "This invitation is invalid, expired or for another email. Ask the owner for a new invitation.",
    rate_limited: "Too many requests. Please try again shortly.",
  },
  failure: "The operation could not be completed. Refresh and try again.",
  invalidLink: "The invitation link is missing or invalid.",
  accept: "Accept invitation",
  open: "Open control center",
};
type Words = {
  [K in keyof typeof en]: (typeof en)[K] extends string
    ? string
    : { [P in keyof (typeof en)[K]]: string };
};
const ar: Words = {
  inviteBody: "أرسل دعوة آمنة إلى بريد الموظف، وحدّد دوره ولغة رسالة الدعوة.",
  language: "لغة الدعوة",
  queued: "أُضيفت الدعوة إلى قائمة إرسال البريد",
  resend: "إعادة إرسال الدعوة",
  edit: "تعديل الصلاحيات",
  remove: "حذف الموظف",
  cancelInvite: "حذف الدعوة",
  save: "حفظ الصلاحيات",
  cancel: "إلغاء",
  editBody: "حدّد دور الموظف. حفظ التغيير يسجّل خروجه من جميع الجلسات الحالية.",
  removeBody:
    "سيُحذف وصول الموظف وبيانات دخوله وجلساته المفتوحة. سيحتاج إلى دعوة جديدة للعودة. يُحتفظ بسجل عملياته السابق.",
  deleteInviteBody: "ستُحذف الدعوة ويصبح رابطها غير صالح.",
  changed: "تم تحديث الصلاحيات",
  removed: "تم حذف العضو من الفريق",
  copied: "تم نسخ رابط الدعوة",
  copyFailed: "تعذّر النسخ. حدّد الرابط وانسخه يدويًا.",
  pending: "بانتظار قبول الدعوة",
  expired: "انتهت صلاحية الدعوة",
  expires: "صلاحية الرابط حتى",
  delivery: "إيميل الدعوة",
  notSent: "لم تُرسل دعوة بالبريد",
  disabled:
    "إرسال دعوات البريد غير مفعّل. راجع إعدادات البريد قبل دعوة الموظفين.",
  protected: "حساب المالك محمي",
  self: "حسابك",
  roleHints: {
    administrator:
      "إدارة المنصة والتكاملات والبريد. إدارة الموظفين تبقى للمالك.",
    operations_manager:
      "إدارة المزودين ومراجعة الخدمات والجروبات والاطلاع على سجل العمليات.",
    provider_reviewer:
      "مراجعة المزودين والخدمات والجروبات والاطلاع على سجل العمليات.",
    catalogue_editor: "تعديل الخدمات والاطلاع على معلومات المزودين.",
    translation_manager: "إدارة الترجمات والاطلاع على المزودين والخدمات.",
    auditor:
      "قراءة المزودين والخدمات والترجمات والتكاملات والجروبات وسجل العمليات دون تعديل.",
  },
  mail: {
    queued: "بانتظار الإرسال",
    processing: "جارٍ الإرسال",
    accepted: "أُرسلت؛ بانتظار تأكيد التسليم",
    delivered: "استلمها خادم بريد المستلم",
    delayed: "تأخر التسليم",
    failed: "تعذّر التسليم",
    bounced: "رفض بريد المستلم الرسالة",
    complained: "أبلغ المستلم أنها مزعجة",
    suppressed: "الإرسال لهذا العنوان محظور",
    cancelled: "أُلغي إرسال الرسالة",
  },
  errors: {
    team_owner_only: "إدارة الموظفين متاحة للمالك فقط.",
    team_missing: "الموظف لم يعد موجودًا. حدّث القائمة.",
    team_protected: "لا يمكن تعديل حساب المالك أو حسابك من هنا.",
    team_changed: "تغيّرت بيانات الموظف. حدّث القائمة وحاول مجددًا.",
    team_mail_disabled:
      "إرسال البريد غير مفعّل أو إعداداته ناقصة. راجع إعدادات البريد.",
    team_mail_suppressed:
      "الإرسال لهذا العنوان محظور بعد ارتداد رسالة أو بلاغ إزعاج. راجع العنوان وسجل التسليم.",
    team_exists:
      "البريد لديه حساب موظف أو دعوة سابقة. استخدم تعديل الصلاحيات أو إعادة إرسال الدعوة.",
    team_not_invited: "إعادة الإرسال متاحة للدعوات غير المقبولة فقط.",
    team_resend_wait: "انتظر دقيقة قبل إعادة إرسال الدعوة.",
    team_not_registered: "يجب قبول الدعوة أولًا قبل تغيير حالة الحساب.",
    team_invalid_invite:
      "الدعوة غير صالحة أو منتهية أو لبريد آخر. اطلب دعوة جديدة من المالك.",
    rate_limited: "طلبات كثيرة. حاول بعد قليل.",
  },
  failure: "تعذّر إكمال العملية. حدّث الصفحة وحاول مجددًا.",
  invalidLink: "رابط الدعوة ناقص أو غير صالح.",
  accept: "قبول الدعوة",
  open: "فتح لوحة التحكم",
};
const es: Words = {
  inviteBody:
    "Envía una invitación segura al correo del empleado. Elige su rol y el idioma del mensaje.",
  language: "Idioma de la invitación",
  queued: "Invitación en cola de envío",
  resend: "Reenviar invitación",
  edit: "Editar permisos",
  remove: "Eliminar empleado",
  cancelInvite: "Eliminar invitación",
  save: "Guardar permisos",
  cancel: "Cancelar",
  editBody:
    "Elige el rol. Al guardar un cambio, se cierran todas las sesiones del empleado.",
  removeBody:
    "Se elimina el acceso del empleado, sus credenciales y sesiones. Necesitará otra invitación para volver. Se conserva el historial de auditoría.",
  deleteInviteBody: "La invitación se elimina y su enlace deja de ser válido.",
  changed: "Permisos actualizados",
  removed: "Miembro eliminado",
  copied: "Enlace copiado",
  copyFailed: "No se pudo copiar. Selecciona y copia el enlace manualmente.",
  pending: "Pendiente de aceptación",
  expired: "Invitación vencida",
  expires: "El enlace caduca",
  delivery: "Correo de invitación",
  notSent: "No se ha enviado por correo",
  disabled:
    "El correo de invitaciones está deshabilitado. Revisa la configuración.",
  protected: "Cuenta del propietario protegida",
  self: "Tu cuenta",
  roleHints: {
    administrator:
      "Gestiona la plataforma, integraciones y correos. El propietario gestiona el equipo.",
    operations_manager:
      "Gestiona proveedores, revisión de servicios y grupos; consulta la auditoría.",
    provider_reviewer:
      "Revisa proveedores, servicios y grupos; consulta la auditoría.",
    catalogue_editor: "Edita servicios y consulta proveedores.",
    translation_manager:
      "Gestiona traducciones y consulta proveedores y servicios.",
    auditor:
      "Solo lectura de proveedores, servicios, traducciones, integraciones, grupos y auditoría.",
  },
  mail: {
    queued: "Pendiente de envío",
    processing: "Enviando",
    accepted: "Enviado; pendiente de confirmar entrega",
    delivered: "Aceptado por el servidor del destinatario",
    delayed: "Entrega retrasada",
    failed: "Falló la entrega",
    bounced: "El destinatario rechazó el correo",
    complained: "Marcado como spam",
    suppressed: "Envío bloqueado para esta dirección",
    cancelled: "Envío cancelado",
  },
  errors: {
    team_owner_only: "Solo el propietario gestiona empleados.",
    team_missing: "El empleado ya no existe. Actualiza la lista.",
    team_protected:
      "No puedes modificar al propietario ni tu propia cuenta aquí.",
    team_changed: "El registro cambió. Actualiza e inténtalo otra vez.",
    team_mail_disabled: "El envío de correo no está configurado o habilitado.",
    team_mail_suppressed:
      "Dirección bloqueada por rebote o spam. Revisa el correo y el registro de entrega.",
    team_exists:
      "Este correo ya tiene cuenta o invitación. Usa Editar permisos o Reenviar invitación.",
    team_not_invited: "Solo se reenvían invitaciones pendientes.",
    team_resend_wait: "Espera un minuto antes de reenviar.",
    team_not_registered:
      "Debe aceptar la invitación antes de cambiar el estado.",
    team_invalid_invite:
      "Invitación inválida, vencida o para otro correo. Solicita otra al propietario.",
    rate_limited: "Demasiadas solicitudes. Inténtalo más tarde.",
  },
  failure: "No se pudo completar. Actualiza e inténtalo otra vez.",
  invalidLink: "El enlace de invitación no es válido.",
  accept: "Aceptar invitación",
  open: "Abrir panel de control",
};
const hi: Words = {
  inviteBody:
    "कर्मचारी के ईमेल पर सुरक्षित आमंत्रण भेजें। भूमिका और संदेश की भाषा चुनें।",
  language: "आमंत्रण की भाषा",
  queued: "आमंत्रण ईमेल कतार में है",
  resend: "आमंत्रण फिर भेजें",
  edit: "अनुमतियाँ बदलें",
  remove: "कर्मचारी हटाएँ",
  cancelInvite: "आमंत्रण हटाएँ",
  save: "अनुमतियाँ सहेजें",
  cancel: "रद्द करें",
  editBody: "भूमिका चुनें। बदलाव सहेजने पर कर्मचारी के सभी सत्र समाप्त होंगे।",
  removeBody:
    "कर्मचारी की पहुँच, लॉगिन और खुले सत्र हटा दिए जाएँगे। वापस आने के लिए नया आमंत्रण चाहिए। ऑडिट इतिहास रहेगा।",
  deleteInviteBody: "आमंत्रण हट जाएगा और लिंक अमान्य हो जाएगा।",
  changed: "अनुमतियाँ बदली गईं",
  removed: "सदस्य हटाया गया",
  copied: "लिंक कॉपी हुआ",
  copyFailed: "कॉपी नहीं हुआ। लिंक चुनकर स्वयं कॉपी करें।",
  pending: "स्वीकृति की प्रतीक्षा",
  expired: "आमंत्रण समाप्त",
  expires: "लिंक की समाप्ति",
  delivery: "आमंत्रण ईमेल",
  notSent: "ईमेल नहीं भेजा गया",
  disabled: "आमंत्रण ईमेल बंद है। ईमेल सेटिंग जाँचें।",
  protected: "मालिक का खाता सुरक्षित है",
  self: "आपका खाता",
  roleHints: {
    administrator:
      "प्लेटफ़ॉर्म, एकीकरण और ईमेल प्रबंधन। टीम प्रबंधन केवल मालिक करता है।",
    operations_manager: "प्रदाता, सेवाओं और समूहों की समीक्षा; ऑडिट देखें।",
    provider_reviewer: "प्रदाताओं, सेवाओं और समूहों की समीक्षा; ऑडिट देखें।",
    catalogue_editor: "सेवाएँ संपादित करें और प्रदाता जानकारी देखें।",
    translation_manager: "अनुवाद प्रबंधित करें; प्रदाता और सेवाएँ देखें।",
    auditor:
      "प्रदाता, सेवा, अनुवाद, एकीकरण, समूह और ऑडिट की केवल पढ़ने की पहुँच।",
  },
  mail: {
    queued: "भेजने की प्रतीक्षा",
    processing: "भेजा जा रहा है",
    accepted: "भेजा गया; डिलीवरी पुष्टि बाकी",
    delivered: "प्राप्तकर्ता सर्वर ने स्वीकार किया",
    delayed: "डिलीवरी में देरी",
    failed: "डिलीवरी विफल",
    bounced: "प्राप्तकर्ता ने ईमेल अस्वीकार किया",
    complained: "स्पैम की शिकायत",
    suppressed: "इस पते पर भेजना बंद है",
    cancelled: "ईमेल रद्द",
  },
  errors: {
    team_owner_only: "केवल मालिक कर्मचारी प्रबंधित कर सकता है।",
    team_missing: "कर्मचारी मौजूद नहीं है। सूची रीफ्रेश करें।",
    team_protected: "मालिक या अपना खाता यहाँ नहीं बदल सकते।",
    team_changed: "रिकॉर्ड बदल गया है। रीफ्रेश करके फिर कोशिश करें।",
    team_mail_disabled: "ईमेल सक्षम या कॉन्फ़िगर नहीं है।",
    team_mail_suppressed:
      "बाउंस या स्पैम के कारण पता अवरुद्ध है। पता और डिलीवरी लॉग जाँचें।",
    team_exists:
      "इस ईमेल का खाता या आमंत्रण मौजूद है। अनुमतियाँ बदलें या आमंत्रण फिर भेजें।",
    team_not_invited: "केवल लंबित आमंत्रण फिर भेज सकते हैं।",
    team_resend_wait: "फिर भेजने से पहले एक मिनट रुकें।",
    team_not_registered: "स्थिति बदलने से पहले आमंत्रण स्वीकार करना होगा।",
    team_invalid_invite:
      "आमंत्रण अमान्य, समाप्त या दूसरे ईमेल के लिए है। मालिक से नया आमंत्रण लें।",
    rate_limited: "बहुत अधिक अनुरोध। कुछ देर बाद कोशिश करें।",
  },
  failure: "कार्य पूरा नहीं हुआ। रीफ्रेश करके फिर कोशिश करें।",
  invalidLink: "आमंत्रण लिंक अमान्य है।",
  accept: "आमंत्रण स्वीकार करें",
  open: "नियंत्रण केंद्र खोलें",
};
const zh: Words = {
  inviteBody: "向员工邮箱发送安全邀请，并选择角色和邮件语言。",
  language: "邀请语言",
  queued: "邀请邮件已排队",
  resend: "重新发送邀请",
  edit: "修改权限",
  remove: "删除员工",
  cancelInvite: "删除邀请",
  save: "保存权限",
  cancel: "取消",
  editBody: "选择员工角色。保存更改将退出该员工的所有当前会话。",
  removeBody:
    "将删除员工访问权限、登录凭据及会话。重新加入需要新邀请。审计历史会保留。",
  deleteInviteBody: "将删除邀请并使其链接失效。",
  changed: "权限已更新",
  removed: "成员已删除",
  copied: "邀请链接已复制",
  copyFailed: "无法复制，请手动选择并复制链接。",
  pending: "等待接受",
  expired: "邀请已过期",
  expires: "链接到期时间",
  delivery: "邀请邮件",
  notSent: "尚未发送邮件",
  disabled: "邀请邮件尚未启用，请检查邮件设置。",
  protected: "所有者账户受保护",
  self: "您的账户",
  roleHints: {
    administrator: "管理平台、集成和邮件。团队管理由所有者负责。",
    operations_manager: "管理供应商、服务审核和群组；查看审计日志。",
    provider_reviewer: "审核供应商、服务和群组；查看审计日志。",
    catalogue_editor: "编辑服务并查看供应商。",
    translation_manager: "管理翻译并查看供应商和服务。",
    auditor: "只读访问供应商、服务、翻译、集成、群组和审计日志。",
  },
  mail: {
    queued: "等待发送",
    processing: "发送中",
    accepted: "已发送，等待投递确认",
    delivered: "收件服务器已接收",
    delayed: "投递延迟",
    failed: "投递失败",
    bounced: "收件服务器拒收",
    complained: "收件人标记为垃圾邮件",
    suppressed: "此地址已禁止发送",
    cancelled: "邮件已取消",
  },
  errors: {
    team_owner_only: "仅所有者可管理员工。",
    team_missing: "员工已不存在，请刷新列表。",
    team_protected: "无法在此修改所有者或自己的账户。",
    team_changed: "记录已更改，请刷新后重试。",
    team_mail_disabled: "邮件未启用或尚未配置。",
    team_mail_suppressed:
      "因退信或垃圾邮件投诉，此地址已被阻止。请检查地址及投递记录。",
    team_exists: "此邮箱已有账户或邀请，请修改权限或重新发送邀请。",
    team_not_invited: "只能重发尚未接受的邀请。",
    team_resend_wait: "请等待一分钟后再发送。",
    team_not_registered: "接受邀请后才可修改账户状态。",
    team_invalid_invite: "邀请无效、已过期或邮箱不符。请向所有者申请新邀请。",
    rate_limited: "请求过多，请稍后再试。",
  },
  failure: "操作未完成，请刷新后重试。",
  invalidLink: "邀请链接缺失或无效。",
  accept: "接受邀请",
  open: "打开控制中心",
};
export const teamWords: Record<Locale, Words> = { en, ar, es, hi, zh };
export const teamError = (locale: Locale, message: string) =>
  teamWords[locale].errors[message as keyof Words["errors"]] ??
  teamWords[locale].failure;
