import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 px-6 py-6 sm:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-xs text-slate-500">
        <span>dpin. Website monitoring.</span>
        <Link to="/validator" className="hover:text-slate-200">Run a validator <span aria-hidden="true">↗</span></Link>
      </div>
    </footer>
  );
}
