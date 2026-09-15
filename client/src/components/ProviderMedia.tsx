import { useState } from "react";
import { publicProfileUrl } from "../../../shared/providerProfile";

function useMediaState(src: string | null, logo = false) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [surface, setSurface] = useState<{ src: string; color: string } | null>(
    null
  );
  const fail = () => setFailedSrc(src);
  const loaded = (image: HTMLImageElement) => {
    if (!logo || !src) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, 32, 32);
      const pixels = context.getImageData(0, 0, 32, 32).data;
      let weight = 0;
      let brightness = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3] / 255;
        weight += alpha;
        brightness +=
          alpha *
          (0.2126 * pixels[i] +
            0.7152 * pixels[i + 1] +
            0.0722 * pixels[i + 2]);
      }
      if (weight < 0.5) {
        fail();
        return;
      }
      setSurface({
        src,
        color: brightness / weight > 165 ? "#0f172a" : "#ffffff",
      });
    } catch {
      // Cross-origin manual images may disallow pixel reads; a neutral surface
      // keeps both light and dark marks legible without another network request.
    }
  };
  return {
    failed: Boolean(src && src === failedSrc),
    fail,
    loaded,
    style: logo
      ? { backgroundColor: surface?.src === src ? surface.color : "#767676" }
      : undefined,
  };
}

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
  const media = useMediaState(safe, true);
  const visible = safe && !media.failed;
  return (
    <div
      dir="ltr"
      style={visible ? media.style : undefined}
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
          onLoad={event => media.loaded(event.currentTarget)}
          onError={media.fail}
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
  logo = false,
  className = "aspect-video w-full object-cover object-top",
}: {
  src?: string | null;
  alt: string;
  errorText?: string;
  logo?: boolean;
  className?: string;
}) {
  const safe = publicProfileUrl(src);
  const media = useMediaState(safe, logo);
  if (!safe) return null;
  if (media.failed)
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
      style={media.style}
      onLoad={event => media.loaded(event.currentTarget)}
      onError={media.fail}
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
