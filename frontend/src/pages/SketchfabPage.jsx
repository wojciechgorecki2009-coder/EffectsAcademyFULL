import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Box,
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PageIntro } from "@/components/Library";
import { EASE_OUT, Reveal, SPRING } from "@/lib/motion";
import {
  FORMATS,
  TOKEN_SETTINGS_URL,
  attributionText,
  clearToken,
  fetchAccount,
  fetchModel,
  fileName,
  formatBytes,
  parseModelUid,
  pickThumbnail,
  readToken,
  requestDownload,
  fetchFile,
  isOffered,
  saveBlob,
  saveFile,
  saveToken,
} from "@/lib/sketchfab";

const FEATURES = [
  { icon: Box, label: "GLB · glTF · USDZ" },
  { icon: ShieldCheck, label: "Official Sketchfab downloads" },
  { icon: Sparkles, label: "Textures included" },
  { icon: Check, label: "Free for everyone" },
];

// Download links from Sketchfab last 5 minutes; older ones are fetched again.
const LINK_LIFETIME_MS = 4 * 60 * 1000;

const number = (value) => (Number.isFinite(value) ? value.toLocaleString() : "—");

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-ink-3">{label}</p>
      <p className="mt-0.5 truncate text-[15px] font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function ModelCard({ model, size, converted }) {
  const reduce = useReducedMotion();
  const thumbnail = pickThumbnail(model);
  const author = model.user?.displayName || model.user?.username;
  return (
    <motion.div
      key={model.uid}
      initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className="p-3.5 md:p-4"
      data-testid="sketchfab-model"
    >
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="font-display text-[1.45rem] font-semibold leading-tight tracking-[-0.025em] text-ink">{model.name}</h2>
          <p className="mt-1 text-[13px] text-ink-3">
            by{" "}
            <a href={model.user?.profileUrl} target="_blank" rel="noreferrer" className="font-medium text-ink-2 hover:text-tint hover:underline">
              {author}
            </a>
          </p>
        </div>
        <a href={model.viewerUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary shrink-0">
          <ExternalLink /> Sketchfab
        </a>
      </div>

      <div className="group relative mt-4 aspect-[16/9] overflow-hidden rounded-[20px] bg-[var(--fill)]">
        {thumbnail ? (
          <motion.img
            src={thumbnail}
            alt={model.name}
            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out-expo group-hover:scale-[1.03]"
            initial={reduce ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-3">
            <Box className="h-10 w-10" />
          </div>
        )}
        {!model.isDownloadable && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur-md">
            <Lock className="h-3.5 w-3.5" /> Not downloadable
          </span>
        )}
      </div>

      {model.description ? (
        <p className="mt-4 line-clamp-3 whitespace-pre-line px-1 text-[14px] leading-relaxed text-ink-2">{model.description}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-[var(--line)] px-1 pt-4">
        <Stat label="Vertices" value={number(model.vertexCount)} />
        <Stat label="Faces" value={number(model.faceCount)} />
        <Stat label="Animations" value={number(model.animationCount)} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--line)] px-1 pt-4">
        <Stat label="License" value={model.license?.label || "—"} />
        <Stat label="Download size" value={size ? formatBytes(size) : converted ? "Made on download" : model.isDownloadable ? "Connect to see" : "—"} />
      </div>
    </motion.div>
  );
}

function ConnectPanel({ onConnected }) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const connect = async (event) => {
    event.preventDefault();
    const token = value.trim();
    if (!token) return;
    setChecking(true);
    setError("");
    try {
      const account = await fetchAccount(token);
      saveToken(token);
      onConnected(token, account);
      toast.success(`Connected as ${account.displayName}.`);
    } catch (err) {
      setError(err.code === "auth" ? "That token wasn't accepted. Copy it again from your Sketchfab settings." : err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={connect} className="mt-4 rounded-[20px] bg-[var(--fill)] p-4" data-testid="sketchfab-connect">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
        <KeyRound className="h-4 w-4 text-tint" /> Connect your Sketchfab account
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
        Sketchfab only allows downloads from a signed-in account (a free one works). Copy the <b>API token</b> from your Sketchfab
        password settings and paste it here.
      </p>
      <a href={TOKEN_SETTINGS_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-tint hover:underline">
        Open my Sketchfab API token <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <div className="mt-3 flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your API token"
          autoComplete="off"
          spellCheck={false}
          className="field min-w-0 flex-1 font-mono text-[13px]"
          aria-label="Sketchfab API token"
          data-testid="sketchfab-token-input"
        />
        <button type="submit" disabled={!value.trim() || checking} className="btn btn-primary shrink-0" data-testid="sketchfab-connect-button">
          {checking ? <Loader2 className="animate-spin" /> : <Check />} Connect
        </button>
      </div>
      {error && <p className="mt-2 text-[12.5px] text-[#ff453a]">{error}</p>}
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
        Your token is saved only in this browser and is sent only to Sketchfab, never to Effects Academy.
      </p>
    </form>
  );
}

export default function SketchfabPage() {
  const reduce = useReducedMotion();
  const inputRef = useRef(null);
  const [link, setLink] = useState("");
  const [model, setModel] = useState(null);
  const [lookup, setLookup] = useState("idle"); // idle | loading | error
  const [lookupError, setLookupError] = useState("");
  const [token, setToken] = useState(() => readToken());
  const [account, setAccount] = useState(null);
  const [links, setLinks] = useState(null); // { glb: { url, size }, ... } and fetchedAt
  const [linksError, setLinksError] = useState("");
  // OBJ first: it's what After Effects imports most reliably.
  const [format, setFormat] = useState("obj");
  const [saving, setSaving] = useState(null); // null | { progress }
  const [copied, setCopied] = useState(false);

  // Check a saved token still works, and show whose account it is.
  useEffect(() => {
    if (!token || account) return;
    fetchAccount(token)
      .then(setAccount)
      .catch((err) => {
        if (err.code !== "auth") return;
        clearToken();
        setToken("");
      });
  }, [token, account]);

  const loadLinks = async (uid, activeToken = token) => {
    setLinksError("");
    try {
      const next = await requestDownload(uid, activeToken);
      setLinks({ ...next, fetchedAt: Date.now() });
      if (!isOffered(next, FORMATS.find((f) => f.id === format))) setFormat(FORMATS.find((f) => isOffered(next, f))?.id || "obj");
      return next;
    } catch (err) {
      if (err.code === "auth") disconnect(false);
      setLinksError(err.message);
      setLinks(null);
      return null;
    }
  };

  // Once a downloadable model and an account are both there, find out which formats exist.
  useEffect(() => {
    if (model?.isDownloadable && token && !links) loadLinks(model.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, token]);

  const find = async (text = link) => {
    const uid = parseModelUid(text);
    if (!uid) {
      setLookup("error");
      setLookupError("Paste a Sketchfab model link, like sketchfab.com/3d-models/name-1a2b3c…");
      return;
    }
    if (uid === model?.uid) return;
    setLookup("loading");
    setLookupError("");
    setLinks(null);
    setLinksError("");
    try {
      setModel(await fetchModel(uid));
      setLookup("idle");
    } catch (err) {
      setModel(null);
      setLookup("error");
      setLookupError(err.message);
    }
  };

  const disconnect = (notify = true) => {
    clearToken();
    setToken("");
    setAccount(null);
    setLinks(null);
    if (notify) toast("Disconnected from Sketchfab.");
  };

  const download = async () => {
    const chosen = FORMATS.find((f) => f.id === format);
    if (!model || !chosen || saving) return;
    const source = chosen.from || chosen.id;
    setSaving({ progress: 0, step: "download" });
    try {
      let current = links;
      if (!current?.[source] || Date.now() - current.fetchedAt > LINK_LIFETIME_MS) current = await loadLinks(model.uid);
      if (!current?.[source]) throw new Error(linksError || `${chosen.label} isn't available for this model.`);
      if (chosen.id === "obj") {
        // Download the GLB (first 60%), then convert it here (the rest).
        const glb = await fetchFile(current.glb.url, (progress) => setSaving({ progress: progress * 0.6, step: "download" }));
        setSaving({ progress: 0.6, step: "convert" });
        const { glbToObjZip } = await import("@/lib/objExport");
        const result = await glbToObjZip(await glb.arrayBuffer(), model.name, (progress) => setSaving({ progress: 0.6 + progress * 0.4, step: "convert" }));
        saveBlob(result.blob, fileName(model, chosen));
        toast.success(result.hadAnimation ? "OBJ downloaded. OBJ files can't hold animation, so the model is in its resting pose." : "OBJ downloaded.");
      } else {
        const fetched = await saveFile(current[source].url, fileName(model, chosen), (progress) => setSaving({ progress, step: "download" }));
        toast.success(fetched ? `${chosen.label} downloaded.` : `${chosen.label} download started.`);
      }
    } catch (err) {
      toast.error(err.message || "The download failed. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const copyCredit = async () => {
    try {
      await navigator.clipboard.writeText(attributionText(model));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Select the text instead.");
    }
  };

  const selected = FORMATS.find((f) => f.id === format);
  const size = selected?.from ? 0 : links?.[format]?.size;
  const available = FORMATS.filter((f) => isOffered(links, f));

  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-28 pt-32 md:px-8 md:pt-36" data-testid="sketchfab-page">
      <PageIntro
        eyebrow="3D Models"
        icon={<Box />}
        title="Download 3D models."
      >
        Paste a Sketchfab link and download the model as GLB, glTF or USDZ, textures included, ready for After Effects,
        Blender or Cinema 4D. Works with every model its creator has made downloadable.
      </PageIntro>

      <Reveal className="mt-7 flex flex-wrap gap-2" delay={0.35}>
        {FEATURES.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fill)] px-3 py-1.5 text-[12.5px] font-medium text-ink-2">
            <Icon className="h-3.5 w-3.5 text-tint" /> {label}
          </span>
        ))}
      </Reveal>

      <Reveal className="mt-10" delay={0.1}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            find();
          }}
          className="surface flex items-center gap-2 rounded-full p-1.5 pl-5"
        >
          <Link2 className="h-5 w-5 shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (parseModelUid(pasted)) setTimeout(() => find(pasted), 0);
            }}
            placeholder="Paste a Sketchfab model link"
            inputMode="url"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-3"
            aria-label="Sketchfab model link"
            data-testid="sketchfab-link-input"
          />
          <button type="submit" disabled={!link.trim() || lookup === "loading"} className="btn btn-primary shrink-0" data-testid="sketchfab-find">
            {lookup === "loading" ? <Loader2 className="animate-spin" /> : <Search />}
            <span className="max-[420px]:hidden">Find model</span>
          </button>
        </form>
        <AnimatePresence>
          {lookup === "error" && (
            <motion.p
              className="mt-3 flex items-center gap-2 px-5 text-[13px] text-[#ff9f0a]"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-testid="sketchfab-lookup-error"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" /> {lookupError}
            </motion.p>
          )}
        </AnimatePresence>
      </Reveal>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Reveal className="surface min-h-[320px] overflow-hidden rounded-[28px]">
          <AnimatePresence mode="wait" initial={false}>
            {model ? (
              <ModelCard key={model.uid} model={model} size={size} converted={Boolean(selected?.from && isOffered(links, selected))} />
            ) : (
              <motion.div
                key="empty"
                className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.span
                  className="mb-6 flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#ff9f0a] text-black shadow-[0_18px_40px_-14px_rgb(255_159_10/0.8)]"
                  animate={reduce ? undefined : lookup === "loading" ? { rotate: 360 } : { y: [0, -6, 0], rotateY: [0, 180, 360] }}
                  transition={lookup === "loading" ? { duration: 1.2, ease: "linear", repeat: Infinity } : { duration: 5, ease: "easeInOut", repeat: Infinity }}
                >
                  <Box className="h-9 w-9" />
                </motion.span>
                <p className="font-display text-[1.6rem] font-semibold tracking-[-0.025em] text-ink">
                  {lookup === "loading" ? "Finding the model" : "Paste a link to start"}
                </p>
                <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">
                  Copy the address of any model page on sketchfab.com and paste it above.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Reveal>

        <Reveal className="surface rounded-[28px] p-6" delay={0.08}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">Download</h2>
            {account && (
              <span className="flex min-w-0 items-center gap-2" data-testid="sketchfab-account">
                {account.avatar ? <img src={account.avatar} alt="" className="h-6 w-6 rounded-full" /> : null}
                <span className="truncate text-[12.5px] font-medium text-ink-2">{account.displayName}</span>
                <button type="button" onClick={() => disconnect()} className="rounded-full p-1 text-ink-3 hover:bg-[var(--fill)] hover:text-ink" aria-label="Disconnect Sketchfab" title="Disconnect">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>

          {!token ? (
            <ConnectPanel
              onConnected={(nextToken, nextAccount) => {
                setToken(nextToken);
                setAccount(nextAccount);
              }}
            />
          ) : model && !model.isDownloadable ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-[16px] bg-[rgb(255_159_10/0.12)] px-3.5 py-3 text-[13px] leading-snug text-ink" data-testid="sketchfab-not-downloadable">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9f0a]" />
              <span>
                {model.price ? "This is a paid model on the Sketchfab Store, so it can only be bought there." : "Its creator hasn't made this model downloadable, so Sketchfab doesn't offer a download for it."}
              </span>
            </div>
          ) : (
            <>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
                {model ? "Choose a format. Sketchfab provides each one with its textures." : "Find a model to see which formats it comes in."}
              </p>
              <div className="mt-4 space-y-2" role="radiogroup" aria-label="Format">
                {FORMATS.map((f) => {
                  const offered = isOffered(links, f);
                  const active = format === f.id && offered;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!offered}
                      onClick={() => setFormat(f.id)}
                      className={`relative flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-45 ${
                        active ? "text-ink" : "text-ink-2 hover:bg-[var(--fill)]"
                      }`}
                      data-testid={`sketchfab-format-${f.id}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="sketchfab-format"
                          className="absolute inset-0 -z-0 rounded-[18px] bg-[rgb(var(--tint)/0.12)] shadow-[inset_0_0_0_1.5px_rgb(var(--tint)/0.55)]"
                          transition={SPRING}
                        />
                      )}
                      <span className="relative w-12 font-mono text-[13px] font-bold">{f.label}</span>
                      <span className="relative min-w-0 flex-1 text-[12.5px] leading-snug">{f.detail}</span>
                      <span className="relative shrink-0 text-[12px] tabular-nums text-ink-3">
                        {offered ? (f.from ? "Converted" : formatBytes(links[f.id].size)) : model && links ? "Not offered" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={download}
                disabled={!model || !available.length || Boolean(saving)}
                className="btn btn-primary btn-lg btn-block relative mt-5 overflow-hidden"
                data-testid="sketchfab-download"
              >
                {saving && (
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-white/20"
                    animate={{ width: `${Math.round(saving.progress * 100)}%` }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                  />
                )}
                <span className="relative inline-flex items-center gap-2">
                  {saving ? <Loader2 className="animate-spin" /> : <Download />}
                  {saving
                    ? saving.step === "convert"
                      ? `Converting to OBJ ${Math.round(saving.progress * 100)}%`
                      : saving.progress > 0
                      ? `Downloading ${Math.round(saving.progress * 100)}%`
                      : "Preparing download"
                    : `Download ${FORMATS.find((f) => f.id === format)?.label || ""}`}
                </span>
              </button>
              {model && token && !links && !linksError && (
                <p className="mt-3 flex items-center justify-center gap-2 text-[12.5px] text-ink-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Asking Sketchfab for the files
                </p>
              )}
              {linksError && <p className="mt-3 text-center text-[13px] text-[#ff453a]">{linksError}</p>}
            </>
          )}

          {model?.isDownloadable && model.license && (
            <div className="mt-5 rounded-[18px] bg-[var(--fill)] p-4" data-testid="sketchfab-credit">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-ink">{model.license.label}</p>
                <button type="button" onClick={copyCredit} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-tint hover:underline">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy credit"}
                </button>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{model.license.requirements}</p>
              <p className="mt-2 select-all break-words text-[11.5px] leading-relaxed text-ink-3">{attributionText(model)}</p>
            </div>
          )}

          <p className="mt-5 text-center text-[11.5px] leading-relaxed text-ink-3">
            Models are provided by{" "}
            <a href="https://sketchfab.com" target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
              Sketchfab
            </a>{" "}
            and belong to their creators. OBJ files are converted from the GLB on your device; FBX isn&apos;t available.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
