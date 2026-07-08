import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, ArrowLeft, Crown, Download, Eye, Radio, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const RANGES = [7, 28, 90, 365];

function compactNumber(value = 0) {
  return new Intl.NumberFormat(undefined, { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function shortDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatCard({ icon: Icon, label, value, note, tone = "blue" }) {
  const tones = {
    blue: "from-blue-500/20 to-indigo-500/5 border-blue-300/15 text-blue-200",
    green: "from-emerald-500/20 to-teal-500/5 border-emerald-300/15 text-emerald-200",
    purple: "from-purple-500/20 to-fuchsia-500/5 border-purple-300/15 text-purple-200",
    amber: "from-amber-500/20 to-yellow-500/5 border-amber-300/15 text-amber-200",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-5`}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">{label}</p>
        <span className="w-10 h-10 rounded-xl bg-white/7 border border-white/10 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </span>
      </div>
      <p className="font-display text-3xl font-black mt-4 text-white">{compactNumber(value)}</p>
      {note && <p className="text-xs text-zinc-500 mt-1">{note}</p>}
    </div>
  );
}

function ChartShell({ title, children, right }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[var(--site-panel)] p-5 md:p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function StatsPage() {
  const { user, loading } = useAuth();
  const [range, setRange] = useState(7);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const canView = ["Admin", "Uploader"].includes(user?.role);

  const load = async (selectedRange = range) => {
    if (!canView) return;
    setBusy(true);
    setError("");
    try {
      const { data: next } = await api.get(`/moderator/stats?days=${selectedRange}`);
      setData(next);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not load site statistics.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!loading && canView) load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, canView, range]);

  const traffic = useMemo(
    () => (data?.traffic || []).map((point) => ({ ...point, label: shortDate(point.date) })),
    [data],
  );

  if (loading) {
    return <section className="min-h-screen pt-28 px-6 text-center text-zinc-500">Loading stats...</section>;
  }

  if (!canView) {
    return (
      <section className="min-h-screen pt-28 px-6">
        <div className="max-w-xl mx-auto rounded-3xl border border-white/10 bg-[var(--site-panel)] p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-zinc-500 mx-auto mb-4" />
          <h1 className="font-display text-3xl font-black">Moderator stats only</h1>
          <p className="text-zinc-400 mt-3">Sign in with an uploader or admin account to view site performance.</p>
          <Link to="/" className="inline-flex mt-6 rounded-xl bg-neon px-5 py-3 font-bold text-white btn-press">
            Back to browse
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen pt-28 pb-20 px-6" data-testid="stats-page">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-5">
              <ArrowLeft className="w-4 h-4" /> Back to browse
            </Link>
            <p className="text-xs uppercase tracking-[0.34em] text-neon font-mono mb-2">Moderator dashboard</p>
            <h1 className="font-display text-4xl md:text-6xl font-black tracking-tighter">Site statistics</h1>
            <p className="text-zinc-400 mt-3 max-w-2xl">
              Track visitor activity, downloads, online users, and active Premium members in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map((days) => (
              <button
                key={days}
                onClick={() => setRange(days)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold border btn-press ${
                  range === days
                    ? "bg-neon text-white border-neon"
                    : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {days} days
              </button>
            ))}
            <button
              onClick={() => load(range)}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 btn-press disabled:opacity-50 inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-red-200">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          <StatCard icon={Eye} label="Visitors" value={data?.summary?.unique_visitors || 0} note={`Last ${range} days`} />
          <StatCard icon={Activity} label="Page views" value={data?.summary?.page_views || 0} note={`Last ${range} days`} tone="green" />
          <StatCard icon={Radio} label="Online now" value={data?.summary?.online_now || 0} note="Active in 5 minutes" tone="purple" />
          <StatCard icon={Crown} label="Premium users" value={data?.summary?.premium_users || 0} note="Active or trialing" tone="amber" />
          <StatCard icon={Download} label="Downloads" value={data?.summary?.total_downloads || 0} note="All-time asset total" tone="green" />
        </div>

        <div className="grid xl:grid-cols-[1.4fr_.9fr] gap-6">
          <ChartShell title={`Visitors over the last ${range} days`}>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={traffic}>
                  <defs>
                    <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5257ff" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#5257ff" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" stroke="#71717a" tickLine={false} axisLine={false} minTickGap={22} />
                  <YAxis stroke="#71717a" tickLine={false} axisLine={false} allowDecimals={false} width={34} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,16,0.96)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 14,
                      color: "white",
                    }}
                  />
                  <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#6d72ff" fill="url(#visitorsFill)" strokeWidth={3} />
                  <Area type="monotone" dataKey="page_views" name="Page views" stroke="#22d3ee" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartShell>

          <ChartShell title="Top downloaded assets">
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(data?.top_assets || []).slice(0, 8)} layout="vertical" margin={{ left: 16, right: 12 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" stroke="#71717a" tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="title"
                    stroke="#a1a1aa"
                    tickLine={false}
                    axisLine={false}
                    width={130}
                    tickFormatter={(value) => (value?.length > 18 ? `${value.slice(0, 18)}...` : value)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,16,0.96)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 14,
                      color: "white",
                    }}
                  />
                  <Bar dataKey="download_count" name="Downloads" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartShell>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-[var(--site-panel)] overflow-hidden">
          <div className="px-5 md:px-6 py-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Asset download performance</h2>
            <p className="text-xs text-zinc-500">Sorted by total downloads</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                <tr className="border-b border-white/10">
                  <th className="px-5 md:px-6 py-4">Asset</th>
                  <th className="px-5 md:px-6 py-4">Category</th>
                  <th className="px-5 md:px-6 py-4">Creator</th>
                  <th className="px-5 md:px-6 py-4 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {(data?.top_assets || []).map((asset) => (
                  <tr key={asset.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-5 md:px-6 py-4 font-semibold text-white">{asset.title}</td>
                    <td className="px-5 md:px-6 py-4 text-zinc-400">{asset.category || "—"}</td>
                    <td className="px-5 md:px-6 py-4 text-zinc-400">{asset.creator_tag || "—"}</td>
                    <td className="px-5 md:px-6 py-4 text-right font-mono text-zinc-200">{compactNumber(asset.download_count || 0)}</td>
                  </tr>
                ))}
                {!busy && (data?.top_assets || []).length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-zinc-500">
                      No download data yet. Once people start downloading assets, performance will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
