"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function LineHours({ data }: { data: { date: string; totalSeconds: number }[] }) {
  if (!data.length) return <div className="h-64 flex items-center justify-center text-zinc-500">Sem dados</div>;
  const pts = data.map((d) => ({
    date: d.date,
    hours: Number((d.totalSeconds / 3600).toFixed(2)),
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
          <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
            labelFormatter={(d) => d}
            formatter={(v) => [`${v}h`, "Horas"]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="hours"
            stroke="#5865F2"
            dot={false}
            strokeWidth={2}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarRanking({ data }: { data: { displayName: string; totalSeconds: number }[] }) {
  if (!data.length) return <div className="h-64 flex items-center justify-center text-zinc-500">Sem dados</div>;
  const pts = data.map((d, i) => ({
    ...d,
    rank: i + 1,
    hours: Number((d.totalSeconds / 3600).toFixed(2)),
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pts} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis type="number" stroke="#71717a" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="displayName" stroke="#71717a" tick={{ fontSize: 10 }} width={120} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
            formatter={(v) => [`${v}h`, "Horas"]}
          />
          <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
            {pts.map((_, i) => (
              <Cell key={`cell-${i}`} fill="#5865F2" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Heatmap({ data }: { data: number[][] }) {
  if (!data.length) return <div className="h-64 flex items-center justify-center text-zinc-500">Sem dados</div>;
  const max = Math.max(...data.flat());
  const cells: { day: number; hour: number; value: number }[] = [];
  data.forEach((row, day) => {
    row.forEach((val, hour) => {
      if (val > 0) cells.push({ day, hour, value: val });
    });
  });
  return (
    <div className="h-64 overflow-x-auto">
      <table className="w-full text-center text-xs">
        <thead>
          <tr>
            <th className="w-16 py-1 text-zinc-500">Dom</th>
            <th className="w-16 py-1 text-zinc-500">Seg</th>
            <th className="w-16 py-1 text-zinc-500">Ter</th>
            <th className="w-16 py-1 text-zinc-500">Qua</th>
            <th className="w-16 py-1 text-zinc-500">Qui</th>
            <th className="w-16 py-1 text-zinc-500">Sex</th>
            <th className="w-16 py-1 text-zinc-500">Sáb</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 24 }).map((_, hour) => (
            <tr key={hour}>
              {Array.from({ length: 7 }).map((_, day) => {
                const cell = cells.find((c) => c.day === day && c.hour === hour);
                const intensity = cell ? cell.value / max : 0;
                return (
                  <td
                    key={day}
                    className="w-16 h-8 border border-zinc-800"
                    style={{
                      backgroundColor:
                        intensity > 0 ? `rgba(88, 101, 242, ${0.2 + intensity * 0.8})` : "transparent",
                    }}
                    title={`${cell?.value ?? 0} inícios às ${hour}h`}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}