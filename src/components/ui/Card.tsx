export default function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card border-t-2 border-t-secondary/40 border-x border-b border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(7,59,76,0.08),0_8px_24px_-8px_rgba(82,183,136,0.12)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
