/**
 * 工作原理中的一个章节：图解、说明，以及代码中的关键参数。
 */
export function Levels({ id, title, how, hood }: {
  id: string; title: string;
  sentence?: React.ReactNode; how: React.ReactNode; hood: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="wide mt-16 scroll-mt-24 first:mt-8">
      <div className="border-b border-line pb-3">
        <h2 id={`${id}-title`} className="!mt-0">{title}</h2>
      </div>
      <div className="pt-6">{how}</div>
      <h3 className="!mt-10 text-base font-semibold text-fg">参数与代码位置</h3>
      <div className="pt-3">{hood}</div>
    </section>
  );
}
