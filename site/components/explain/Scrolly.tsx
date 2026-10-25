"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 滚动说明：文字步骤经过视口中部时，旁边的图解会切换到对应状态。
 */
export function Scrolly({ steps, diagram, label }: {
  steps: React.ReactNode[];
  diagram: (step: number) => React.ReactNode;
  label: string;
}) {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    // 以文档视口为观察根节点。
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step));
      },
      { root: document, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length]);

  return (
    <div className="wide grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
      <div className="sticky top-16 z-10 -mx-4 self-start border-b border-line bg-bg/90 px-0 pb-3 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:order-2 lg:top-24 lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <figure aria-label={label} className="diagram overflow-hidden border-y border-line bg-bg-raised sm:rounded-2xl sm:border">
          {diagram(step)}
        </figure>
        <p className="mt-2 text-center text-xs text-faint lg:hidden" aria-hidden="true">第 {step + 1} 步，共 {steps.length} 步</p>
      </div>
      <div className="lg:order-1">
        {steps.map((s, i) => (
          <div
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            data-step={i}
            data-active={step === i}
            className="scrolly-step flex min-h-[38vh] flex-col justify-center py-6 text-[16px] leading-[1.7] first:pt-2 last:min-h-[30vh] lg:min-h-[52vh]"
          >
            <div className="max-w-[65ch]">{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
