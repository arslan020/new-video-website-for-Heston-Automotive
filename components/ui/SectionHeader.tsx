export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#EEF1F5] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-8 w-1 shrink-0 rounded-full bg-[#0B3D73]" />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold leading-5 text-[#0F172A]">{title}</h2>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-[#64748B]">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
