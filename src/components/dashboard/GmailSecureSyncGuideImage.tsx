'use client';

import { useEffect, useState } from 'react';

type Props = {
  /** Prefer real screenshots: place step-N.png in /public/guides/secure-sync/ */
  pngSrc: string;
  svgFallbackSrc: string;
  alt: string;
};

/**
 * Prefers real PNG screenshots when present; otherwise shows SVG placeholders.
 * Uses a browser Image() probe so we never flash a broken PNG in the DOM.
 */
export function GmailSecureSyncGuideImage({ pngSrc, svgFallbackSrc, alt }: Props) {
  const [src, setSrc] = useState(svgFallbackSrc);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSrc(pngSrc);
    img.onerror = () => setSrc(svgFallbackSrc);
    img.src = pngSrc;
  }, [pngSrc, svgFallbackSrc]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local guide assets (png/svg)
    <img
      src={src}
      alt={alt}
      width={280}
      height={200}
      className="h-auto w-full object-contain"
      loading="lazy"
      decoding="async"
    />
  );
}
