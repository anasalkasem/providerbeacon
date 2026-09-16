import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { Audience } from "../shared/linkMetadata";
import { providerTelegramUrl } from "../shared/providerProfile";
import { metadataUrl } from "./publicMetadataFetch";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
const children = (node: Node): Node[] =>
  "childNodes" in node ? node.childNodes : [];
const element = (node: Node): node is Element => "tagName" in node;
const attr = (node: Element, name: string) =>
  node.attrs.find(a => a.name === name)?.value ?? "";
const cls = (node: Element, name: string) =>
  attr(node, "class").split(/\s+/).includes(name);
function allNodes(root: Node) {
  const result: Element[] = [];
  const pending = [root];
  let visited = 0;
  while (pending.length && visited++ < 30000) {
    const node = pending.pop()!;
    if (element(node)) result.push(node);
    const next = children(node);
    for (let i = next.length - 1; i >= 0; i--) pending.push(next[i]);
  }
  return result;
}
function textOf(root: Node | undefined, maximum = 2000): string | null {
  if (!root) return null;
  const output: string[] = [];
  const pending = [root];
  let size = 0;
  while (pending.length && size < maximum * 3) {
    const node = pending.pop()!;
    if (
      element(node) &&
      ["script", "style", "template", "noscript"].includes(node.tagName)
    )
      continue;
    if (node.nodeName === "#text" && "value" in node) {
      output.push(node.value);
      size += node.value.length;
    }
    const next = children(node);
    for (let i = next.length - 1; i >= 0; i--) pending.push(next[i]);
  }
  return clean(output.join(" "), maximum);
}
function clean(value: string | undefined, maximum: number) {
  return (
    value
      ?.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximum) || null
  );
}
function imageUrl(value: unknown, base: string) {
  if (typeof value !== "string" || !value) return null;
  try {
    return metadataUrl(value, base).href;
  } catch {
    return null;
  }
}

export function parseWebsite(html: string, url: string) {
  const nodes = allNodes(parse(html));
  const meta = (key: string) =>
    clean(
      attr(
        nodes.find(
          node =>
            node.tagName === "meta" &&
            (attr(node, "property") === key || attr(node, "name") === key)
        ) ?? ({ attrs: [] } as unknown as Element),
        "content"
      ),
      2000
    );
  const candidates: string[] = [];
  const add = (value: unknown) => {
    const candidate = imageUrl(value, url);
    if (candidate && !candidates.includes(candidate))
      candidates.push(candidate);
  };
  // Logo semantics come from the source. An OG/social banner is not a logo or screenshot.
  const inspectJson = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 4) return;
    if (Array.isArray(value)) {
      value.slice(0, 30).forEach(v => inspectJson(v, depth + 1));
      return;
    }
    const object = value as Record<string, unknown>;
    const logo = object.logo;
    if (typeof logo === "string") add(logo);
    else if (logo && typeof logo === "object")
      add(
        (logo as Record<string, unknown>).url ??
          (logo as Record<string, unknown>).contentUrl
      );
    if (object["@graph"]) inspectJson(object["@graph"], depth + 1);
  };
  for (const node of nodes
    .filter(
      n => n.tagName === "script" && attr(n, "type") === "application/ld+json"
    )
    .slice(0, 8)) {
    const source = children(node)
      .filter(n => "value" in n)
      .map(n => (n as { value: string }).value)
      .join("");
    if (source.length <= 64000)
      try {
        inspectJson(JSON.parse(source));
      } catch {
        /* Invalid source data is optional. */
      }
  }
  const inBrand = (node: Element) => {
    let parent = node.parentNode;
    for (
      let depth = 0;
      parent && depth < 6;
      depth++, parent = "parentNode" in parent ? parent.parentNode : null
    ) {
      if (!element(parent)) continue;
      if (
        /(?:logo|brand|site-name)/i.test(
          `${attr(parent, "class")} ${attr(parent, "id")}`
        )
      )
        return true;
      if (
        parent.tagName === "a" &&
        imageUrl(attr(parent, "href"), url) === new URL("/", url).href
      ) {
        let region = parent.parentNode;
        for (
          let i = 0;
          region && i < 5;
          i++, region = "parentNode" in region ? region.parentNode : null
        ) {
          if (
            element(region) &&
            (region.tagName === "header" ||
              region.tagName === "nav" ||
              /header|navbar/i.test(attr(region, "class")))
          )
            return true;
        }
      }
    }
    return false;
  };
  for (const node of nodes.filter(n => n.tagName === "img")) {
    if (
      /(?:logo|brand)/i.test(
        [
          attr(node, "src"),
          attr(node, "alt"),
          attr(node, "class"),
          attr(node, "id"),
        ].join(" ")
      ) ||
      inBrand(node)
    ) {
      add(attr(node, "data-src") || attr(node, "data-lazy-src"));
      add(attr(node, "src"));
    }
  }
  for (const rel of ["apple-touch-icon", "icon"]) {
    for (const node of nodes.filter(
      n => n.tagName === "link" && attr(n, "rel").split(/\s+/).includes(rel)
    ))
      add(attr(node, "href"));
  }
  add("/favicon.ico");
  const telegramUrl =
    nodes
      .filter(n => n.tagName === "a")
      .map(n => providerTelegramUrl(attr(n, "href")))
      .find(Boolean) ?? null;
  return {
    name: clean(
      meta("og:site_name") ??
        textOf(nodes.find(n => n.tagName === "title")) ??
        undefined,
      200
    ),
    description: clean(
      meta("description") ?? meta("og:description") ?? undefined,
      2000
    ),
    logos: candidates.slice(0, 5),
    telegramUrl,
  };
}

export function parseAudience(value: string): Audience | null {
  const match = value.match(
    /([\d][\d\s\u00a0,.]*[KM]?)\s+(members?|subscribers?)\b/i
  );
  if (!match) return null;
  const token = match[1].replace(/[\s\u00a0,]/g, "");
  const suffix = token.match(/[KM]$/i)?.[0].toUpperCase();
  const count =
    Number(suffix ? token.slice(0, -1) : token) *
    (suffix === "M" ? 1000000 : suffix === "K" ? 1000 : 1);
  if (
    !Number.isFinite(count) ||
    count < 0 ||
    count > 2000000000 ||
    !Number.isInteger(count)
  )
    return null;
  return {
    count,
    kind: /^member/i.test(match[2]) ? "members" : "subscribers",
    approximate: Boolean(suffix),
  };
}
export function parseTelegram(html: string, url: string) {
  const nodes = allNodes(parse(html));
  const title = textOf(
    nodes.find(n => cls(n, "tgme_page_title")),
    100
  );
  const extra = textOf(nodes.find(n => cls(n, "tgme_page_extra"))) ?? "";
  const audience = parseAudience(extra);
  const invite = /t\.me\/\+/.test(url);
  // A Telegram contact/user page and the generic invite landing page are not group metadata.
  const isGroup = Boolean(
    title &&
      (audience || (invite && !/^(?:telegram|join group chat)$/i.test(title)))
  );
  const avatar = nodes.find(
    n => n.tagName === "img" && cls(n, "tgme_page_photo_image")
  );
  return {
    name: isGroup ? title : null,
    description: isGroup
      ? textOf(
          nodes.find(n => cls(n, "tgme_page_description")),
          600
        )
      : null,
    avatar: isGroup && avatar ? imageUrl(attr(avatar, "src"), url) : null,
    audience: isGroup ? audience : null,
  };
}

export function parseWhatsApp(html: string, url: string) {
  const nodes = allNodes(parse(html));
  const meta = (key: string, maximum: number) => {
    const node = nodes.find(
      n =>
        n.tagName === "meta" &&
        (attr(n, "property") === key || attr(n, "name") === key)
    );
    return node ? clean(attr(node, "content"), maximum) : null;
  };
  const title = textOf(nodes.find(n => n.tagName === "title"));
  if (
    /^(?:just a moment|access denied|security check|attention required|checking your browser|verify you are human)/i.test(
      title ?? ""
    )
  )
    throw new Error("metadata_protected");
  const name = meta("og:title", 100);
  const generic =
    /^(?:whatsapp(?: group invite)?|group invite|join (?:a |the )?(?:group|chat)|دعوة (?:إلى )?مجموعة واتساب|دعوة للانضمام إلى مجموعة واتساب|invitación (?:a un grupo|de grupo) de whatsapp)$/i;
  const known = Boolean(name && !generic.test(name));
  const description = meta("og:description", 600);
  return {
    name: known ? name : null,
    description:
      known &&
      description &&
      !generic.test(description) &&
      !/^(?:follow this link to join|open this link to join|join my whatsapp|افتح هذا الرابط|اتبع هذا الرابط|sigue este enlace|abre este enlace)/i.test(
        description
      )
        ? description
        : null,
    avatar: known ? imageUrl(meta("og:image", 2048), url) : null,
    // Invite pages don't reliably expose a public member count. Never infer one.
    audience: null as Audience | null,
  };
}

// Public invite lookup only; no accepting invitations, joining servers or bot token.
// https://docs.discord.com/developers/resources/invite#get-invite
export function parseDiscordInvite(value: unknown, code: string) {
  const empty = { name: null, description: null, avatar: null, audience: null };
  if (!value || typeof value !== "object") return empty;
  const data = value as Record<string, unknown>;
  if (
    data.type !== 0 ||
    data.code !== code ||
    !data.guild ||
    typeof data.guild !== "object"
  )
    return empty;
  const guild = data.guild as Record<string, unknown>;
  if (
    typeof guild.id !== "string" ||
    !/^\d{1,20}$/.test(guild.id) ||
    typeof guild.name !== "string"
  )
    return empty;
  const name = clean(guild.name, 100);
  if (!name) return empty;
  const count = data.approximate_member_count;
  const audience: Audience | null =
    typeof count === "number" &&
    Number.isSafeInteger(count) &&
    count >= 0 &&
    count <= 2000000000
      ? { count, kind: "members", approximate: true }
      : null;
  return {
    name,
    description:
      typeof guild.description === "string"
        ? clean(guild.description, 600)
        : null,
    avatar:
      typeof guild.icon === "string" &&
      /^(?:a_)?[a-f0-9]{32}$/i.test(guild.icon)
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256`
        : null,
    audience,
  };
}

const svgTags = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "use",
  "pattern",
  "image",
  "title",
  "desc",
]);
const svgAttrs = new Set([
  "id",
  "viewBox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "preserveAspectRatio",
  "clip-path",
  "clip-rule",
  "mask",
  "maskUnits",
  "maskContentUnits",
  "patternUnits",
  "patternContentUnits",
  "patternTransform",
]);
const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export function sanitizeSvg(source: string): Buffer | null {
  if (source.length > 128000 || /<!DOCTYPE|<!ENTITY/i.test(source)) return null;
  const svg = allNodes(parse(source)).find(n => n.tagName === "svg");
  if (!svg) return null;
  let count = 0;
  function render(node: Node, depth = 0): string {
    if (++count > 5000 || depth > 50) return "";
    if (!element(node))
      return node.nodeName === "#text" && "value" in node
        ? escapeXml(node.value)
        : "";
    if (
      !svgTags.has(node.tagName) ||
      node.namespaceURI !== "http://www.w3.org/2000/svg"
    )
      return "";
    const values = new Map(
      node.attrs.filter(a => svgAttrs.has(a.name)).map(a => [a.name, a.value])
    );
    for (const declaration of attr(node, "style").split(";")) {
      const i = declaration.indexOf(":");
      const name = declaration.slice(0, i).trim();
      if (i > 0 && svgAttrs.has(name))
        values.set(name, declaration.slice(i + 1).trim());
    }
    const attributes: string[] = [];
    values.forEach((value, name) => {
      if (
        value.length > 64000 ||
        /[<>]|(?:https?|data|javascript):|expression|@import|\\/i.test(value) ||
        (/url\s*\(/i.test(value) && !/^url\(#[A-Za-z_][\w.-]*\)$/.test(value))
      )
        return;
      attributes.push(`${name}="${escapeXml(value)}"`);
    });
    if (node.tagName === "use") {
      const href = attr(node, "href");
      if (/^#[A-Za-z_][\w.-]*$/.test(href))
        attributes.push(`href="${escapeXml(href)}"`);
    }
    if (node.tagName === "image") {
      // Preserve self-contained raster logos, never external loads or nested SVG.
      const embedded = attr(node, "href").match(
        /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/
      );
      if (!embedded) return "";
      const raster = safeImage(Buffer.from(embedded[2], "base64"), embedded[1]);
      if (!raster || raster.mime !== embedded[1]) return "";
      attributes.push(
        `href="data:${raster.mime};base64,${raster.body.toString("base64")}"`
      );
    }
    if (node.tagName === "svg")
      attributes.push('xmlns="http://www.w3.org/2000/svg"');
    return `<${node.tagName} ${attributes.join(" ")}>${children(node)
      .map(n => render(n, depth + 1))
      .join("")}</${node.tagName}>`;
  }
  const result = render(svg);
  // A removed pattern/image must not leave a valid-looking but invisible logo.
  const ids = new Set(
    Array.from(result.matchAll(/\bid="([^"]+)"/g), match => match[1])
  );
  const references = Array.from(
    result.matchAll(/(?:url\(#|href="#)([A-Za-z_][\w.-]*)/g),
    match => match[1]
  );
  if (references.some(id => !ids.has(id))) return null;
  return /<(?:path|rect|circle|ellipse|polygon|polyline|use|image)\b/.test(
    result
  )
    ? Buffer.from(result)
    : null;
}

export function safeImage(
  body: Buffer,
  contentType: string
): { body: Buffer; mime: string } | null {
  if (body.length < 12 || body.length > 1048576) return null;
  const hex = body.subarray(0, 12).toString("hex");
  if (contentType === "image/svg+xml") {
    const safe = sanitizeSvg(body.toString("utf8"));
    return safe ? { body: safe, mime: contentType } : null;
  }
  const mime = hex.startsWith("89504e470d0a1a0a")
    ? "image/png"
    : hex.startsWith("ffd8ff")
      ? "image/jpeg"
      : hex.startsWith("474946383761") || hex.startsWith("474946383961")
        ? "image/gif"
        : hex.startsWith("52494646") &&
            body.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : hex.startsWith("00000100")
            ? "image/x-icon"
            : null;
  return mime ? { body, mime } : null;
}
