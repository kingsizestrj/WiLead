"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#d946ef", "#fb923c", "#8b5cf6", "#38bdf8", "#34d399", "#f43f5e", "#facc15", "#2dd4bf"];
const axis = { stroke: "rgb(var(--ink-400))", fontSize: 12, tickLine: false, axisLine: false };
const tooltip = {
  contentStyle: { background: "rgb(var(--ink-900))", border: "1px solid rgb(var(--c-white) / .08)", borderRadius: 12, color: "rgb(var(--c-white))" },
  labelStyle: { color: "rgb(var(--ink-300))" },
};

export function DailyChart({ data, series }: { data: Record<string, string | number>[]; series: string[] }) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-ink-300">
        {series.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /> {s}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.45} />
                <stop offset="1" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-white) / .06)" vertical={false} />
          <XAxis dataKey="day" {...axis} />
          <YAxis allowDecimals={false} {...axis} width={32} />
          <Tooltip {...tooltip} />
          {series.map((s, i) => (
            <Area key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} fill={`url(#g${i})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}

export function HourChart({ data }: { data: { hour: string; acessos: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <defs>
          <linearGradient id="bars" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#db2777" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-white) / .06)" vertical={false} />
        <XAxis dataKey="hour" {...axis} interval={1} />
        <YAxis allowDecimals={false} {...axis} width={32} />
        <Tooltip {...tooltip} cursor={{ fill: "rgb(var(--c-white) / .04)" }} />
        <Bar dataKey="acessos" fill="url(#bars)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
