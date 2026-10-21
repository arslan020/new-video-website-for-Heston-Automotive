export function StatCard({
  label,
  value,
  helper,
  onClick,
}: {
  label: string;
  value: number | string;
  helper: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[148px] rounded-xl border border-[#E2E8F0] bg-white p-5 text-left transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#0B3D73] hover:shadow-md"
    >
      <p className="text-[13px] text-[#475569]">{label}</p>
      <p className="mt-2 text-[30px] font-semibold leading-none tracking-tight text-[#0F172A]">{value}</p>
      <div className="mt-3 text-sm">{helper}</div>
    </button>
  );
}
