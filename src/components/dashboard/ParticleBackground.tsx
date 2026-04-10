"use client";

import { useEffect, useRef } from "react";

export function ParticleBackground() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let pointerX = 0;
    let pointerY = 0;
    let currentX = 0;
    let currentY = 0;
    let animationFrame = 0;

    const animate = () => {
      currentX += (pointerX - currentX) * 0.08;
      currentY += (pointerY - currentY) * 0.08;

      layer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1.08)`;
      animationFrame = window.requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: MouseEvent) => {
      if (mediaQuery.matches) return;

      const x = (event.clientX / window.innerWidth - 0.5) * 18;
      const y = (event.clientY / window.innerHeight - 0.5) * 12;
      pointerX = x;
      pointerY = y;
    };

    const handleDeviceTilt = (event: DeviceOrientationEvent) => {
      if (mediaQuery.matches) return;

      const gamma = Math.max(-10, Math.min(10, event.gamma ?? 0));
      const beta = Math.max(-10, Math.min(10, event.beta ?? 0));
      pointerX = gamma * 0.8;
      pointerY = beta * 0.45;
    };

    const resetMotion = () => {
      pointerX = 0;
      pointerY = 0;
    };

    animationFrame = window.requestAnimationFrame(animate);
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("deviceorientation", handleDeviceTilt);
    window.addEventListener("mouseleave", resetMotion);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("deviceorientation", handleDeviceTilt);
      window.removeEventListener("mouseleave", resetMotion);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      <div
        ref={layerRef}
        className="absolute -inset-[6%] will-change-transform"
        style={{
          backgroundImage: "url('/mountains.avif')",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          filter: "saturate(0.82) brightness(0.58) contrast(0.98)",
          opacity: 0.9,
          transform: "translate3d(0, 0, 0) scale(1.08)",
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(247,148,29,0.14),transparent_44%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.38)_0%,rgba(10,10,10,0.22)_28%,rgba(11,11,11,0.52)_72%,rgba(8,8,8,0.76)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,13,13,0.42)_0%,rgba(13,13,13,0.14)_35%,rgba(13,13,13,0.1)_65%,rgba(13,13,13,0.38)_100%)]" />
      <div className="absolute inset-0 backdrop-blur-[0.75px]" />
    </div>
  );
}
