const tones = {
  amber: 'bg-[#FDF3E1] text-[#92400E]',
  red: 'bg-[#FDECEC] text-[#A61B1B]',
  grey: 'bg-[#F1F5F9] text-[#475569]',
};

export function Badge({ tone, children }: { tone: keyof typeof tones; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
