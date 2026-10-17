import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Validator() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-20 pt-40 sm:px-10">
      <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Validators</p>
      <h1 className="mt-7 max-w-3xl text-5xl font-medium leading-[1.02] tracking-[-0.055em] text-[#f3f0e8] sm:text-7xl">Help keep websites in view.</h1>
      <p className="mt-7 max-w-md text-lg leading-7 text-slate-400">Run website checks from your computer and track your activity.</p>
      <div className="mt-9 flex flex-wrap items-center gap-6">
        <Link to="/signup-validator" className="inline-flex items-center gap-5 bg-[#d9ff57] px-5 py-3.5 text-sm font-semibold text-[#07110e] hover:bg-[#e7ff91]">Join the network <ArrowUpRight size={18} aria-hidden="true" /></Link>
        <Link to="/signin-validator" className="text-sm text-slate-300 hover:text-white">Validator sign in</Link>
      </div>
      <ol className="mt-20 grid gap-8 border-t border-white/10 pt-8 sm:grid-cols-3">
        {[
          ['Create your account', 'Register and save your signing key.'],
          ['Start the CLI', 'Connect your computer to the network.'],
          ['Review activity', 'See your recent checks and rewards.'],
        ].map(([title, copy], index) => (
          <li key={title}><span className="text-xs text-emerald-300">0{index + 1}</span><h2 className="mt-4 text-sm font-medium text-[#f3f0e8]">{title}</h2><p className="mt-2 text-sm text-slate-500">{copy}</p></li>
        ))}
      </ol>
    </main>
  );
}
