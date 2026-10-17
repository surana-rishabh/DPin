import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { apiUrl } from '../lib/api.js';

const fields = [
  ['name', 'Name', 'text', 'name', 100],
  ['email', 'Email', 'email', 'email', 254],
  ['password', 'Password', 'password', 'new-password', 128],
  ['confirmPassword', 'Confirm password', 'password', 'new-password', 128],
  ['location', 'City, country', 'text', 'address-level2', 160],
  ['payoutPublicKey', 'Solana payout address', 'text', 'off', 64],
];

function saveKey(privateKey) {
  const url = URL.createObjectURL(new Blob([privateKey], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'validator-private-key.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SignupValidator() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', location: '', payoutPublicKey: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savedKey, setSavedKey] = useState('');

  const register = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const pair = nacl.sign.keyPair();
      const privateKey = naclUtil.encodeBase64(pair.secretKey);
      await axios.post(apiUrl('/validator'), {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        location: form.location.trim(),
        payoutPublicKey: form.payoutPublicKey.trim(),
        publicKey: naclUtil.encodeBase64(pair.publicKey),
      });
      setSavedKey(privateKey);
      setForm({ name: '', email: '', password: '', confirmPassword: '', location: '', payoutPublicKey: '' });
      saveKey(privateKey);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Registration failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 pb-20 pt-32">
      <Link to="/validator" className="text-sm text-slate-500 hover:text-slate-200">← Validators</Link>
      <h1 className="mt-7 text-4xl font-medium tracking-[-0.04em] text-[#f3f0e8]">{savedKey ? 'You’re registered.' : 'Create a validator.'}</h1>
      {savedKey ? (
        <div className="mt-6 space-y-6">
          <p className="text-sm leading-6 text-slate-400">Keep your downloaded signing key safe. You’ll use it to start the CLI.</p>
          <button onClick={() => saveKey(savedKey)} className="text-sm text-emerald-300 underline underline-offset-4">Download key again</button>
          <Link to="/signin-validator" className="block bg-[#d9ff57] px-5 py-3.5 text-center text-sm font-semibold text-[#07110e]">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={register} className="mt-8 space-y-5">
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {fields.map(([name, label, type, autoComplete, maxLength]) => (
            <div key={name}>
              <label htmlFor={name} className="mb-2 block text-sm text-slate-300">{label}</label>
              <input id={name} name={name} type={type} autoComplete={autoComplete} required maxLength={maxLength} minLength={type === 'password' ? 12 : undefined} value={form[name]} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-3 text-sm text-[#f3f0e8]" />
              {name === 'password' && <p className="mt-2 text-xs text-slate-500">At least 12 characters.</p>}
            </div>
          ))}
          <p className="text-xs leading-5 text-slate-500">Your signing key downloads when you register. Keep it private.</p>
          <button disabled={submitting} className="w-full bg-[#d9ff57] px-5 py-3.5 text-sm font-semibold text-[#07110e] disabled:opacity-50">{submitting ? 'Registering…' : 'Register & save key'}</button>
          <p className="text-center text-sm text-slate-500">Already registered? <Link to="/signin-validator" className="text-emerald-300">Sign in</Link></p>
        </form>
      )}
    </main>
  );
}
