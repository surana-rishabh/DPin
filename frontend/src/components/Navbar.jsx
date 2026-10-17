import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/clerk-react';
import Logo from './Logo.jsx';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { isSignedIn } = useAuth();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07110e]/95 backdrop-blur-lg" aria-label="Primary navigation">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 sm:px-10">
        <Link to="/" aria-label="dPIN home" onClick={() => setIsOpen(false)}><Logo /></Link>
        <div className="hidden items-center gap-7 md:flex">
          <Link to="/dashboard" className="text-sm text-slate-300 hover:text-white">Monitors</Link>
          <Link to="/validator" className="text-sm text-slate-300 hover:text-white">Validators</Link>
          {isSignedIn ? <UserButton afterSignOutUrl="/" /> : <Link to="/sign-in" className="text-sm font-medium text-[#d9ff57]">Sign in <span aria-hidden="true">↗</span></Link>}
        </div>
        <button type="button" className="grid h-11 w-11 place-items-center text-slate-200 md:hidden" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen} aria-controls="mobile-navigation" aria-label={isOpen ? 'Close navigation' : 'Open navigation'}>
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      {isOpen && (
        <div id="mobile-navigation" className="flex flex-col gap-5 border-t border-white/10 bg-[#07110e] px-6 py-6 md:hidden">
          <Link to="/dashboard" onClick={() => setIsOpen(false)} className="text-sm text-slate-200">Monitors</Link>
          <Link to="/validator" onClick={() => setIsOpen(false)} className="text-sm text-slate-200">Validators</Link>
          {isSignedIn ? <UserButton afterSignOutUrl="/" /> : <Link to="/sign-in" onClick={() => setIsOpen(false)} className="text-sm font-medium text-[#d9ff57]">Sign in</Link>}
        </div>
      )}
    </nav>
  );
}
