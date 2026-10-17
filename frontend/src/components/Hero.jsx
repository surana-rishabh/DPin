import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16 pt-40 sm:px-10 sm:pb-24 sm:pt-48">
      <p className="mb-7 text-xs font-medium uppercase tracking-[0.22em] text-emerald-300">Website monitoring</p>
      <h1 className="max-w-4xl text-[clamp(3.5rem,8vw,6.5rem)] font-medium leading-[0.98] tracking-[-0.065em] text-[#f3f0e8]">
        Keep an eye<br />on your websites.
      </h1>
      <p className="mt-7 max-w-md text-lg leading-7 text-slate-400">
        Track uptime, response times, and incidents in one place.
      </p>
      <Link to="/dashboard" className="mt-9 inline-flex items-center gap-6 bg-[#d9ff57] px-5 py-3.5 text-sm font-semibold text-[#07110e] hover:bg-[#e7ff91]">
        Start monitoring <ArrowUpRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}
