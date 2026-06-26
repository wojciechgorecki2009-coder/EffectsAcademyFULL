import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  CATEGORIES,
  CATEGORY_COLORS,
  AUDIO_CREATORS,
  CREATOR_THEMES,
  SHOWS,
  SHOW_THEMES,
  SHOW_IMAGES,
} from "@/lib/api";
import AssetCard from "@/components/AssetCard";
import CategoryPicker from "@/components/CategoryPicker";
import Hero from "@/components/Hero";
import { ChevronLeft, ChevronRight, Music2, Tv, Film, Sparkles } from "lucide-react";

const FILTER_TABS = ["All", ...CATEGORIES];

const CATEGORY_TO_SLUG = {
  Torrents: "torrents",
  "Project Files": "project-files",
  Overlays: "overlays",
  Audios: "audios",
  "Sound FX": "sound-fx",
  Presets: "presets",
  Premium: "premium",
};

const DASHBOARD_SECTIONS = [
  "Audios",
  "Presets",
  "Project Files",
  "Overlays",
  "Sound FX",
  "Torrents",
];

const getStamp = (asset) => new Date(asset.created_at || asset.createdAt || 0).getTime() || 0;

export default function Home() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [sub, setSub] = useState(null);
  const [torrentBranch, setTorrentBranch] = useState(null);
  const [overrides, setOverrides] = useState({ creator: {}, show: {} });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/assets");
      setAssets(data);
    } finally {
      setLoading(false);
    }
  };

  const loadOverrides = async () => {
    try {
      const { data } = await api.get("/category-overrides");
      const grouped = { creator: {}, show: {} };
      for (const o of data) if (grouped[o.kind]) grouped[o.kind][o.name] = o;
      setOverrides(grouped);
    } catch {}
  };

  useEffect(() => {
    load();
    loadOverrides();
  }, []);

  useEffect(() => {
    setSub(null);
    setTorrentBranch(null);
  }, [filter]);

  const showsPickerForFilter = filter === "Audios" || filter === "Torrents";

  const sortedAssets = useMemo(() => [...assets].sort((a, b) => getStamp(b) - getStamp(a)), [assets]);
  const recentlyAdded = useMemo(() => sortedAssets.slice(0, 8), [sortedAssets]);

  const mergedAudioCreators = useMemo(() => {
    const customs = Array.from(
      new Set(
        assets
          .filter((a) => a.category === "Audios" && a.creator_tag)
          .map((a) => a.creator_tag)
      )
    );
    return [...AUDIO_CREATORS, ...customs.filter((c) => !AUDIO_CREATORS.includes(c))];
  }, [assets]);

  const mergedShows = useMemo(() => {
    const customs = Array.from(
      new Set(
        assets
          .filter(
            (a) =>
              a.category === "Torrents" &&
              a.show_group &&
              (a.torrent_type || "Show") === "Show"
          )
          .map((a) => a.show_group)
      )
    );
    return [...SHOWS, ...customs.filter((s) => !SHOWS.includes(s))];
  }, [assets]);

  const dashboardData = useMemo(() => {
    const byCat = {};
    for (const cat of DASHBOARD_SECTIONS) {
      byCat[cat] = sortedAssets
        .filter((a) => a.category === cat)
        .slice(0, 4);
    }
    return byCat;
  }, [sortedAssets]);

  const filteredForFilter = useMemo(() => {
    let list = sortedAssets;
    if (filter !== "All") list = list.filter((a) => a.category === filter);
    if (filter === "Audios" && sub) list = list.filter((a) => a.creator_tag === sub);
    if (filter === "Torrents" && torrentBranch === "Shows") {
      list = list.filter((a) => (a.torrent_type || "Show") === "Show");
      if (sub) list = list.filter((a) => a.show_group === sub);
    }
    if (filter === "Torrents" && torrentBranch === "Movies") {
      list = list.filter((a) => a.torrent_type === "Movie");
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.description || "").toLowerCase().includes(q) ||
          (a.creator_tag || "").toLowerCase().includes(q) ||
          (a.genre || a.bpm || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [sortedAssets, filter, sub, torrentBranch, query]);

  const searchedAll = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return sortedAssets.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (a.creator_tag || "").toLowerCase().includes(q) ||
        (a.genre || a.bpm || "").toLowerCase().includes(q)
    );
  }, [sortedAssets, query]);

  const isAllTab = filter === "All";

  return (
    <>
      <Hero query={query} setQuery={setQuery} totalAssets={assets.length} />

      <section className="max-w-[1400px] mx-auto px-6 md:px-12 pb-24 page-soft-enter" data-testid="asset-section">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 mt-6">
          <div className="flex flex-wrap gap-2" data-testid="filter-tabs">
            {FILTER_TABS.map((t) => {
              const active = filter === t;
              const c = CATEGORY_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border btn-press transition-all ${
                    active
                      ? "bg-white/15 border-white/20 text-white"
                      : "bg-white/[0.03] border-white/5 text-zinc-400 hover:text-white"
                  }`}
                  style={
                    active && c
                      ? { color: c.text, background: c.bg, borderColor: c.border }
                      : {}
                  }
                  data-testid={`filter-tab-${t.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">
            {isAllTab
              ? `${assets.length} total`
              : showsPickerForFilter && !sub
                ? `${assets.filter((a) => a.category === filter).length} items`
                : `${filteredForFilter.length} assets`}
          </p>
        </div>

        {loading ? (
          <AssetSkeletonGrid />
        ) : isAllTab ? (
          searchedAll && searchedAll.length >= 0 && query.trim() ? (
            searchedAll.length === 0 ? (
              <EmptyState filter={filter} />
            ) : (
              <AssetGrid assets={searchedAll} onChanged={load} allAssets={assets} />
            )
          ) : (
            <DashboardView data={dashboardData} totalAssets={assets.length} recentlyAdded={recentlyAdded} allAssets={assets} onChanged={load} />
          )
        ) : (
          <FilteredView
            filter={filter}
            sub={sub}
            setSub={setSub}
            torrentBranch={torrentBranch}
            setTorrentBranch={setTorrentBranch}
            mergedAudioCreators={mergedAudioCreators}
            mergedShows={mergedShows}
            overrides={overrides}
            loadOverrides={loadOverrides}
            assets={assets}
            filtered={filteredForFilter}
            load={load}
          />
        )}
      </section>
    </>
  );
}

function DashboardView({ data, totalAssets, recentlyAdded, allAssets, onChanged }) {
  if (totalAssets === 0) return <EmptyState filter="All" />;
  return (
    <div className="space-y-14">
      <RecentlyAdded assets={recentlyAdded} allAssets={allAssets} onChanged={onChanged} />
      {DASHBOARD_SECTIONS.map((cat) => (
        <DashboardSection
          key={cat}
          category={cat}
          assets={data[cat] || []}
          allAssets={allAssets}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function RecentlyAdded({ assets, allAssets, onChanged }) {
  return (
    <div data-testid="recently-added-section" className="relative rounded-3xl border border-white/10 bg-white/[0.025] p-5 md:p-6 overflow-hidden">
      <div className="absolute -top-24 right-0 w-64 h-64 bg-neon/10 blur-3xl rounded-full pointer-events-none" />
      <div className="relative flex items-end justify-between mb-5 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-md border text-neon bg-neon/10 border-neon/20">
            Fresh
          </span>
          <h2 className="font-display text-2xl md:text-3xl font-black tracking-tighter flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-neon" /> Recently Added
          </h2>
        </div>
      </div>
      <AssetGrid assets={assets} onChanged={onChanged} allAssets={allAssets} />
    </div>
  );
}

function DashboardSection({ category, assets, allAssets, onChanged }) {
  const c = CATEGORY_COLORS[category];
  const slug = CATEGORY_TO_SLUG[category];
  return (
    <div data-testid={`section-${slug}`}>
      <div className="flex items-end justify-between mb-5 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-md border"
            style={{ color: c.text, background: c.bg, borderColor: c.border }}
          >
            {category}
          </span>
          <h2 className="font-display text-2xl md:text-3xl font-black tracking-tighter">
            Latest {category}
          </h2>
        </div>
        <Link
          to={`/category/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white btn-press"
          data-testid={`view-all-${slug}`}
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      {assets.length === 0 ? (
        <p className="text-sm text-zinc-500 italic py-6">
          No {category.toLowerCase()} yet — moderators can drop them via the Upload modal.
        </p>
      ) : (
        <AssetGrid assets={assets} onChanged={onChanged} allAssets={allAssets} />
      )}
    </div>
  );
}

function AssetGrid({ assets, onChanged, allAssets }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {assets.map((a, idx) => (
        <div key={a.id} className="asset-3d-in" style={{ animationDelay: `${Math.min(idx, 12) * 60}ms` }}>
          <AssetCard asset={a} onChanged={onChanged} allAssets={allAssets || assets} />
        </div>
      ))}
    </div>
  );
}

function FilteredView({
  filter, sub, setSub, torrentBranch, setTorrentBranch, mergedAudioCreators, mergedShows, overrides, loadOverrides, assets, filtered, load,
}) {
  if (filter === "Torrents" && !torrentBranch) {
    const showCount = assets.filter(
      (a) => a.category === "Torrents" && (a.torrent_type || "Show") === "Show"
    ).length;
    const movieCount = assets.filter(
      (a) => a.category === "Torrents" && a.torrent_type === "Movie"
    ).length;
    return (
      <>
        <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
          <Tv className="w-5 h-5 text-neon" /> Shows or Movies?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12" data-testid="home-torrent-branch-grid">
          <TorrentBranchCard
            label="Shows"
            count={showCount}
            icon={<Tv className="w-7 h-7" />}
            from="#0E2A5C"
            to="#040E26"
            accent="#3B82F6"
            onClick={() => setTorrentBranch("Shows")}
            testId="home-torrent-branch-shows"
          />
          <TorrentBranchCard
            label="Movies"
            count={movieCount}
            icon={<Film className="w-7 h-7" />}
            from="#3A0C18"
            to="#0A0204"
            accent="#EF4444"
            onClick={() => setTorrentBranch("Movies")}
            testId="home-torrent-branch-movies"
          />
        </div>
      </>
    );
  }

  const showsPicker = filter === "Audios" || (filter === "Torrents" && torrentBranch === "Shows");
  if (showsPicker && !sub) {
    return (
      <>
        {filter === "Torrents" && (
          <button
            onClick={() => setTorrentBranch(null)}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6 btn-press"
            data-testid="home-back-to-torrent-branch"
          >
            <ChevronLeft className="w-4 h-4" /> Torrents
          </button>
        )}
        <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
          {filter === "Audios" ? (
            <><Music2 className="w-5 h-5 text-neon" /> Choose an Audio Pack</>
          ) : (
            <><Tv className="w-5 h-5 text-neon" /> Choose a Show</>
          )}
        </h2>
        <CategoryPicker
          items={filter === "Audios" ? mergedAudioCreators : mergedShows}
          themes={filter === "Audios" ? CREATOR_THEMES : SHOW_THEMES}
          images={filter === "Audios" ? {} : SHOW_IMAGES}
          overrides={filter === "Audios" ? overrides.creator : overrides.show}
          kind={filter === "Audios" ? "creator" : "show"}
          onChanged={loadOverrides}
          getCount={(label) =>
            assets.filter(
              (a) =>
                a.category === filter &&
                (filter === "Audios" ? a.creator_tag === label : a.show_group === label)
            ).length
          }
          onPick={setSub}
          testIdPrefix={filter === "Audios" ? "home-creator" : "home-show"}
        />
      </>
    );
  }
  return (
    <>
      {filter === "Torrents" && torrentBranch === "Movies" && (
        <button
          onClick={() => setTorrentBranch(null)}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6 btn-press"
          data-testid="home-back-to-torrent-branch"
        >
          <ChevronLeft className="w-4 h-4" /> Torrents
        </button>
      )}
      {showsPicker && sub && (
        <button
          onClick={() => setSub(null)}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6 btn-press"
          data-testid="back-to-picker"
        >
          <ChevronLeft className="w-4 h-4" /> All {filter === "Audios" ? "creators" : "shows"}
        </button>
      )}
      {filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <AssetGrid assets={filtered} onChanged={load} allAssets={assets} />
      )}
    </>
  );
}

function TorrentBranchCard({ label, count, icon, from, to, accent, onClick, testId }) {
  return (
    <button
      onClick={onClick}
      className="asset-3d-in relative h-44 rounded-2xl p-7 text-left btn-press overflow-hidden border border-white/5 hover:border-white/20 transition-colors group"
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      data-testid={testId}
    >
      <div
        className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 text-white">
            {icon}
            <span className="font-display text-3xl font-black tracking-tight">{label}</span>
          </div>
          <p className="mt-2 text-sm text-white/60">
            {count} item{count === 1 ? "" : "s"}
          </p>
        </div>
        <span className="text-xs uppercase tracking-widest text-white/70 group-hover:text-white">
          Open →
        </span>
      </div>
    </button>
  );
}

function AssetSkeletonGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div key={idx} className="rounded-2xl overflow-hidden border border-white/5 bg-[var(--site-surface)] animate-pulse">
          <div className="aspect-video bg-white/5" />
          <div className="p-5 space-y-3">
            <div className="h-5 w-20 rounded bg-white/5" />
            <div className="h-6 w-3/4 rounded bg-white/5" />
            <div className="h-4 w-full rounded bg-white/5" />
            <div className="h-10 w-full rounded-lg bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filter }) {
  return (
    <div
      className="relative overflow-hidden text-center py-24 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]"
      data-testid="empty-state"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/50 to-transparent" />
      <Sparkles className="w-8 h-8 text-neon mx-auto mb-4 opacity-80" />
      <h3 className="font-display text-2xl mb-2">No assets yet</h3>
      <p className="text-zinc-500 max-w-md mx-auto mb-6">
        {filter === "All"
          ? "The vault is empty. Moderators can unlock upload access and start dropping packs."
          : `Nothing under "${filter}" yet. Try another category or check back soon.`}
      </p>
      <Link
        to="/category/torrents"
        className="inline-block text-neon text-sm font-mono uppercase tracking-widest border-b border-neon/40 hover:border-neon"
      >
        Browse categories →
      </Link>
    </div>
  );
}
