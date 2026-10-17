import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import ResponseTimeChart from './ResponseTimeChart';
import RecentEvents from './RecentEvents';
import { apiUrl } from '../../lib/api.js';

interface Monitor {
  websiteName: string;
  url: string;
  disabled: boolean;
  currentStatus: 'Good' | 'Bad' | null;
  lastCheckedAt: string | null;
  uptimePercentage: number;
  response: number | null;
  totalTicks: number;
  averageLatencyPerMinute: { timestamp: string; averageLatency: number }[];
  downlog: { _id: string; createdAt: string; location: string }[];
}

export default function MonitorDetails() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMonitor = useCallback(async (signal: AbortSignal) => {
    try {
      const token = await getToken();
      const response = await fetch(apiUrl(`/website-details/${id}`), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok) throw new Error('Could not load this monitor.');
      const data = await response.json();
      if (!signal.aborted) {
        setMonitor(data);
        setError('');
      }
    } catch (requestError) {
      if (!signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Could not load this monitor.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    const controller = new AbortController();
    loadMonitor(controller.signal);
    const timer = setInterval(() => loadMonitor(controller.signal), 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [loadMonitor]);

  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-slate-400">Loading…</main>;
  if (!monitor) return <main className="mx-auto w-full max-w-6xl flex-1 px-6 pt-40"><p role="alert" className="text-sm text-rose-300">{error}</p><Link to="/dashboard" className="mt-6 inline-block text-sm text-emerald-300">← Monitors</Link></main>;

  const label = monitor.disabled ? 'Paused' : monitor.currentStatus === 'Good' ? 'Up' : monitor.currentStatus === 'Bad' ? 'Down' : 'Awaiting checks';
  const statusColor = monitor.disabled ? 'text-slate-400' : monitor.currentStatus === 'Good' ? 'text-emerald-300' : monitor.currentStatus === 'Bad' ? 'text-rose-300' : 'text-amber-300';

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-20 pt-32 sm:px-10">
      <Link to="/dashboard" className="text-sm text-slate-500 hover:text-slate-200">← Monitors</Link>
      <header className="mt-7 border-b border-white/10 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="break-all text-4xl font-medium tracking-[-0.04em] text-[#f3f0e8]">{monitor.websiteName}</h1>
          <span className={`text-sm ${statusColor}`}>● {label}</span>
        </div>
        <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-sm text-slate-400 hover:text-white">{monitor.url} ↗</a>
        {monitor.lastCheckedAt && <p className="mt-3 text-xs text-slate-500">Last checked {new Date(monitor.lastCheckedAt).toLocaleString()}</p>}
      </header>
      {error && <p role="alert" className="mt-5 text-sm text-rose-300">{error}</p>}
      <dl className="grid grid-cols-1 divide-y divide-white/10 py-8 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          ['Uptime', monitor.totalTicks ? `${monitor.uptimePercentage.toFixed(2)}%` : '—'],
          ['Response time', monitor.response === null ? '—' : `${monitor.response} ms`],
          ['Checks', monitor.totalTicks.toLocaleString()],
        ].map(([name, value]) => <div key={name} className="py-4 sm:px-6 sm:first:pl-0"><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-2 text-3xl font-medium text-[#f3f0e8]">{value}</dd></div>)}
      </dl>
      <section className="border border-white/10 p-5 sm:p-7">
        <h2 className="mb-7 text-base font-medium text-[#f3f0e8]">Response time</h2>
        <ResponseTimeChart initialData={monitor.averageLatencyPerMinute.map((item) => ({
          name: new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          responseTime: item.averageLatency,
          timestamp: new Date(item.timestamp),
        }))} />
      </section>
      <RecentEvents events={monitor.downlog} />
    </main>
  );
}
