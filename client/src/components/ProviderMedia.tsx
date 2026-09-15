import { useState } from "react";
import { publicProfileUrl } from "../../../shared/providerProfile";

export function ProviderLogo({
  src,
  name,
  initials,
  className = "size-11 text-sm",
}: {
  src?: string | null;
  name: string;
  initials: string;
  className?: string;
}) {
  const safe = publicProfileUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const visible = safe && safe !== failedSrc;
  return (
    <div
      dir="ltr"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl font-extrabold shadow-sm ${visible ? "border border-slate-200 bg-white" : "bg-gradient-to-br from-[#0B2A68] via-[#103E99] to-[#0D9488] text-white"} ${className}`}
    >
      {visible ? (
        <img
          key={safe}
          src={safe}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="size-full object-contain p-1.5"
          onError={() => setFailedSrc(safe)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

export function ProviderImage({
  src,
  alt,
  errorText,
  className = "aspect-video w-full object-cover object-top",
}: {
  src?: string | null;
  alt: string;
  errorText?: string;
  className?: string;
}) {
  const safe = publicProfileUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!safe) return null;
  if (failedSrc === safe)
    return errorText ? (
      <p role="status" className="p-4 text-sm text-slate-500">
        {errorText}
      </p>
    ) : null;
  return (
    <img
      key={safe}
      src={safe}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setFailedSrc(safe)}
    />
  );
}

export function ProviderWebsitePreview({
  src,
  title,
  openLabel,
}: {
  src?: string | null;
  title: string;
  openLabel: string;
}) {
  const safe = publicProfileUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!safe || failedSrc === safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title} · ${openLabel}`}
      className="block w-full overflow-hidden rounded-2xl lg:w-80 lg:shrink-0 border border-slate-200 bg-white shadow-sm transition hover:border-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-700"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-xs font-bold text-slate-600">{title}</span>
        <span aria-hidden="true" className="flex gap-1">
          <i className="size-1.5 rounded-full bg-slate-300" />
          <i className="size-1.5 rounded-full bg-slate-300" />
          <i className="size-1.5 rounded-full bg-slate-300" />
        </span>
      </div>
      <img
        key={safe}
        src={safe}
        alt={title}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="aspect-video w-full object-cover object-top"
        onError={() => setFailedSrc(safe)}
      />
    </a>
  );
}
