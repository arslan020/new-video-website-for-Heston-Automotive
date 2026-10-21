export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-[#E2E8F0] bg-white ${className}`}>
      {children}
    </section>
  );
}
