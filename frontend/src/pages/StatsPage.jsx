import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Activity, ArrowLeft, BadgePercent, CalendarDays, Crown, Download, Eye, Power, Radio, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const RANGES = [7, 28, 90, 365];
const PROMOTION_DISCOUNTS = [1, 5, 10, 20, 25, 30, 50];

function compactNumber(value = 0) {
  return new Intl.NumberFormat(undefined, { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function formatMoney(cents = 0, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100);
}

function AnimatedNumber({ value = 0 }) {
  const nextValue = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(nextValue);
  const displayRef = useRef(nextValue);

  useEffect(() => {
    const from = displayRef.current;
    const to = nextValue;

    if (from === to) {
      setDisplayValue(to);
      return undefined;
    }

    const duration = 750;
    const startedAt = performance.now();
    let frameId;

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);

      displayRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        displayRef.current = to;
        setDisplayValue(to);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [nextValue]);

  return <>{compactNumber(displayValue)}</>;
}

function formatDate(value, includeYear = false) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultDateTimeLocal(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return formatLocalDateTimeValue(date);
}

function formatLocalDateTimeValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-") + `T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localDateTimeToIso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
}

function formatDateTimeLocalLabel(value) {
  if (!value) return "Choose date";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function sameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function dateTimeParts(value) {
  const fallback = new Date();
  const date = new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : fallback;
  return {
    date: safeDate,
    time: `${String(safeDate.getHours()).padStart(2, "0")}:${String(safeDate.getMinutes()).padStart(2, "0")}`,
  };
}

function toLocalDateTimeValue(date, time) {
  const [hours = "0", minutes = "0"] = String(time || "00:00").split(":");
  const next = new Date(date);
  next.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return formatLocalDateTimeValue(next);
}

function PromoDatePicker({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const { date, time } = dateTimeParts(value);
  const [viewDate, setViewDate] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthDays = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: monthDays }, (_, index) => new Date(viewDate.getFullYear(), viewDate.getMonth(), index + 1)),
  ];

  useEffect(() => {
    const next = new Date(value);
    if (Number.isFinite(next.getTime())) {
      setViewDate(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }, [value]);

  return (
    <div className="relative">
      <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm text-white outline-none transition hover:border-purple-300/35 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-400/20"
      >
        <span className="flex items-center justify-between gap-3">
          <span>{formatDateTimeLocalLabel(value)}</span>
          <CalendarDays className="w-4 h-4 text-purple-200" />
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(21rem,calc(100vw-3rem))] rounded-2xl border border-purple-300/20 bg-[#0d0b14]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
            >
              ‹
            </button>
            <p className="font-semibold text-white">{monthLabel}</p>
            <button
              type="button"
              onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
            >
              ›
            </button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              const selected = day && sameCalendarDay(day, date);
              return day ? (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => onChange(toLocalDateTimeValue(day, time))}
                  className={`aspect-square rounded-xl text-sm font-semibold transition ${
                    selected
                      ? "bg-neon text-white shadow-[0_0_24px_rgba(82,87,255,0.35)]"
                      : "bg-white/[0.035] text-zinc-300 hover:bg-purple-400/15 hover:text-white"
                  }`}
                >
                  {day.getDate()}
                </button>
              ) : (
                <span key={`blank-${index}`} />
              );
            })}
          </div>
          <label className="mt-4 block">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Time</span>
            <input
              type="time"
              value={time}
              onChange={(event) => onChange(toLocalDateTimeValue(date, event.target.value))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-purple-300/50"
            />
          </label>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-white/10"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, note, tone = "blue", sideValue, sideLabel }) {
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
      <p className="font-display text-3xl font-black mt-4 text-white">
        <AnimatedNumber value={value} />
      </p>
      {sideValue && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="font-display text-lg font-black text-white leading-none">{sideValue}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">{sideLabel}</p>
        </div>
      )}
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
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoForm, setPromoForm] = useState({
    name: "Premium sale",
    percent_off: "10",
    starts_at: defaultDateTimeLocal(0),
    ends_at: defaultDateTimeLocal(7),
    duration: "once",
  });
  const canView = ["Admin", "Uploader"].includes(user?.role);

  const load = useCallback(async (selectedRange = range, options = {}) => {
    if (!canView) return;
    const silent = options.silent === true;
    if (!silent) setBusy(true);
    if (!silent) setError("");
    try {
      const { data: next } = await api.get(`/moderator/stats?days=${selectedRange}`);
      setData(next);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not load site statistics.");
    } finally {
      if (!silent) setBusy(false);
    }
  }, [canView, range]);

  useEffect(() => {
    if (loading || !canView) return undefined;

    load(range);
    const intervalId = setInterval(() => load(range, { silent: true }), 15000);

    return () => clearInterval(intervalId);
  }, [loading, canView, range, load]);

  const traffic = useMemo(
    () =>
      (data?.traffic || []).map((point) => ({
        ...point,
        label: formatDate(point.date),
        tooltipLabel: formatDate(point.date, range >= 90),
      })),
    [data, range],
  );

  const createPromotion = async (event) => {
    event.preventDefault();
    setPromoBusy(true);
    setError("");
    try {
      await api.post("/moderator/premium-promotions", {
        ...promoForm,
        percent_off: Number(promoForm.percent_off),
        starts_at: localDateTimeToIso(promoForm.starts_at),
        ends_at: localDateTimeToIso(promoForm.ends_at),
      });
      await load(range, { silent: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not create Premium promotion.");
    } finally {
      setPromoBusy(false);
    }
  };

  const disablePromotion = async (promotionId) => {
    setPromoBusy(true);
    setError("");
    try {
      await api.post(`/moderator/premium-promotions/${promotionId}/disable`);
      await load(range, { silent: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not disable Premium promotion.");
    } finally {
      setPromoBusy(false);
    }
  };

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
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
              </span>
              Live updates
            </div>
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
          <StatCard
            icon={Crown}
            label="Premium users"
            value={data?.summary?.premium_users || 0}
            note={`${data?.summary?.premium_active_users || 0} paid active · ${data?.summary?.premium_trialing_users || 0} trialing${data?.summary?.manual_premium_users ? ` · ${data.summary.manual_premium_users} manual` : ""}`}
            tone="amber"
            sideValue={`${formatMoney(data?.summary?.premium_monthly_revenue_cents || 0, data?.summary?.premium_monthly_revenue_currency)}/mo`}
            sideLabel="Stripe revenue"
          />
          <StatCard icon={Download} label="Downloads" value={data?.summary?.total_downloads || 0} note="All-time asset total" tone="green" />
        </div>

        <div className="mb-6 rounded-3xl border border-purple-300/15 bg-[var(--site-panel)] p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-300/10 px-3 py-1 text-xs font-semibold text-purple-200 mb-3">
                <BadgePercent className="w-3.5 h-3.5" /> Premium promotions
              </div>
              <h2 className="font-display text-2xl font-black">Run a Premium sale</h2>
              <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
                Set a date range and discount percentage. While it is active, the Premium page and Stripe Checkout apply it automatically to new subscriptions.
              </p>
            </div>
            {data?.active_premium_promotion ? (
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                <p className="font-semibold text-white">Active: {data.active_premium_promotion.name}</p>
                <p>{data.active_premium_promotion.percent_off}% off until {formatDateTime(data.active_premium_promotion.ends_at)}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                No Premium sale is active right now.
              </div>
            )}
          </div>

          <form onSubmit={createPromotion} className="grid md:grid-cols-2 xl:grid-cols-5 gap-3">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Name</span>
              <input
                value={promoForm.name}
                onChange={(event) => setPromoForm((form) => ({ ...form, name: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-purple-300/50"
                placeholder="Premium sale"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Discount %</span>
              <select
                value={promoForm.percent_off}
                onChange={(event) => setPromoForm((form) => ({ ...form, percent_off: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-purple-300/50"
              >
                {PROMOTION_DISCOUNTS.map((discount) => (
                  <option key={discount} className="bg-[#111018] text-white" value={String(discount)}>
                    {discount}% off
                  </option>
                ))}
              </select>
            </label>
            <PromoDatePicker
              label="Starts"
              value={promoForm.starts_at}
              onChange={(value) => setPromoForm((form) => ({ ...form, starts_at: value }))}
            />
            <PromoDatePicker
              label="Ends"
              value={promoForm.ends_at}
              onChange={(value) => setPromoForm((form) => ({ ...form, ends_at: value }))}
            />
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Applies</span>
              <select
                value={promoForm.duration}
                onChange={(event) => setPromoForm((form) => ({ ...form, duration: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-purple-300/50"
              >
                <option className="bg-[#111018] text-white" value="once">First month only</option>
                <option className="bg-[#111018] text-white" value="forever">Forever on that subscription</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={promoBusy}
              className="md:col-span-2 xl:col-span-5 rounded-xl bg-neon hover:bg-neon/90 disabled:bg-white/10 disabled:text-zinc-500 text-white font-bold py-3 btn-press"
            >
              {promoBusy ? "Saving promotion..." : "Create Premium promotion"}
            </button>
          </form>

          {(data?.premium_promotions || []).length > 0 && (
            <div className="mt-5 overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <tr className="border-b border-white/10">
                    <th className="w-[22%] py-3 pr-4">Promotion</th>
                    <th className="w-[12%] py-3 px-3">Discount</th>
                    <th className="w-[34%] py-3 px-3">Dates</th>
                    <th className="w-[14%] py-3 px-3">Type</th>
                    <th className="w-[18%] py-3 pl-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.premium_promotions || []).map((promo) => {
                    const isActive = data?.active_premium_promotion?.id === promo.id;
                    return (
                      <tr key={promo.id} className="border-b border-white/5">
                        <td className="py-3 pr-4 font-semibold text-white break-words">{promo.name}</td>
                        <td className="py-3 px-3 text-zinc-300">{promo.percent_off}%</td>
                        <td className="py-3 px-3 text-zinc-400">
                          <span className="flex min-w-0 items-center gap-2 leading-relaxed">
                            <CalendarDays className="w-4 h-4 flex-shrink-0 text-zinc-500" />
                            <span className="min-w-0 break-words">
                              {formatDateTime(promo.starts_at)} → {formatDateTime(promo.ends_at)}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-400">{promo.duration === "forever" ? "Forever" : "First month"}</td>
                        <td className="py-3 pl-3 text-right">
                          {promo.enabled ? (
                            <button
                              type="button"
                              onClick={() => disablePromotion(promo.id)}
                              disabled={promoBusy}
                              className={`inline-flex max-w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold btn-press ${
                                isActive
                                  ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/10"
                              }`}
                            >
                              <Power className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{isActive ? "Active · Disable" : "Scheduled · Disable"}</span>
                            </button>
                          ) : (
                            <span className="text-zinc-500">Disabled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.tooltipLabel || label}
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
