import { Activity, Clock3, List } from 'lucide-react';
import Hero from '../components/Hero.jsx';

export default function LandingPage() {
  return (
    <main className="flex-1">
      <Hero />
      <section aria-label="Features" className="mx-auto grid max-w-6xl gap-8 border-t border-white/10 px-6 py-10 sm:grid-cols-3 sm:px-10 sm:py-12">
        {[
          [Activity, 'Uptime', 'See which websites are up.'],
          [Clock3, 'Response time', 'Spot changes in speed.'],
          [List, 'Incident history', 'Review recent outages.'],
        ].map(([Icon, title, description]) => (
          <div key={title}>
            <Icon className="mb-5 text-emerald-300" size={19} aria-hidden="true" />
            <h2 className="text-sm font-medium text-[#f3f0e8]">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
