import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  api,
  AUDIO_CREATORS,
  CREATOR_THEMES,
  SHOWS,
  SHOW_THEMES,
  SHOW_IMAGES,
  CATEGORY_COLORS,
} from "@/lib/api";
import AssetCard from "@/components/AssetCard";
import CategoryPicker from "@/components/CategoryPicker";
import { ChevronLeft, Music2, Tv, Film, Search, Tags, SlidersHorizontal, Sparkles } from "lucide-react";

const SLUG_TO_CATEGORY = {
  "torrents": "Torrents",
  "project-files": "Project Files",
  "overlays": "Overlays",
  "audios": "Audios",
  "sound-fx": "Sound FX",
  "presets": "Presets",
  "premium": "Premium",
};

const DESCRIPTIONS = {
  Torrents: "Complete season torrents and movies — clean, organized.",
  "Project Files": "After Effects PJFs. Drag, drop, customize.",
  Overlays: "Effects, particles, transitions. Linear color key ready.",
  Audios: "Tracks curated by the community's top audio creators.",
  "Sound FX": "Whooshes, impacts, risers, foley. Built for cuts.",
  Presets: "Plug-and-play presets for AE & beyond.",
  Premium: "Premium drops, exclusive packs.",
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "downloads", label: "Most downloaded" },
  { value: "az", label: "A-Z" },
];

const getGenre = (asset) => (asset.genre || (asset.category === "Audios" ? asset.bpm : "") || "").trim();
const getStamp = (asset) => new Date(asset.created_at || asset.createdAt || 0).getTime() || 0;
const sortAssets = (list, sortBy) => [...list].sort((a, b) => {
  if (sortBy === "downloads") return (b.download_count || 0) - (a.download_count || 0);
  if (sortBy === "az") return (a.title || "").localeCompare(b.title || "");
  return getStamp(b) - getStamp(a);
});

export default function CategoryPage() {
  const { slug } = useParams();
  const category = SLUG_TO_CATEGORY[slug];
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);          // creator OR show name
  const [torrentBranch, setTorrentBranch] = useState(null); // "Shows" | "Movies" | null
  const [genreQuery, setGenreQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [overrides, setOverrides] = useState({ creator: {}, show: {} });
  const c = CATEGORY_COLORS[category];

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/assets", { params: { category } });
      setAssets(data);
    } finally {
      setLoading(false);
    }
  };

  const loadOverrides = async () => {
    try {
      const { data } = await api.get("/category-overrides");
      const grouped = { creator: {}, show: {} };
      for (const o of data) {
        if (grouped[o.kind]) grouped[o.kind][o.name] = o;
      }
      setOverrides(grouped);
    } catch {}
  };

  useEffect(() => {
    if (category) {
      setSub(null);
      setTorrentBranch(null);
      setGenreQuery("");
      setSortBy("newest");
      load();
      loadOverrides();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const genreFilteredAssets = useMemo(() => {
    const q = genreQuery.trim().toLowerCase();
    const list = !q ? assets : assets.filter((a) => {
      const genre = getGenre(a).toLowerCase();
      return genre.includes(q) || a.title?.toLowerCase().includes(q) || a.creator_tag?.toLowerCase().includes(q);
    });
    return sortAssets(list, sortBy);
  }, [assets, genreQuery, sortBy]);

  const sortedAssets = useMemo(() => sortAssets(assets, sortBy), [assets, sortBy]);

  const availableGenres = useMemo(() => {
    return Array.from(new Set(assets.map(getGenre).filter(Boolean))).slice(0, 12);
  }, [assets]);

  const filteredAudios = useMemo(
    () => (sub ? genreFilteredAssets.filter((a) => a.creator_tag === sub) : []),
    [genreFilteredAssets, sub]
  );
  const filteredShowAssets = useMemo(
    () => (sub ? sortedAssets.filter((a) => a.show_group === sub) : []),
    [sortedAssets, sub]
  );
  const movieAssets = useMemo(
    () => sortedAssets.filter((a) => a.torrent_type === "Movie"),
    [sortedAssets]
  );
  const showAssets = useMemo(
    () => sortedAssets.filter((a) => (a.torrent_type || "Show") === "Show"),
    [sortedAssets]
  );

  const mergedCreators = useMemo(() => {
    const customs = Array.from(
      new Set(genreFilteredAssets.filter((a) => a.creator_tag).map((a) => a.creator_tag))
    );
    return [...AUDIO_CREATORS, ...customs.filter((c) => !AUDIO_CREATORS.includes(c))];
  }, [genreFilteredAssets]);

  const mergedShows = useMemo(() => {
    const customs = Array.from(
      new Set(showAssets.filter((a) => a.show_group).map((a) => a.show_group))
    );
    return [...SHOWS, ...customs.filter((s) => !SHOWS.includes(s))];
  }, [showAssets]);

  if (!category) {
    return (
      <div className="text-center py-24">
        <h2 className="font-display text-3xl mb-2">Category not found</h2>
        <Link to="/" className="text-neon">Back home</Link>
      </div>
    );
  }

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-12 pt-28 pb-12 page-soft-enter" data-testid={`page-${slug}`}>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6 btn-press"
        data-testid="back-home"
      >
        <ChevronLeft className="w-4 h-4" /> Browse
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <span
            className="text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-md border"
            style={{ color: c.text, background: c.bg, borderColor: c.border }}
          >
            {category}
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mt-3">
            {category}
          </h1>
          <p className="text-zinc-400 max-w-xl mt-2">{DESCRIPTIONS[category]}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SortControl sortBy={sortBy} setSortBy={setSortBy} />
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 sm:text-right">
            {genreFilteredAssets.length} items
          </p>
        </div>
      </div>

      {category === "Audios" && (
        <AudioGenreSearch
          value={genreQuery}
          onChange={setGenreQuery}
          genres={availableGenres}
        />
      )}

      {category === "Audios" && (
        <>
          {genreQuery.trim() && !sub ? (
            <>
              <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Tags className="w-5 h-5 text-neon" /> Genre search results
              </h2>
              <AssetGrid assets={genreFilteredAssets} loading={loading} reload={load} allAssets={assets} category={category} />
            </>
          ) : !sub ? (
            <>
              <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Music2 className="w-5 h-5 text-neon" /> Choose an Audio Pack
              </h2>
              {loading ? <PickerSkeleton /> : (
                <CategoryPicker
                  items={mergedCreators}
                  themes={CREATOR_THEMES}
                  images={{}}
                  overrides={overrides.creator}
                  kind="creator"
                  onChanged={loadOverrides}
                  getCount={(cr) => genreFilteredAssets.filter((a) => a.creator_tag === cr).length}
                  onPick={setSub}
                  testIdPrefix="creator"
                />
              )}
            </>
          ) : (
            <SubList sub={sub} onBack={() => setSub(null)} backLabel="creators" filtered={filteredAudios} loading={loading} reload={load} allAssets={assets} category={category} />
          )}
        </>
      )}

      {category === "Torrents" && (
        <>
          {!torrentBranch && (
            <>
              <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Tv className="w-5 h-5 text-neon" /> Shows or Movies?
              </h2>
              {loading ? <PickerSkeleton /> : (
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12"
                  data-testid="torrent-branch-grid"
                >
                  <BranchCard
                    label="Shows"
                    count={showAssets.length}
                    icon={<Tv className="w-7 h-7" />}
                    from="#0E2A5C"
                    to="#040E26"
                    accent="#3B82F6"
                    onClick={() => setTorrentBranch("Shows")}
                    testId="torrent-branch-shows"
                  />
                  <BranchCard
                    label="Movies"
                    count={movieAssets.length}
                    icon={<Film className="w-7 h-7" />}
                    from="#3A0C18"
                    to="#0A0204"
                    accent="#EF4444"
                    onClick={() => setTorrentBranch("Movies")}
                    testId="torrent-branch-movies"
                  />
                </div>
              )}
            </>
          )}

          {torrentBranch === "Shows" && !sub && (
            <>
              <button
                onClick={() => setTorrentBranch(null)}
                className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6 btn-press"
                data-testid="back-to-branch"
              >
                <ChevronLeft className="w-4 h-4" /> Torrents
              </button>
              <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Tv className="w-5 h-5 text-neon" /> Choose a Show
              </h2>
              {loading ? <PickerSkeleton /> : (
                <CategoryPicker
                  items={mergedShows}
                  themes={SHOW_THEMES}
                  images={SHOW_IMAGES}
                  overrides={overrides.show}
                  kind="show"
                  onChanged={loadOverrides}
                  getCount={(s) => showAssets.filter((a) => a.show_group === s).length}
                  onPick={setSub}
                  testIdPrefix="show"
                />
              )}
            </>
          )}

          {torrentBranch === "Shows" && sub && (
            <SubList
              sub={sub}
              onBack={() => setSub(null)}
              backLabel="shows"
              filtered={filteredShowAssets.filter((a) => (a.torrent_type || "Show") === "Show")}
              loading={loading}
              reload={load}
              allAssets={assets}
              category={category}
            />
          )}

          {torrentBranch === "Movies" && (
            <>
              <button
                onClick={() => setTorrentBranch(null)}
                className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6 btn-press"
                data-testid="back-to-branch"
              >
                <ChevronLeft className="w-4 h-4" /> Torrents
              </button>
              <h2 className="font-display text-2xl font-bold mb-4 flex items-center gap-2">
                <Film className="w-5 h-5 text-neon" /> Movies
              </h2>
              <AssetGrid assets={movieAssets} loading={loading} reload={load} allAssets={assets} category={category} />
            </>
          )}
        </>
      )}

      {category !== "Audios" && category !== "Torrents" && (
        <AssetGrid assets={sortedAssets} loading={loading} reload={load} allAssets={assets} category={category} />
      )}
    </section>
  );
}

function SortControl({ sortBy, setSortBy }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">
      <SlidersHorizontal className="w-4 h-4 text-zinc-500" />
      <span className="text-xs uppercase tracking-widest text-zinc-500">Sort</span>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="bg-transparent text-white outline-none"
        data-testid="category-sort"
      >
        {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-[#090913]">{option.label}</option>)}
      </select>
    </label>
  );
}

function AudioGenreSearch({ value, onChange, genres }) {
  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <label className="text-xs font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-2">
        <Search className="w-4 h-4" /> Search audios by genre
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Try phonk, cinematic, dark, chill..."
          className="w-full rounded-xl bg-black/30 border border-white/10 py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-neon/60"
          data-testid="audio-genre-search"
        />
      </div>
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {genres.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => onChange(genre)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 hover:text-white hover:border-white/20 btn-press"
            >
              {genre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchCard({ label, count, icon, from, to, accent, onClick, testId }) {
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

function SubList({ sub, onBack, backLabel, filtered, loading, reload, allAssets, category }) {
  return (
    <>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6 btn-press"
        data-testid="back-to-picker"
      >
        <ChevronLeft className="w-4 h-4" /> All {backLabel}
      </button>
      <h2 className="font-display text-2xl font-bold mb-4">{sub}</h2>
      <AssetGrid assets={filtered} loading={loading} reload={reload} allAssets={allAssets} category={category} />
    </>
  );
}

function AssetGrid({ assets, loading, reload, allAssets, category }) {
  if (loading) return <AssetSkeletonGrid />;
  if (assets.length === 0) return <EmptyCategoryState category={category} />;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {assets.map((a, idx) => (
        <div
          key={a.id}
          className="asset-3d-in"
          style={{ animationDelay: `${Math.min(idx, 12) * 60}ms` }}
        >
          <AssetCard asset={a} onChanged={reload} allAssets={allAssets || assets} />
        </div>
      ))}
    </div>
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

function PickerSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="h-44 rounded-2xl border border-white/5 bg-white/[0.035] animate-pulse" />
      ))}
    </div>
  );
}

function EmptyCategoryState({ category }) {
  return (
    <div className="relative overflow-hidden text-center py-24 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/50 to-transparent" />
      <Sparkles className="w-8 h-8 text-neon mx-auto mb-4 opacity-80" />
      <h3 className="font-display text-2xl mb-2">Nothing here yet</h3>
      <p className="text-zinc-500 max-w-md mx-auto">No {category?.toLowerCase() || "assets"} have been uploaded here yet. Check back soon — moderators are curating drops.</p>
    </div>
  );
}
