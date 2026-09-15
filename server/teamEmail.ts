const copy = {
  en: {
    subject: "You're invited to the ProviderBeacon team",
    body: "The ProviderBeacon owner has invited you to the staff workspace. Use the email address that received this invitation to create your account.\nThis link works once and expires in 7 days. Your access is limited to the role assigned by the owner.",
    action: "Accept team invitation",
  },
  ar: {
    subject: "دعوة للانضمام إلى فريق ProviderBeacon",
    body: "دعاك مالك ProviderBeacon إلى مساحة عمل الفريق. استخدم البريد الإلكتروني الذي استلم هذه الدعوة لإنشاء حسابك.\nيُستخدم الرابط مرة واحدة وتنتهي صلاحيته خلال 7 أيام. يقتصر وصولك على صلاحيات الدور الذي يحدده المالك.",
    action: "قبول دعوة الفريق",
  },
  es: {
    subject: "Te invitamos al equipo de ProviderBeacon",
    body: "El propietario de ProviderBeacon te ha invitado al espacio de trabajo del equipo. Crea tu cuenta con el correo que recibió esta invitación.\nEste enlace se puede usar una sola vez y caduca en 7 días. Tu acceso se limita al rol asignado por el propietario.",
    action: "Aceptar invitación al equipo",
  },
  hi: {
    subject: "ProviderBeacon टीम में आपका आमंत्रण",
    body: "ProviderBeacon के मालिक ने आपको टीम कार्यक्षेत्र में आमंत्रित किया है। जिस ईमेल पर यह आमंत्रण मिला है, उसी से खाता बनाएँ।\nयह लिंक एक बार इस्तेमाल किया जा सकता है और 7 दिन में समाप्त होगा। आपकी पहुँच मालिक द्वारा दी गई भूमिका तक सीमित है।",
    action: "टीम का आमंत्रण स्वीकार करें",
  },
  zh: {
    subject: "邀请您加入 ProviderBeacon 团队",
    body: "ProviderBeacon 所有者邀请您加入团队工作区。请使用收到此邀请的邮箱创建账户。\n此链接仅可使用一次，7天后失效。您的访问权限由所有者分配的角色决定。",
    action: "接受团队邀请",
  },
};
export const teamInviteEmailContent = (locale: keyof typeof copy) =>
  copy[locale];
