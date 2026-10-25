import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  api,
  CREATOR_THEMES,
  SHOWS,
  SHOW_THEMES,
  SHOW_IMAGES,
  CATEGORY_COLORS,
} from "@/lib/api";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import CategoryPicker from "@/components/CategoryPicker";
import LiquidGlass from "@/components/LiquidGlass";
import {
  AssetGrid,
  AssetSkeletonGrid,
  BackButton,
  BranchCard,
  EmptyState,
  PickerSkeleton,
  SectionHeader,
  SubHeading,
} from "@/components/Library";
import { EASE_OUT, KineticText, SPRING } from "@/lib/motion";
import { ArrowUpDown, ChevronDown, ChevronRight, Check, Music2, Tv, Film, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const SLUG_TO_CATEGORY = {
  "torrents": "Torrents",
  "project-files": "Project Files",
  "overlays": "Overlays",
  "audios": "Audios",
  "sound-fx": "Sound FX",
  "presets": "Presets",
  "videos": "Videos",
  "premium": "Premium",
};

const DESCRIPTIONS = {
  Torrents: "Complete season torrents and movies — clean, organized.",
  "Project Files": "After Effects PJFs. Drag, drop, customize.",
  Overlays: "Effects, particles, transitions. Linear color key ready.",
  Audios: "Tracks curated by the community's top audio creators.",
  "Sound FX": "Whooshes, impacts, risers, foley. Built for cuts.",
  Presets: "Plug-and-play presets for AE & beyond.",
  Videos: "Community videos, tutorials, showcases, and updates playable inside Effects Academy.",
  Premium: "Premium drops, exclusive packs.",
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "downloads", label: "Most downloaded" },
  { value: "az", label: "A-Z" },
];

const getGenre = (asset) => (asset.genre || (asset.category === "Audios" ? asset.bpm : "") || "").trim();
const getStamp = (asset) => {
  const displayStamp = asset.is_updated && asset.updated_at
    ? asset.updated_at
    : asset.created_at || asset.createdAt;
  return new Date(displayStamp || 0).getTime() || 0;
};
const sortAssets = (list, sortBy) => [...list].sort((a, b) => {
  if (sortBy === "downloads") return (b.download_count || 0) - (a.download_count || 0);
  if (sortBy === "az") return (a.title || "").localeCompare(b.title || "");
  return getStamp(b) - getStamp(a);
});

const matchesSearch = (asset, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    asset.title,
    asset.description,
    asset.creator_tag,
    asset.genre,
    asset.bpm,
    asset.category,
    asset.show_group,
    asset.torrent_type,
    asset.ae_version,
    asset.original_filename,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
};

export default function CategoryPage() {
  const { slug } = useParams();
  const category = SLUG_TO_CATEGORY[slug];
  const [assets, setAssets] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);
  const [torrentBranch, setTorrentBranch] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [overrides, setOverrides] = useState({ creator: {}, show: {} });
  const c = CATEGORY_COLORS[category] || {};
  const reduce = useReducedMotion();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/assets");
      setAllAssets(data);
      setAssets(data.filter((asset) => asset.category === category));
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
      setSearchQuery("");
      setSortBy("newest");
      load();
      loadOverrides();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const isSearching = Boolean(searchQuery.trim());

  const categorySearchFilteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = !q ? assets : assets.filter((a) => matchesSearch(a, q));
    return sortAssets(list, sortBy);
  }, [assets, searchQuery, sortBy]);

  const globalSearchResults = useMemo(() => {
    if (!isSearching) return [];
    return sortAssets(allAssets.filter((a) => matchesSearch(a, searchQuery)), sortBy);
  }, [allAssets, searchQuery, sortBy, isSearching]);

  const sortedAssets = useMemo(() => sortAssets(assets, sortBy), [assets, sortBy]);

  const availableGenres = useMemo(() => {
    return Array.from(new Set(assets.map(getGenre).filter(Boolean))).slice(0, 12);
  }, [assets]);

  const filteredAudios = useMemo(
    () => (sub ? categorySearchFilteredAssets.filter((a) => a.creator_tag === sub) : []),
    [categorySearchFilteredAssets, sub]
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
    const creatorsFromAssets = Array.from(
      new Set(categorySearchFilteredAssets.filter((a) => a.creator_tag).map((a) => a.creator_tag))
    );
    const creatorsFromOverrides = Object.keys(overrides.creator || {});
    return Array.from(new Set([...creatorsFromAssets, ...creatorsFromOverrides]))
      .filter((name) => !overrides.creator?.[name]?.deleted);
  }, [categorySearchFilteredAssets, overrides.creator]);

  const mergedShows = useMemo(() => {
    const customs = Array.from(
      new Set(showAssets.filter((a) => a.show_group).map((a) => a.show_group))
    );
    return [...SHOWS, ...customs.filter((s) => !SHOWS.includes(s))];
  }, [showAssets]);

  if (!category) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 pt-28 text-center">
        <p className="eyebrow mb-2">404</p>
        <h2 className="display-md text-ink">Category not found.</h2>
        <Link to="/" className="link-more mt-5">
          Back to browse <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1320px] px-4 pb-28 pt-28 sm:px-6 md:px-8 md:pt-32" data-testid={`page-${slug}`}>
      <BackButton to="/" testId="back-home">Browse</BackButton>

      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <motion.p
            className="eyebrow eyebrow-c mb-2 inline-flex items-center gap-2"
            style={{ "--c": c.text }}
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
          >
            <span className="dot" /> {category}
          </motion.p>
          <h1 className="display-lg text-ink">
            <KineticText text={category} stagger={0.07} />
          </h1>
          <motion.p
            className="lede mt-4"
            initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.25 }}
          >
            {DESCRIPTIONS[category]}
          </motion.p>
        </div>
        <motion.div
          className="flex items-center gap-4"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.35 }}
        >
          <p className="text-[13px] font-medium tabular-nums text-ink-3">
            {isSearching
              ? `${globalSearchResults.length} search result${globalSearchResults.length === 1 ? "" : "s"}`
              : `${categorySearchFilteredAssets.length} items`}
          </p>
          <SortControl sortBy={sortBy} setSortBy={setSortBy} />
        </motion.div>
      </div>

      <AssetSearch
        value={searchQuery}
        onChange={setSearchQuery}
        genres={category === "Audios" ? availableGenres : []}
        category={category}
      />

      <div className="mt-10">
        {isSearching ? (
          <>
            <SubHeading icon={<Search />}>Search results across all tabs</SubHeading>
            <CategoryGrid assets={globalSearchResults} loading={loading} reload={load} allAssets={allAssets} category="Search" />
          </>
        ) : category === "Audios" ? (
          <>
            {!sub ? (
              <>
                <SubHeading icon={<Music2 />}>Choose an audio pack</SubHeading>
                {loading ? <PickerSkeleton /> : (
                  <CategoryPicker
                    items={mergedCreators}
                    themes={CREATOR_THEMES}
                    images={{}}
                    overrides={overrides.creator}
                    kind="creator"
                    onChanged={async () => {
                      await Promise.all([loadOverrides(), load()]);
                    }}
                    getCount={(cr) => categorySearchFilteredAssets.filter((a) => a.creator_tag === cr).length}
                    onPick={setSub}
                    testIdPrefix="creator"
                  />
                )}
              </>
            ) : (
              <SubList sub={sub} onBack={() => setSub(null)} backLabel="creators" filtered={filteredAudios} loading={loading} reload={load} allAssets={allAssets} category={category} />
            )}
          </>
        ) : category === "Torrents" ? (
          <>
            {!torrentBranch && (
              <>
                <SubHeading icon={<Tv />}>Shows or movies?</SubHeading>
                {loading ? <PickerSkeleton /> : (
                  <div
                    className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-2"
                    data-testid="torrent-branch-grid"
                  >
                    <BranchCard
                      label="Shows"
                      count={showAssets.length}
                      icon={<Tv />}
                      from="#0E2A5C"
                      to="#040E26"
                      accent="#3B82F6"
                      onClick={() => setTorrentBranch("Shows")}
                      testId="torrent-branch-shows"
                    />
                    <BranchCard
                      label="Movies"
                      count={movieAssets.length}
                      icon={<Film />}
                      from="#3A0C18"
                      to="#0A0204"
                      accent="#EF4444"
                      onClick={() => setTorrentBranch("Movies")}
                      testId="torrent-branch-movies"
                      index={1}
                    />
                  </div>
                )}
              </>
            )}

            {torrentBranch === "Shows" && !sub && (
              <>
                <BackButton onClick={() => setTorrentBranch(null)} testId="back-to-branch">Torrents</BackButton>
                <SubHeading icon={<Tv />}>Choose a show</SubHeading>
                {loading ? <PickerSkeleton /> : (
                  <CategoryPicker
                    items={mergedShows}
                    themes={SHOW_THEMES}
                    images={SHOW_IMAGES}
                    overrides={overrides.show}
                    kind="show"
                    onChanged={async () => {
                      await Promise.all([loadOverrides(), load()]);
                    }}
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
                allAssets={allAssets}
                category={category}
              />
            )}

            {torrentBranch === "Movies" && (
              <>
                <BackButton onClick={() => setTorrentBranch(null)} testId="back-to-branch">Torrents</BackButton>
                <SectionHeader eyebrow="Torrents" eyebrowColor={c.text} title="Movies" />
                <CategoryGrid assets={movieAssets} loading={loading} reload={load} allAssets={allAssets} category={category} />
              </>
            )}
          </>
        ) : (
          <CategoryGrid assets={sortedAssets} loading={loading} reload={load} allAssets={allAssets} category={category} />
        )}
      </div>
    </section>
  );
}

function SortControl({ sortBy, setSortBy }) {
  const activeOption = SORT_OPTIONS.find((option) => option.value === sortBy) || SORT_OPTIONS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="lg lg-hover inline-flex h-10 items-center gap-2 rounded-full pl-3.5 pr-3 text-[13.5px]"
          data-testid="category-sort"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-ink-3" />
          <span className="text-ink-3">Sort</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={activeOption.value}
              className="font-medium text-ink"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              {activeOption.label}
            </motion.span>
          </AnimatePresence>
          <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="glass min-w-52 rounded-[20px] border-0 p-1.5 text-ink" align="end" sideOffset={10}>
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setSortBy(option.value)}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2 text-[0.9rem] text-ink focus:bg-[var(--fill-2)] focus:text-ink"
          >
            <span>{option.label}</span>
            <Check className={`h-4 w-4 text-tint transition-opacity duration-200 ${sortBy === option.value ? "opacity-100" : "opacity-0"}`} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssetSearch({ value, onChange, genres, category }) {
  return (
    <div className="sticky top-[var(--sticky-top,5.25rem)] z-30 -mx-1 px-1 py-2">
      <LiquidGlass className="group flex h-12 items-center rounded-full pl-4 pr-1.5 focus-within:shadow-[var(--glass-shadow),0_0_0_4px_rgb(var(--tint)/0.16)]" edge={18} strength={34}>
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-2 transition-colors duration-300 group-focus-within:text-tint" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search all assets: titles, creators, genres, shows..."
          aria-label="Search all assets"
          className="bare h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-ink outline-none placeholder:text-ink-3"
          data-testid="asset-global-search"
        />
        <AnimatePresence>
          {value ? (
            <motion.button
              type="button"
              onClick={() => onChange("")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fill-2)] text-ink-2 hover:text-ink"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={SPRING}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </LiquidGlass>
      {category === "Audios" && genres.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {genres.map((genre) => {
            const active = value === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => onChange(active ? "" : genre)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-[background-color,color,transform] duration-300 ease-spring active:scale-95 ${
                  active ? "bg-ink text-canvas" : "bg-[var(--fill-2)] text-ink-2 hover:text-ink"
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      )}
      <p className="sr-only">Searches every tab, including creators like MrBit, Nexlo, and Iusets.</p>
    </div>
  );
}

function SubList({ sub, onBack, backLabel, filtered, loading, reload, allAssets, category }) {
  return (
    <>
      <BackButton onClick={onBack} testId="back-to-picker">All {backLabel}</BackButton>
      <SectionHeader eyebrow={category} eyebrowColor={CATEGORY_COLORS[category]?.text} title={sub} />
      <CategoryGrid assets={filtered} loading={loading} reload={reload} allAssets={allAssets} category={category} />
    </>
  );
}

function CategoryGrid({ assets, loading, reload, allAssets, category }) {
  if (loading) return <AssetSkeletonGrid />;
  if (assets.length === 0) {
    return (
      <EmptyState>
        No {category?.toLowerCase() || "assets"} matched this view. Try another creator or category, or search by title, genre, show, or uploader.
      </EmptyState>
    );
  }
  return <AssetGrid assets={assets} onChanged={reload} allAssets={allAssets} />;
}
