import type { Metadata } from 'next';
import { Noto_Sans } from 'next/font/google';

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vehicle status | Changan Heathrow',
  description: 'Track your Changan vehicle before handover at Changan Heathrow.',
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${notoSans.className} min-h-full bg-white text-[#282828]`}>{children}</div>;
}
