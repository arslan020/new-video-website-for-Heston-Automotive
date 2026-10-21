export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
      <span className="h-8 w-1 shrink-0 rounded-full bg-[#0B3D73]" />
      <div className="min-w-0">
        <h1 className="text-base font-semibold leading-5 text-[#0F172A]">{title}</h1>
        {children ? <div className="mt-0.5 text-xs text-[#64748B]">{children}</div> : null}
      </div>
    </div>
  );
}
