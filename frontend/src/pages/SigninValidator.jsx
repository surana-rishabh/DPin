import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../lib/api.js';

export default function SigninValidator() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const signIn = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await axios.post(apiUrl('/validator-signin'), { email: email.trim(), password }, { withCredentials: true });
      navigate('/validator-dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Sign in failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 pb-20 pt-40">
      <Link to="/validator" className="text-sm text-slate-500 hover:text-slate-200">← Validators</Link>
      <h1 className="mt-7 text-4xl font-medium tracking-[-0.04em] text-[#f3f0e8]">Validator sign in.</h1>
      <form onSubmit={signIn} className="mt-8 space-y-5">
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div>
          <label htmlFor="email" className="mb-2 block text-sm text-slate-300">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-3 text-sm text-[#f3f0e8]" />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm text-slate-300">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-3 text-sm text-[#f3f0e8]" />
        </div>
        <button disabled={submitting} className="w-full bg-[#d9ff57] px-5 py-3.5 text-sm font-semibold text-[#07110e] disabled:opacity-50">{submitting ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-sm text-slate-500">New validator? <Link to="/signup-validator" className="text-emerald-300">Create an account</Link></p>
      </form>
    </main>
  );
}
