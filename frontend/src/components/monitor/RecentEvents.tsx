interface Incident {
  _id: string;
  createdAt: string;
  location: string;
}

export default function RecentEvents({ events }: { events: Incident[] }) {
  return (
    <section className="mt-8 border border-white/10 p-5 sm:p-7">
      <h2 className="text-base font-medium text-[#f3f0e8]">Recent incidents</h2>
      {events.length ? (
        <ul className="mt-5 divide-y divide-white/10">
          {events.map((event) => (
            <li key={event._id} className="flex flex-wrap justify-between gap-3 py-4 text-sm">
              <span className="text-rose-300">Failed check <span className="ml-2 text-slate-400">{event.location}</span></span>
              <time dateTime={event.createdAt} className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      ) : <p className="mt-6 text-sm text-slate-500">No incidents recorded.</p>}
    </section>
  );
}
