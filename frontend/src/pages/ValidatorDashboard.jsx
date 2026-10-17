import { useEffect, useState } from 'react';
import { Activity, LogOut, Shield, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../lib/api.js';

const relativeTime = (value) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? '' : 's'} ago`;
};

const ValidatorDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [validator, setValidator] = useState(null);
  const [activity, setActivity] = useState([]);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [network, setNetwork] = useState({ totalValidators: 0, averagePending: 0 });

  useEffect(() => {
    axios.get(apiUrl('/validator-detail'), { withCredentials: true })
      .then(({ data }) => {
        setValidator(data.validator);
        setPayoutsEnabled(data.payoutsEnabled === true);
        setActivity(data.recentWebsites || []);
        setNetwork({ totalValidators: data.totalValidator || 0, averagePending: Number(data.averagePayout || 0) });
      })
      .catch((requestError) => {
        if (requestError.response?.status === 401) navigate('/signin-validator');
        else setError('Could not load validator details.');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const signOut = async () => {
    await axios.post(apiUrl('/validator-signout'), {}, { withCredentials: true });
    navigate('/signin-validator');
  };

  const withdraw = async () => {
    setWithdrawing(true);
    setError('');
    try {
      const { data } = await axios.post(apiUrl('/getPayout'), {}, { withCredentials: true });
      setValidator((current) => ({ ...current, pendingPayouts: Math.max(0, current.pendingPayouts - data.amount) }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Payout request failed.');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-slate-400">Loading validator account…</main>;
  if (!validator) return <main className="grid min-h-screen place-items-center text-sm text-rose-300">{error || 'Validator account unavailable.'}</main>;

  return (
    <main className="min-h-screen px-6 pb-24 pt-32 sm:px-10">
      <header className="mx-auto flex max-w-6xl flex-col justify-between gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Validator account</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#f3f0e8]">{validator.name}</h1></div>
        <button onClick={signOut} className="inline-flex items-center gap-2 self-start border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-white/35"><LogOut size={16} /> Sign out</button>
      </header>
      {error && <div role="alert" className="mx-auto mt-6 max-w-6xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}
      <section className="mx-auto mt-8 grid max-w-6xl gap-px bg-white/10 sm:grid-cols-3">
        {[
          ['Pending rewards', `${validator.pendingPayouts || 0} lamports`, Shield],
          ['Registered validators', network.totalValidators, Users],
          ['Average pending balance', `${network.averagePending.toFixed(2)} lamports`, Activity],
        ].map(([label, value, Icon]) => <article key={label} className="bg-[#07110e] p-6"><Icon className="text-emerald-300" size={18} /><p className="mt-8 text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-[#f3f0e8]">{value}</p></article>)}
      </section>
      <section className="mx-auto mt-8 grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="border border-white/10 p-6">
          <h2 className="text-xl font-semibold text-[#f3f0e8]">Recent checks</h2>
          {activity.length === 0 ? <p className="mt-8 text-sm text-slate-500">Your recent checks will appear here.</p> : <div className="mt-6 divide-y divide-white/10">{activity.map((item) => <div key={item._id} className="flex items-center justify-between gap-4 py-4 text-sm"><div><span className={item.status === 'Good' ? 'text-emerald-300' : 'text-rose-300'}>{item.status}</span><span className="ml-3 text-slate-400">{item.latency} ms</span></div><time className="text-slate-500">{relativeTime(item.createdAt)}</time></div>)}</div>}
        </div>
        <aside className="border border-white/10 p-6">
          <h2 className="text-xl font-semibold text-[#f3f0e8]">Account details</h2>
          <dl className="mt-6 space-y-5 text-sm">
            {[
              ['Email', validator.email],
              ['Location', validator.location],
              ['Payout address', validator.payoutPublicKey],
            ].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-all text-slate-200">{value}</dd></div>)}
          </dl>
          {payoutsEnabled && <button onClick={withdraw} disabled={withdrawing || !validator.pendingPayouts} className="mt-8 w-full bg-[#d9ff57] px-4 py-3 font-semibold text-[#07110e] disabled:cursor-not-allowed disabled:opacity-40">{withdrawing ? 'Requesting…' : 'Request payout'}</button>}
        </aside>
      </section>
    </main>
  );
};

export default ValidatorDashboard;
