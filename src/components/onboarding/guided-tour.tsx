"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { tourSteps, useOnboarding } from "./onboarding-provider";
import { positionTour } from "@/lib/onboarding-position";

export function GuidedTour() {
  const { step, setStep, stopTour, completedSteps } = useOnboarding();
  const { isMobile } = useSidebar();
  const panel = useRef<HTMLElement>(null);
  const outline = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLDivElement>(null);
  const previousTarget = useRef<Element | null>(null);

  useEffect(() => {
    if (step === null) return;
    let frame = 0;
    const current = tourSteps[step];
    // Follow portaled menus, sidebar animations, scrolling, and viewport changes.
    // Measurement runs only while the tour is active, without rerendering React.
    const place = () => {
      const tip = panel.current;
      const ring = outline.current;
      const pointer = arrow.current;
      if (!tip || !ring || !pointer) return;
      const findVisible = (id: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-tour-target="${id}"]`)).find((node) => node.getClientRects().length > 0 && !(node.matches('[data-slot="dropdown-menu-content"]') && node.dataset.state === "closed"));
      const target = findVisible(current.target) ?? findVisible(current.fallback);
      if (target) {
        if (previousTarget.current !== target) {
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
          previousTarget.current = target;
        }
        const rect = target.getBoundingClientRect();
        // Keep the tip outside the entire menu so its other choices stay usable.
        const obstacle = target.closest('[data-slot="dropdown-menu-content"]')?.getBoundingClientRect() ?? rect;
        const viewport = window.visualViewport;
        const width = viewport?.width ?? window.innerWidth;
        const height = viewport?.height ?? window.innerHeight;
        const offsetX = viewport?.offsetLeft ?? 0;
        const offsetY = viewport?.offsetTop ?? 0;
        const position = positionTour({ left: obstacle.left - offsetX, right: obstacle.right - offsetX, top: obstacle.top - offsetY, bottom: obstacle.bottom - offsetY }, width, height, tip.scrollHeight);
        Object.assign(tip.style, { left: `${position.left + offsetX}px`, top: `${position.top + offsetY}px`, width: `${position.width}px`, maxHeight: `${position.maxHeight}px`, visibility: "visible" });
        Object.assign(ring.style, { left: `${rect.left - 4}px`, top: `${rect.top - 4}px`, width: `${rect.width + 8}px`, height: `${rect.height + 8}px`, visibility: "visible" });
        const horizontal = position.side === "left" || position.side === "right";
        const centerX = Math.max(position.left + 16, Math.min(rect.left - offsetX + rect.width / 2, position.left + position.width - 16));
        const centerY = Math.max(position.top + 16, Math.min(rect.top - offsetY + rect.height / 2, position.top + Math.min(tip.scrollHeight, position.maxHeight) - 16));
        Object.assign(pointer.style, {
          left: `${offsetX + (horizontal ? position.side === "right" ? position.left - 5 : position.left + position.width - 5 : centerX - 5)}px`,
          top: `${offsetY + (horizontal ? centerY - 5 : position.side === "bottom" ? position.top - 5 : position.top + Math.min(tip.scrollHeight, position.maxHeight) - 5)}px`,
          visibility: "visible",
        });
      } else {
        // Controls can briefly disappear while the next program's events load.
        Object.assign(tip.style, { left: "12px", top: "12px", width: "min(320px, calc(100vw - 24px))", maxHeight: "calc(100dvh - 24px)", visibility: "visible" });
        ring.style.visibility = "hidden";
        pointer.style.visibility = "hidden";
      }
      frame = requestAnimationFrame(place);
    };
    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [step, isMobile]);

  if (step === null) return null;
  const current = tourSteps[step];
  const content = <>
    <div ref={outline} aria-hidden="true" className="pointer-events-none fixed z-[80] rounded-lg border-2 border-primary shadow-[0_0_0_4px_var(--background)]" style={{ visibility: "hidden" }} />
    <div ref={arrow} aria-hidden="true" className="pointer-events-none fixed z-[91] size-2.5 rotate-45 border bg-popover" style={{ visibility: "hidden" }} />
    <section ref={panel} aria-label="Guided tour" data-guided-tour className="fixed z-[90] overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl" style={{ visibility: "hidden", width: "min(320px, calc(100vw - 24px))" }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); stopTour(); }
    }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Quick tour · {step + 1} of {tourSteps.length}</p>
        <Button size="icon-xs" variant="ghost" aria-label="Exit tour" onClick={() => stopTour()}><X /></Button>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <h2 className="mt-1 text-base font-semibold">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.description}</p>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-primary"><Check className="size-3.5" aria-hidden="true" />{completedSteps.length} actions completed</p>
      </div>
      <div className="mt-2 flex gap-1" aria-label="Tour progress">
        {tourSteps.map((item, index) => <span key={item.id} title={`${item.title}: ${completedSteps.includes(item.id) ? "complete" : index === step ? "current" : "not completed"}`} className={`flex h-4 flex-1 items-center justify-center rounded-sm ${completedSteps.includes(item.id) ? "bg-primary text-primary-foreground" : index === step ? "border border-primary bg-primary/10" : "bg-muted"}`}>{completedSteps.includes(item.id) && <Check className="size-3" aria-hidden="true" />}</span>)}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        <Button size="sm" variant="outline" onClick={() => step === tourSteps.length - 1 ? stopTour(true) : setStep(step + 1)}>{step === tourSteps.length - 1 ? "Finish tour" : "Skip step"}</Button>
      </div>
    </section>
  </>;
  // Keep mobile tips inside the sidebar's focus scope; desktop tips escape its stacking context.
  return isMobile ? content : createPortal(content, document.body);
}
