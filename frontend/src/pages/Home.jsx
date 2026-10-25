import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  CATEGORIES,
  CATEGORY_COLORS,
  CREATOR_THEMES,
  SHOWS,
  SHOW_THEMES,
  SHOW_IMAGES,
} from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import CategoryPicker from "@/components/CategoryPicker";
import Hero from "@/components/Hero";
import LiquidGlass from "@/components/LiquidGlass";
import {
  AssetGrid,
  AssetSkeletonGrid,
  BackButton,
  BranchCard,
  EmptyState,
  SectionHeader,
  SubHeading,
  ViewAllLink,
} from "@/components/Library";
import { EASE_OUT, SPRING } from "@/lib/motion";
import { Captions, ChevronRight, Music2, Tv, Film, Wand2 } from "lucide-react";

const FILTER_TABS = ["All", ...CATEGORIES];
const EXTENSION_PIN_END = new Date("2026-10-02T23:59:59+01:00").getTime();

const CATEGORY_TO_SLUG = {
  Torrents: "torrents",
  "Project Files": "project-files",
  Overlays: "overlays",
  Audios: "audios",
  "Sound FX": "sound-fx",
  Presets: "presets",
  Videos: "videos",
  Premium: "premium",
};

const DASHBOARD_SECTIONS = [
  "Audios",
  "Presets",
  "Project Files",
  "Overlays",
  "Sound FX",
  "Videos",
  "Torrents",
];

const getStamp = (asset) => {
  const displayStamp = asset.is_updated && asset.updated_at
    ? asset.updated_at
    : asset.created_at || asset.createdAt;
  return new Date(displayStamp || 0).getTime() || 0;
};

const isEffectsAcademyExtension = (asset) => {
  if (asset?.category !== "Premium") return false;
  const normalizedTitle = String(asset?.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalizedTitle.includes("effectsacademyextension");
};

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
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
};

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
  const recentlyAdded = useMemo(() => {
    const recent = sortedAssets.filter((asset) => asset.category !== "Videos");
    if (Date.now() > EXTENSION_PIN_END) return recent.slice(0, 8);
    const extension = recent.find(isEffectsAcademyExtension);
    if (!extension) return recent.slice(0, 8);
    return [extension, ...recent.filter((asset) => asset.id !== extension.id)].slice(0, 8);
  }, [sortedAssets]);
  const pinnedExtensionId = Date.now() <= EXTENSION_PIN_END
    ? recentlyAdded.find(isEffectsAcademyExtension)?.id || ""
    : "";

  const mergedAudioCreators = useMemo(() => {
    const creatorsFromAssets = Array.from(
      new Set(
        assets
          .filter((a) => a.category === "Audios" && a.creator_tag)
          .map((a) => a.creator_tag)
      )
    );
    const creatorsFromOverrides = Object.keys(overrides.creator || {});
    return Array.from(new Set([...creatorsFromAssets, ...creatorsFromOverrides]))
      .filter((name) => !overrides.creator?.[name]?.deleted);
  }, [assets, overrides.creator]);

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
    return list;
  }, [sortedAssets, filter, sub, torrentBranch]);

  const searchedAll = useMemo(() => {
    if (!query.trim()) return null;
    return sortedAssets.filter((a) => matchesSearch(a, query));
  }, [sortedAssets, query]);

  const isAllTab = filter === "All";
  const isSearching = Boolean(query.trim());

  const countLabel = isSearching
    ? `${searchedAll?.length || 0} search result${searchedAll?.length === 1 ? "" : "s"}`
    : isAllTab
      ? `${assets.length} total`
      : showsPickerForFilter && !sub
        ? `${assets.filter((a) => a.category === filter).length} items`
        : `${filteredForFilter.length} assets`;

  return (
    <>
      <Hero query={query} setQuery={setQuery} totalAssets={assets.length} />

      <section className="relative mx-auto max-w-[1320px] px-4 pb-28 sm:px-6 md:px-8" data-testid="asset-section">
        <FilterBar filter={filter} setFilter={setFilter} countLabel={countLabel} />

        <div className="mt-10">
          {loading ? (
            <AssetSkeletonGrid />
          ) : isSearching ? (
            searchedAll.length === 0 ? (
              <HomeEmptyState filter="Search" />
            ) : (
              <>
                <SectionHeader eyebrow="Search" title={<>Results for &ldquo;{query.trim()}&rdquo;</>} />
                <AssetGrid assets={searchedAll} onChanged={load} allAssets={assets} />
              </>
            )
          ) : isAllTab ? (
            <DashboardView data={dashboardData} totalAssets={assets.length} recentlyAdded={recentlyAdded} pinnedExtensionId={pinnedExtensionId} allAssets={assets} onChanged={load} />
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
        </div>
      </section>
    </>
  );
}

/*
 * Sticky Liquid Glass filter bar. The active tab is a glass "lens" that glides
 * between options; content scrolling underneath shows through the material.
 */
function FilterBar({ filter, setFilter, countLabel }) {
  return (
    <div className="sticky top-[var(--sticky-top,5.25rem)] z-30 -mx-1 flex items-center gap-3 px-1 py-2">
      <LiquidGlass className="min-w-0 flex-1 rounded-full p-1 sm:flex-none" edge={18} strength={34}>
        <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto" data-testid="filter-tabs">
          {FILTER_TABS.map((t) => {
            const active = filter === t;
            const c = CATEGORY_COLORS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={`relative shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-medium tracking-[-0.01em] transition-colors duration-300 ${
                  active ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
                aria-pressed={active}
                data-testid={`filter-tab-${t.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {active && (
                  <motion.span
                    layoutId="home-filter-lens"
                    className="absolute inset-0 rounded-full bg-panel shadow-[0_1px_4px_rgb(0_0_0/0.14),inset_0_0_0_0.5px_var(--line-strong),inset_0_1px_0_rgb(255_255_255/0.12)]"
                    transition={SPRING}
                  />
                )}
                <span className="relative inline-flex items-center gap-1.5">
                  {c ? (
                    <span
                      className="dot transition-transform duration-500 ease-spring"
                      style={{ color: c.text, transform: active ? "scale(1)" : "scale(0)", width: active ? undefined : 0, marginRight: active ? undefined : -6 }}
                    />
                  ) : null}
                  {t}
                </span>
              </button>
            );
          })}
          <span className="mx-1.5 h-5 w-px shrink-0 bg-[var(--line-strong)]" aria-hidden="true" />
          <Link
            to="/ai-image"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-medium text-ink-2 transition-colors duration-300 hover:text-ink"
            data-testid="filter-tab-ai-tools"
          >
            <Wand2 className="h-3.5 w-3.5 text-[#bf5af2]" />
            AI Tools
          </Link>
          <Link
            to="/transcribe"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-medium text-ink-2 transition-colors duration-300 hover:text-ink"
            data-testid="filter-tab-transcribe"
          >
            <Captions className="h-3.5 w-3.5 text-[#64d2ff]" />
            Transcribe
          </Link>
        </div>
      </LiquidGlass>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={countLabel}
          className="ml-auto hidden shrink-0 text-[13px] font-medium tabular-nums text-ink-3 md:block"
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        >
          {countLabel}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function DashboardView({ data, totalAssets, recentlyAdded, pinnedExtensionId, allAssets, onChanged }) {
  if (totalAssets === 0) return <HomeEmptyState filter="All" />;
  return (
    <div className="space-y-24">
      <RecentlyAdded assets={recentlyAdded} pinnedExtensionId={pinnedExtensionId} allAssets={allAssets} onChanged={onChanged} />
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

function RecentlyAdded({ assets, pinnedExtensionId, allAssets, onChanged }) {
  return (
    <div data-testid="recently-added-section">
      <SectionHeader eyebrow="Fresh drops" title="Recently added." />
      <AssetGrid assets={assets} featuredAssetId={pinnedExtensionId} onChanged={onChanged} allAssets={allAssets} />
    </div>
  );
}

function DashboardSection({ category, assets, allAssets, onChanged }) {
  const c = CATEGORY_COLORS[category];
  const slug = CATEGORY_TO_SLUG[category];
  return (
    <div data-testid={`section-${slug}`}>
      <SectionHeader
        eyebrow={category}
        eyebrowColor={c?.text}
        title={`Latest ${category.toLowerCase()}.`}
        action={<ViewAllLink to={`/category/${slug}`} testId={`view-all-${slug}`} />}
      />
      {assets.length === 0 ? (
        <p className="rounded-[22px] px-6 py-8 text-[15px] text-ink-3 shadow-[inset_0_0_0_1px_var(--line)]">
          No {category.toLowerCase()} yet. Moderators can add them from the Upload menu.
        </p>
      ) : (
        <AssetGrid assets={assets} onChanged={onChanged} allAssets={allAssets} />
      )}
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
        <SubHeading icon={<Tv />}>Shows or movies?</SubHeading>
        <div className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-2" data-testid="home-torrent-branch-grid">
          <BranchCard
            label="Shows"
            count={showCount}
            icon={<Tv />}
            from="#0E2A5C"
            to="#040E26"
            accent="#3B82F6"
            onClick={() => setTorrentBranch("Shows")}
            testId="home-torrent-branch-shows"
          />
          <BranchCard
            label="Movies"
            count={movieCount}
            icon={<Film />}
            from="#3A0C18"
            to="#0A0204"
            accent="#EF4444"
            onClick={() => setTorrentBranch("Movies")}
            testId="home-torrent-branch-movies"
            index={1}
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
          <BackButton onClick={() => setTorrentBranch(null)} testId="home-back-to-torrent-branch">
            Torrents
          </BackButton>
        )}
        <SubHeading icon={filter === "Audios" ? <Music2 /> : <Tv />}>
          {filter === "Audios" ? "Choose an audio pack" : "Choose a show"}
        </SubHeading>
        <CategoryPicker
          items={filter === "Audios" ? mergedAudioCreators : mergedShows}
          themes={filter === "Audios" ? CREATOR_THEMES : SHOW_THEMES}
          images={filter === "Audios" ? {} : SHOW_IMAGES}
          overrides={filter === "Audios" ? overrides.creator : overrides.show}
          kind={filter === "Audios" ? "creator" : "show"}
          onChanged={async () => {
            await Promise.all([loadOverrides(), load()]);
          }}
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
        <BackButton onClick={() => setTorrentBranch(null)} testId="home-back-to-torrent-branch">
          Torrents
        </BackButton>
      )}
      {showsPicker && sub && (
        <>
          <BackButton onClick={() => setSub(null)} testId="back-to-picker">
            All {filter === "Audios" ? "creators" : "shows"}
          </BackButton>
          <SectionHeader eyebrow={filter} eyebrowColor={CATEGORY_COLORS[filter]?.text} title={sub} />
        </>
      )}
      {filtered.length === 0 ? (
        <HomeEmptyState filter={filter} />
      ) : (
        <AssetGrid assets={filtered} onChanged={load} allAssets={assets} />
      )}
    </>
  );
}

function HomeEmptyState({ filter }) {
  return (
    <EmptyState
      action={(
        <Link to="/category/torrents" className="link-more">
          Browse categories <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    >
      {filter === "Search"
        ? "No assets matched that search. Try a title, creator, genre, show, or category name."
        : filter === "All"
          ? "The vault is empty. Moderators can unlock upload access and start dropping packs."
          : `Nothing under "${filter}" yet. Try another category or check back soon.`}
    </EmptyState>
  );
}
