import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ResponseTimeChartProps {
  initialData?: { name: string; responseTime: number; timestamp: Date }[];
}

export default function ResponseTimeChart({ initialData = [] }: ResponseTimeChartProps) {
  const data = initialData.slice(-50);
  if (!data.length) return <p className="py-16 text-center text-sm text-slate-500">Response times will appear after the first check.</p>;

  return (
    <div className="h-64 w-full" role="img" aria-label={`Response times for ${data.length} recent intervals, in milliseconds`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#ffffff12" />
          <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} minTickGap={50} style={{ fontSize: 10 }} />
          <YAxis stroke="#64748b" tickLine={false} axisLine={false} width={50} tickFormatter={(value) => `${value}ms`} style={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ background: '#0d1a15', border: '1px solid #ffffff20', borderRadius: 4, color: '#f3f0e8', fontSize: 12 }} formatter={(value: number) => [`${Number(value).toFixed(1)} ms`, 'Response']} />
          <Line type="linear" dataKey="responseTime" stroke="#d9ff57" strokeWidth={2} dot={data.length === 1} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
