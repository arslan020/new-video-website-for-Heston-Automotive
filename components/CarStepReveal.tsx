'use client';

import { useEffect, useRef, useState } from 'react';

export default function CarStepReveal({
  src,
  alt,
  progress,
}: {
  src: string;
  alt: string;
  progress: number;
}) {
  const [bounds, setBounds] = useState({ left: 0.12, right: 0.84 });
  const frostRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef(1);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      const width = 400;
      const height = Math.max(1, Math.round(img.naturalHeight * (width / img.naturalWidth)));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height).data;
      let minX = width;
      let maxX = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const lum = pixels[i] + pixels[i + 1] + pixels[i + 2];
        if (pixels[i + 3] < 40 || (pixels[i + 3] < 250 && lum < 48)) continue;
        const x = (i / 4) % width;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      if (!cancelled && maxX > minX) {
        setBounds({ left: minX / width, right: (maxX + 1) / width });
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const edge = (bounds.left + (bounds.right - bounds.left) * (Math.min(progress, 100) / 100)) * 100;
  const span = Math.max(bounds.right * 100 - edge, 1);
  const done = progress >= 99.6;
  spanRef.current = span;

  useEffect(() => {
    const el = frostRef.current;
    if (!el || done) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const mobile = window.matchMedia('(max-width: 768px)');
    let frame = 0;
    let lastPeriod = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const grey = el.clientWidth * (spanRef.current / 100);
      const period = Math.max(Math.round(grey / 2), 1);
      const duration = mobile.matches ? 3600 : 2100;
      const t = ((now - start) % duration) / duration;
      if (period !== lastPeriod) {
        lastPeriod = period;
        el.style.backgroundSize = `${period}px 100%`;
      }
      el.style.backgroundPosition = `${(t * period).toFixed(2)}px 0px`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [done, src]);
  const mask = `linear-gradient(to right, transparent ${edge.toFixed(2)}%, #000 calc(${edge.toFixed(2)}% + 1.6%)), url("${src}")`;

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <img src={src} alt={alt} className="block w-full h-auto object-contain" />
      {!done && (
        <div
          aria-hidden
          ref={frostRef}
          className="car-reveal-frost pointer-events-none absolute inset-0"
          style={{
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskSize: '100% 100%, 100% 100%',
            maskSize: '100% 100%, 100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskComposite: 'source-in',
            maskComposite: 'intersect',
          }}
        />
      )}
    </div>
  );
}
