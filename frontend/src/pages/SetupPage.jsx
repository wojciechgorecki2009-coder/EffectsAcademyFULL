import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Edit3, ExternalLink, ImagePlus, PackageOpen, Save, Search, Settings2, ShoppingBag, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { api, FILE_BASE } from "@/lib/api";
import { EASE_OUT, FadeText, KineticText, SPRING, Stagger, StaggerItem } from "@/lib/motion";
import LiquidGlass from "@/components/LiquidGlass";
import { BackButton } from "@/components/Library";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_SETTINGS = {
  title: "PRODUCTS I USE",
  intro:
    "People always ask me what gear I use, so I put everything in one place. Some links may be affiliate links.",
  background_url: "/media/mrbit-setup-default-bg.png",
  background_color: "#5F438C",
  item_background: "rgba(38,38,42,0.82)",
  accent_color: "#A78BFA",
};

const EMPTY_CATEGORY = {
  name: "",
  description: "",
  image_url: "",
  image_scale: 1,
  is_software: false,
  background: "",
  sort_order: 0,
};

const EMPTY_ITEM = {
  category_id: "",
  name: "",
  description: "",
  image_url: "",
  image_scale: 1,
  amazon_url: "",
  price: "",
  price_note: "",
  background: "",
  sort_order: 0,
};

const APPROX_GBP_TO_USD = 1.35;

function mediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/media/") || url.startsWith("/static/")) return url;
  return `${FILE_BASE}${url}`;
}

function usdEstimateFromPrice(price = "") {
  const match = String(price).match(/£\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return "";
  const gbp = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(gbp)) return "";
  const usd = gbp * APPROX_GBP_TO_USD;
  const rounded = usd >= 100 ? Math.round(usd) : Math.round(usd * 100) / 100;
  return `≈ $${rounded.toLocaleString("en-US", {
    minimumFractionDigits: rounded % 1 ? 2 : 0,
    maximumFractionDigits: rounded % 1 ? 2 : 0,
  })}`;
}

function normalizeNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function normalizeScale(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 1;
  return Math.min(2.5, Math.max(0.35, next));
}

function imageScaleStyle(value) {
  const scale = normalizeScale(value || 1);
  return {
    "--setup-image-scale": scale,
    "--setup-image-hover-scale": scale * 1.035,
  };
}

async function optimizeSetupImage(file, kind = "item") {
  if (!file?.type?.startsWith("image/") || file.type === "image/gif") return file;

  const limits = {
    background: { maxWidth: 1920, maxHeight: 1280, quality: 0.78 },
    category: { maxWidth: 1100, maxHeight: 820, quality: 0.82 },
    item: { maxWidth: 1000, maxHeight: 1000, quality: 0.82 },
  };
  const limit = limits[kind] || limits.item;
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = sourceUrl;
    });

    const scale = Math.min(1, limit.maxWidth / image.width, limit.maxHeight / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    if (scale === 1 && file.size < 420 * 1024 && file.type === "image/webp") {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);

    const preferredType = file.type === "image/png" && file.size < 260 * 1024 ? "image/png" : "image/webp";
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, preferredType, preferredType === "image/png" ? undefined : limit.quality)
    );

    if (!blob || blob.size >= file.size) return file;

    const extension = preferredType === "image/png" ? "png" : "webp";
    const safeName = file.name.replace(/\.[^.]+$/, "") || "setup-image";
    return new File([blob], `${safeName}-optimized.${extension}`, { type: preferredType });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function UploadButton({ label, onUpload, disabled }) {
  return (
    <label className={`btn btn-secondary btn-sm cursor-pointer ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <UploadCloud />
      <span>{label}</span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />
    </label>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 text-[13px] font-medium text-ink-2 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function EditorCard({ title, className = "", children }) {
  return (
    <div className={`surface flex flex-col gap-4 rounded-[26px] p-6 ${className}`}>
      <h2 className="font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </div>
  );
}

function SetupEmpty({ children }) {
  return <div className="surface mx-auto mt-6 max-w-xl rounded-[26px] p-10 text-center text-[15px] text-ink-2">{children}</div>;
}

export default function SetupPage() {
  const reduce = useReducedMotion();
  const contentRef = useRef(null);
  const editorRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [data, setData] = useState({
    settings: DEFAULT_SETTINGS,
    categories: [],
    items: [],
    can_edit: false,
  });
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState(DEFAULT_SETTINGS);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingItemId, setEditingItemId] = useState("");

  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  if (!settings.background_url) settings.background_url = DEFAULT_SETTINGS.background_url;
  const categories = data.categories || [];
  const items = data.items || [];
  const canEdit = Boolean(data.can_edit);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  const loadPage = async () => {
    setLoading(true);
    try {
      const response = await api.get("/setup-page");
      const next = {
        settings: { ...DEFAULT_SETTINGS, ...(response.data?.settings || {}) },
        categories: response.data?.categories || [],
        items: response.data?.items || [],
        can_edit: Boolean(response.data?.can_edit),
      };
      setData(next);
      setSettingsForm(next.settings);
      if (!next.categories.some((category) => category.id === selectedCategoryId)) {
        setSelectedCategoryId("");
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not load setup page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening the editor (or editing a card) brings the editor into view.
  useEffect(() => {
    if (!editOpen) return undefined;
    const timer = window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [editOpen, editingCategoryId, editingItemId, reduce]);

  // Opens a category ("" for the overview). If the list starts above the screen, it
  // scrolls up to it so the new view's first row is what you see.
  const openCategory = (id) => {
    setSelectedCategoryId(id);
    const top = contentRef.current?.getBoundingClientRect().top;
    if (typeof top === "number" && top < 80) {
      window.scrollTo({ top: window.scrollY + top - 96, behavior: reduce ? "auto" : "smooth" });
    }
  };

  useEffect(() => {
    if (!settings.background_url) return;
    const img = new Image();
    img.decoding = "async";
    img.src = mediaUrl(settings.background_url);
  }, [settings.background_url]);

  const uploadImage = async (file, onUrl, label, kind = "item") => {
    setUploading(label);
    try {
      const optimizedFile = await optimizeSetupImage(file, kind);
      const formData = new FormData();
      formData.append("file", optimizedFile);
      const response = await api.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onUrl(response.data?.url || "");
      toast.success("Image uploaded.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Image upload failed.");
    } finally {
      setUploading("");
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await api.patch("/moderator/setup-page/settings", settingsForm);
      const next = {
        settings: { ...DEFAULT_SETTINGS, ...(response.data?.settings || {}) },
        categories: response.data?.categories || [],
        items: response.data?.items || [],
        can_edit: Boolean(response.data?.can_edit),
      };
      setData(next);
      setSettingsForm(next.settings);
      toast.success("Setup page updated.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not save page settings.");
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return toast.error("Category name is required.");
    setSaving(true);
    try {
      const payload = {
        ...categoryForm,
        image_scale: normalizeScale(categoryForm.image_scale),
        sort_order: normalizeNumber(categoryForm.sort_order),
      };
      if (editingCategoryId) {
        await api.patch(`/moderator/setup-page/categories/${editingCategoryId}`, payload);
        toast.success("Category updated.");
      } else {
        await api.post("/moderator/setup-page/categories", payload);
        toast.success("Category added.");
      }
      setCategoryForm(EMPTY_CATEGORY);
      setEditingCategoryId("");
      await loadPage();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not save category.");
    } finally {
      setSaving(false);
    }
  };

  const saveItem = async () => {
    if (!itemForm.category_id && categories[0]?.id) {
      setItemForm((form) => ({ ...form, category_id: categories[0].id }));
    }
    const categoryId = itemForm.category_id || categories[0]?.id || "";
    if (!categoryId) return toast.error("Add a category first.");
    if (!itemForm.name.trim()) return toast.error("Item name is required.");
    setSaving(true);
    try {
      const payload = {
        ...itemForm,
        category_id: categoryId,
        image_scale: normalizeScale(itemForm.image_scale),
        sort_order: normalizeNumber(itemForm.sort_order),
      };
      if (editingItemId) {
        await api.patch(`/moderator/setup-page/items/${editingItemId}`, payload);
        toast.success("Item updated.");
      } else {
        await api.post("/moderator/setup-page/items", payload);
        toast.success("Item added.");
      }
      setItemForm({ ...EMPTY_ITEM, category_id: categoryId });
      setEditingItemId("");
      await loadPage();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not save item.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete "${category.name}" and every item inside it?`)) return;
    try {
      await api.delete(`/moderator/setup-page/categories/${category.id}`);
      if (selectedCategoryId === category.id) setSelectedCategoryId("");
      toast.success("Category deleted.");
      await loadPage();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not delete category.");
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.delete(`/moderator/setup-page/items/${item.id}`);
      toast.success("Item deleted.");
      await loadPage();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not delete item.");
    }
  };

  const editCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name || "",
      description: category.description || "",
      image_url: category.image_url || "",
      image_scale: category.image_scale || 1,
      is_software: Boolean(category.is_software),
      background: category.background || "",
      sort_order: category.sort_order || 0,
    });
    setEditOpen(true);
  };

  const editItem = (item) => {
    setEditingItemId(item.id);
    setItemForm({
      category_id: item.category_id || "",
      name: item.name || "",
      description: item.description || "",
      image_url: item.image_url || "",
      image_scale: item.image_scale || 1,
      amazon_url: item.amazon_url || "",
      price: item.price || "",
      price_note: item.price_note || "",
      background: item.background || "",
      sort_order: item.sort_order || 0,
    });
    setEditOpen(true);
  };

  const queryText = query.trim().toLowerCase();
  const itemsByCategory = useMemo(() => {
    const grouped = {};
    for (const item of items) {
      grouped[item.category_id] = grouped[item.category_id] || [];
      grouped[item.category_id].push(item);
    }
    return grouped;
  }, [items]);
  const categoryById = useMemo(() => {
    const byId = {};
    for (const category of categories) {
      byId[category.id] = category;
    }
    return byId;
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (!queryText) return categories;
    return categories.filter((category) => {
      const categoryMatch = `${category.name} ${category.description}`.toLowerCase().includes(queryText);
      const itemMatch = (itemsByCategory[category.id] || []).some((item) =>
        `${item.name} ${item.description} ${item.price || ""} ${item.price_note}`.toLowerCase().includes(queryText)
      );
      return categoryMatch || itemMatch;
    });
  }, [categories, itemsByCategory, queryText]);

  const visibleItems = useMemo(() => {
    const scoped = selectedCategory ? itemsByCategory[selectedCategory.id] || [] : [];
    if (!queryText) return scoped;
    return scoped.filter((item) =>
      `${item.name} ${item.description} ${item.price || ""} ${item.price_note}`.toLowerCase().includes(queryText)
    );
  }, [itemsByCategory, queryText, selectedCategory]);
  const matchingItems = useMemo(() => {
    if (!queryText || selectedCategory) return [];
    return items.filter((item) =>
      `${item.name} ${item.description} ${item.price || ""} ${item.price_note}`.toLowerCase().includes(queryText)
    );
  }, [items, queryText, selectedCategory]);
  const itemFormCategory = categories.find((category) => category.id === itemForm.category_id);
  const itemFormIsSoftware = Boolean(itemFormCategory?.is_software);

  const renderSetupItemCard = (item) => {
    const itemCategory = categoryById[item.category_id];
    const usdEstimate = usdEstimateFromPrice(item.price);
    const isSoftwareItem = Boolean(itemCategory?.is_software);
    const linkLabel = isSoftwareItem ? "Visit website" : "View on Amazon";
    const missingLinkLabel = isSoftwareItem ? "Website link coming soon" : "Amazon link coming soon";

    return (
      <StaggerItem as="article" key={item.id} className="group relative flex flex-col pt-14" data-testid="setup-item">
        {item.image_url ? (
          <img
            className="setup-float-img setup-item-img"
            src={mediaUrl(item.image_url)}
            style={imageScaleStyle(item.image_scale)}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="setup-float-img setup-item-img flex items-center justify-center text-ink-3">
            <PackageOpen className="h-12 w-12" />
          </div>
        )}
        <div
          className={`setup-card lg flex flex-1 flex-col rounded-[28px] px-5 pb-5 pt-[204px] ${item.background ? "ui-surface" : ""}`}
          style={item.background ? { background: item.background } : undefined}
        >
          {item.price_note ? <span className="chip mb-2.5 w-fit bg-[rgb(var(--tint)/0.14)] text-tint">{item.price_note}</span> : null}
          <h3 className="font-display text-[1.2rem] font-semibold leading-snug tracking-[-0.02em] text-ink">{item.name}</h3>
          {item.description ? <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{item.description}</p> : null}
          <div className="mt-auto pt-5">
            {item.price ? (
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-[1.6rem] font-bold tracking-[-0.03em] text-ink">{item.price}</span>
                {usdEstimate ? <span className="text-[13px] text-ink-3">{usdEstimate}</span> : null}
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              {item.amazon_url ? (
                <a href={item.amazon_url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                  {isSoftwareItem ? <ExternalLink /> : <ShoppingBag />}
                  {linkLabel}
                </a>
              ) : (
                <span className="text-[13px] text-ink-3">{missingLinkLabel}</span>
              )}
              {canEdit ? (
                <div className="ml-auto flex gap-1.5">
                  <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => editItem(item)} aria-label={`Edit ${item.name}`}>
                    <Edit3 />
                  </button>
                  <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem(item)} aria-label={`Delete ${item.name}`}>
                    <Trash2 />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </StaggerItem>
    );
  };

  const renderCategoryCard = (category, index) => {
    const count = (itemsByCategory[category.id] || []).length;
    return (
      <StaggerItem key={category.id} className="group relative pt-20" data-testid="setup-category">
        <button
          type="button"
          onClick={() => openCategory(category.id)}
          className={`setup-card lg lg-hover relative block h-[232px] w-full rounded-[28px] text-left ${category.background ? "ui-surface" : ""}`}
          style={category.background ? { background: category.background } : undefined}
        >
          {category.image_url ? (
            <img
              className="setup-float-img setup-category-img"
              src={mediaUrl(category.image_url)}
              style={imageScaleStyle(category.image_scale)}
              alt=""
              loading={index < 3 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={index < 3 ? "high" : "auto"}
            />
          ) : null}
          <span className="absolute inset-x-5 bottom-5 z-[4] block">
            <span className="chip bg-[rgb(var(--tint)/0.14)] tabular-nums text-tint">
              {count} {count === 1 ? "item" : "items"}
            </span>
            <span className="mt-2 flex items-end justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-display text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-ink">{category.name}</span>
                {category.description ? <span className="mt-0.5 block text-[14px] text-ink-2">{category.description}</span> : null}
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fill-2)] text-ink transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:scale-110">
                <ChevronRight className="h-4 w-4" />
              </span>
            </span>
          </span>
        </button>
        {canEdit ? (
          <div className="absolute right-4 top-24 z-[5] flex gap-1.5 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover:opacity-100">
            <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => editCategory(category)} aria-label={`Edit ${category.name}`}>
              <Edit3 />
            </button>
            <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => deleteCategory(category)} aria-label={`Delete ${category.name}`}>
              <Trash2 />
            </button>
          </div>
        ) : null}
      </StaggerItem>
    );
  };

  // Switching between the categories and one category's products: the view lifts away and the
  // next one rises in, de-blurring, like the rest of the site.
  const viewMotion = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 20, filter: "blur(10px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } },
        exit: { opacity: 0, y: -10, filter: "blur(6px)", transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } },
        transition: { duration: 0.7, ease: EASE_OUT },
      };
  const itemGrid = "grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="relative isolate min-h-screen overflow-clip px-4 pb-32 pt-5 sm:px-6" data-testid="setup-page">
      {/* The fade below also covers the aurora's lower edge (phones draw it without blur) */}
      <div className="aurora -z-10 !opacity-40" aria-hidden="true" style={{ inset: "-30% -10% auto", height: "90vh" }}>
        <span />
        <span />
        <span />
      </div>
      {/* MrBit's background photo, softened and faded into the page; black and white with the B&W theme */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[88vh] overflow-hidden" aria-hidden="true">
        {settings.background_url ? (
          <div className="ui-tint absolute inset-0">
            <motion.img
              src={mediaUrl(settings.background_url)}
              alt=""
              className="setup-backdrop h-full w-full object-cover"
              initial={reduce ? false : { opacity: 0, scale: 1.18 }}
              animate={{ opacity: 1, scale: 1.08 }}
              transition={{ duration: 1.8, ease: EASE_OUT }}
            />
          </div>
        ) : null}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgb(var(--canvas) / 0.3), rgb(var(--canvas) / 0.75) 60%, rgb(var(--canvas)) 96%)" }} />
      </div>

      <div className="mx-auto max-w-[1180px]">
        <motion.div
          className="flex items-center justify-between gap-3"
          initial={reduce ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        >
          <Link to="/" className="lg lg-hover group inline-flex h-12 items-center gap-2.5 rounded-full pl-1.5 pr-4" data-testid="setup-home-link">
            <img
              src="/apple-touch-icon.png"
              alt=""
              className="h-9 w-9 rounded-full object-cover shadow-[0_2px_10px_rgb(0_0_0/0.25)] transition-transform duration-700 ease-spring group-hover:rotate-[-8deg] group-hover:scale-105"
            />
            <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">Effects Academy</span>
          </Link>
          {canEdit ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditOpen((open) => !open)} data-testid="setup-edit-toggle">
              <Settings2 />
              {editOpen ? "Close editor" : "Edit setup page"}
            </button>
          ) : null}
        </motion.div>

        <header className="mx-auto mt-14 max-w-3xl text-center md:mt-20">
          <FadeText className="eyebrow" y={10} blur={0} duration={0.8}>
            MrBit setup
          </FadeText>
          <h1 className="display-lg mt-3 text-ink">
            <KineticText key={settings.title} text={settings.title} delay={0.1} />
          </h1>
          {settings.intro ? (
            <FadeText key={settings.intro} className="lede mx-auto mt-5 max-w-xl" y={14} blur={8} duration={1} delay={0.4}>
              {settings.intro}
            </FadeText>
          ) : null}
        </header>

        <motion.div
          className="sticky top-4 z-30 mx-auto mt-10 max-w-2xl"
          initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.55 }}
        >
          <LiquidGlass className="group flex h-12 items-center rounded-full pl-4 pr-1.5 focus-within:shadow-[var(--glass-shadow),0_0_0_4px_rgb(var(--tint)/0.16)]" edge={18} strength={34}>
            <Search className="h-[18px] w-[18px] shrink-0 text-ink-2 transition-colors duration-300 group-focus-within:text-tint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              aria-label="Search setup products"
              className="bare h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-ink outline-none placeholder:text-ink-3"
              data-testid="setup-search"
            />
            <AnimatePresence>
              {query ? (
                <motion.button
                  type="button"
                  onClick={() => setQuery("")}
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
        </motion.div>

        <div ref={contentRef} className="mt-12 md:mt-16">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading the setup list">
              {[0, 1, 2].map((key) => (
                <div key={key} className="skeleton mt-20 h-[232px] rounded-[28px]" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {selectedCategory ? (
                <motion.section key={selectedCategory.id} {...viewMotion}>
                  <BackButton onClick={() => openCategory("")} testId="setup-back">Categories</BackButton>
                  <p className="eyebrow tabular-nums">
                    {(itemsByCategory[selectedCategory.id] || []).length} products
                  </p>
                  <h2 className="display-md mt-1.5 text-ink">{selectedCategory.name}</h2>
                  {selectedCategory.description ? <p className="mt-2 text-[15px] text-ink-2">{selectedCategory.description}</p> : null}

                  {visibleItems.length ? (
                    <Stagger className={`mt-6 ${itemGrid}`}>{visibleItems.map((item) => renderSetupItemCard(item))}</Stagger>
                  ) : (
                    <SetupEmpty>No products match this search yet.</SetupEmpty>
                  )}
                </motion.section>
              ) : (
                <motion.section key="categories" {...viewMotion}>
                  {filteredCategories.length ? (
                    <Stagger className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredCategories.map((category, index) => renderCategoryCard(category, index))}
                    </Stagger>
                  ) : !queryText ? (
                    <SetupEmpty>
                      {canEdit ? "No setup categories yet. Open the editor and add the first one." : "The setup list is being built."}
                    </SetupEmpty>
                  ) : null}
                  {queryText && matchingItems.length ? (
                    <div className="mt-14">
                      <p className="eyebrow tabular-nums">
                        {matchingItems.length} matching {matchingItems.length === 1 ? "product" : "products"}
                      </p>
                      <Stagger className={`mt-2 ${itemGrid}`}>{matchingItems.map((item) => renderSetupItemCard(item))}</Stagger>
                    </div>
                  ) : null}
                  {queryText && !filteredCategories.length && !matchingItems.length ? (
                    <SetupEmpty>No categories or products match this search yet.</SetupEmpty>
                  ) : null}
                </motion.section>
              )}
            </AnimatePresence>
          )}
        </div>

        <AnimatePresence>
          {canEdit && editOpen ? (
            <motion.section
              ref={editorRef}
              className="mt-24 grid scroll-mt-24 grid-cols-1 gap-5 lg:grid-cols-2"
              initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              exit={{ opacity: 0, y: 12, filter: "blur(6px)", transition: { duration: 0.25 } }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
              data-testid="setup-editor"
            >
              <EditorCard title="Page settings" className="lg:col-span-2">
                <Field label="Title">
                  <Input value={settingsForm.title} onChange={(event) => setSettingsForm((form) => ({ ...form, title: event.target.value }))} />
                </Field>
                <Field label="Intro text">
                  <Textarea value={settingsForm.intro} onChange={(event) => setSettingsForm((form) => ({ ...form, intro: event.target.value }))} />
                </Field>
                <Field label="Background image URL">
                  <Input value={settingsForm.background_url} onChange={(event) => setSettingsForm((form) => ({ ...form, background_url: event.target.value }))} />
                </Field>
                <p className="text-[12.5px] text-ink-3">
                  Colours follow the visitor's appearance on Effects Academy (including Black &amp; White), so the page always matches the rest of the site.
                </p>
                <div className="flex flex-wrap gap-2">
                  <UploadButton
                    label={uploading === "page-bg" ? "Uploading..." : "Upload background"}
                    disabled={Boolean(uploading)}
                    onUpload={(file) => uploadImage(file, (url) => setSettingsForm((form) => ({ ...form, background_url: url })), "page-bg", "background")}
                  />
                  <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveSettings}>
                    <Save />
                    Save page
                  </button>
                </div>
              </EditorCard>

              <EditorCard title={editingCategoryId ? "Edit category" : "Add category"}>
                <Field label="Name">
                  <Input value={categoryForm.name} onChange={(event) => setCategoryForm((form) => ({ ...form, name: event.target.value }))} />
                </Field>
                <Field label="Description">
                  <Textarea value={categoryForm.description} onChange={(event) => setCategoryForm((form) => ({ ...form, description: event.target.value }))} />
                </Field>
                <Field label="Image URL">
                  <Input value={categoryForm.image_url} onChange={(event) => setCategoryForm((form) => ({ ...form, image_url: event.target.value }))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Image scale">
                    <Input
                      type="number"
                      min="0.35"
                      max="2.5"
                      step="0.05"
                      value={categoryForm.image_scale}
                      onChange={(event) => setCategoryForm((form) => ({ ...form, image_scale: event.target.value }))}
                    />
                  </Field>
                  <Field label="Sort order">
                    <Input type="number" value={categoryForm.sort_order} onChange={(event) => setCategoryForm((form) => ({ ...form, sort_order: event.target.value }))} />
                  </Field>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[var(--fill)] p-3.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[rgb(var(--tint))]"
                    checked={Boolean(categoryForm.is_software)}
                    onChange={(event) => setCategoryForm((form) => ({ ...form, is_software: event.target.checked }))}
                  />
                  <span>
                    <strong className="block text-[14px] font-semibold text-ink">Software</strong>
                    <small className="text-[12.5px] text-ink-3">Use website links instead of Amazon buttons for items in this category.</small>
                  </span>
                </label>
                <Field label="Card background (optional)">
                  <Input value={categoryForm.background} onChange={(event) => setCategoryForm((form) => ({ ...form, background: event.target.value }))} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <UploadButton
                    label={uploading === "category" ? "Uploading..." : "Upload category image"}
                    disabled={Boolean(uploading)}
                    onUpload={(file) => uploadImage(file, (url) => setCategoryForm((form) => ({ ...form, image_url: url })), "category", "category")}
                  />
                  <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveCategory}>
                    <ImagePlus />
                    {editingCategoryId ? "Save category" : "Add category"}
                  </button>
                  {editingCategoryId ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingCategoryId(""); setCategoryForm(EMPTY_CATEGORY); }}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </EditorCard>

              <EditorCard title={editingItemId ? "Edit item" : "Add item"}>
                <Field label="Category">
                  <select
                    className="h-10 rounded-xl border border-[var(--line)] bg-[var(--fill)] px-3 text-[14px] text-ink outline-none focus:shadow-[0_0_0_3px_rgb(var(--tint)/0.25)]"
                    value={itemForm.category_id}
                    onChange={(event) => setItemForm((form) => ({ ...form, category_id: event.target.value }))}
                  >
                    <option value="">Choose category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Product name">
                  <Input value={itemForm.name} onChange={(event) => setItemForm((form) => ({ ...form, name: event.target.value }))} />
                </Field>
                <Field label="Description">
                  <Textarea value={itemForm.description} onChange={(event) => setItemForm((form) => ({ ...form, description: event.target.value }))} />
                </Field>
                <Field label={itemFormIsSoftware ? "Website link" : "Amazon link"}>
                  <Input value={itemForm.amazon_url} onChange={(event) => setItemForm((form) => ({ ...form, amazon_url: event.target.value }))} />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Price">
                    <Input value={itemForm.price} placeholder="$129.99" onChange={(event) => setItemForm((form) => ({ ...form, price: event.target.value }))} />
                  </Field>
                  <Field label="Price note">
                    <Input value={itemForm.price_note} onChange={(event) => setItemForm((form) => ({ ...form, price_note: event.target.value }))} />
                  </Field>
                  <Field label="Sort order">
                    <Input type="number" value={itemForm.sort_order} onChange={(event) => setItemForm((form) => ({ ...form, sort_order: event.target.value }))} />
                  </Field>
                </div>
                <Field label="Image URL">
                  <Input value={itemForm.image_url} onChange={(event) => setItemForm((form) => ({ ...form, image_url: event.target.value }))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Image scale">
                    <Input
                      type="number"
                      min="0.35"
                      max="2.5"
                      step="0.05"
                      value={itemForm.image_scale}
                      onChange={(event) => setItemForm((form) => ({ ...form, image_scale: event.target.value }))}
                    />
                  </Field>
                  <Field label="Card background (optional)">
                    <Input value={itemForm.background} onChange={(event) => setItemForm((form) => ({ ...form, background: event.target.value }))} />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <UploadButton
                    label={uploading === "item" ? "Uploading..." : "Upload item image"}
                    disabled={Boolean(uploading)}
                    onUpload={(file) => uploadImage(file, (url) => setItemForm((form) => ({ ...form, image_url: url })), "item", "item")}
                  />
                  <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveItem}>
                    <PackageOpen />
                    {editingItemId ? "Save item" : "Add item"}
                  </button>
                  {editingItemId ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingItemId(""); setItemForm({ ...EMPTY_ITEM, category_id: itemForm.category_id }); }}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </EditorCard>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
