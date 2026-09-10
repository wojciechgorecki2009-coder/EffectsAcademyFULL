import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Edit3, ExternalLink, ImagePlus, PackageOpen, Save, Search, Settings2, ShoppingBag, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { api, FILE_BASE } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
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
    <label className={`setup-upload-chip ${disabled ? "is-disabled" : ""}`}>
      <UploadCloud size={15} />
      <span>{label}</span>
      <input
        type="file"
        accept="image/*"
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

export default function SetupPage() {
  const { theme } = useTheme();
  const setupPageRef = useRef(null);
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

  const styleClass = "setup-style-apple";
  const themeClass = `setup-theme-${theme || "blue"}`;

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

  const handlePointerMove = (event) => {
    const page = setupPageRef.current;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    page.style.setProperty("--setup-bg-shift-x", `${x * 18}px`);
    page.style.setProperty("--setup-bg-shift-y", `${y * 14}px`);
    page.style.setProperty("--setup-bg-wash-shift-x", `${x * -6}px`);
    page.style.setProperty("--setup-bg-wash-shift-y", `${y * -5}px`);
  };

  const handlePointerLeave = () => {
    const page = setupPageRef.current;
    if (!page) return;
    page.style.setProperty("--setup-bg-shift-x", "0px");
    page.style.setProperty("--setup-bg-shift-y", "0px");
    page.style.setProperty("--setup-bg-wash-shift-x", "0px");
    page.style.setProperty("--setup-bg-wash-shift-y", "0px");
  };

  const renderSetupItemCard = (item) => {
    const itemCategory = categoryById[item.category_id];
    const usdEstimate = usdEstimateFromPrice(item.price);
    const isSoftwareItem = Boolean(itemCategory?.is_software);
    const linkLabel = isSoftwareItem ? "Visit website" : "View on Amazon";
    const missingLinkLabel = isSoftwareItem ? "Website link coming soon" : "Amazon link coming soon";

    return (
      <article
        className="setup-item-card"
        key={item.id}
        style={{
          background: item.background || "var(--setup-item-bg)",
          ...imageScaleStyle(item.image_scale),
        }}
      >
        {item.image_url ? (
          <img src={mediaUrl(item.image_url)} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="setup-image-placeholder">
            <PackageOpen size={44} />
          </div>
        )}
        <div className="setup-item-body">
          {item.price_note ? <span className="setup-pill">{item.price_note}</span> : null}
          <h3>{item.name}</h3>
          {item.description ? <p>{item.description}</p> : null}
          {item.price ? (
            <div className="setup-product-price">
              <span>{item.price}</span>
              {usdEstimate ? <span className="setup-product-usd">{usdEstimate}</span> : null}
            </div>
          ) : null}
          <div className="setup-item-actions">
            {item.amazon_url ? (
              <a href={item.amazon_url} target="_blank" rel="noreferrer">
                {isSoftwareItem ? <ExternalLink size={17} /> : <ShoppingBag size={17} />}
                {linkLabel}
              </a>
            ) : (
              <span className="setup-muted-link">{missingLinkLabel}</span>
            )}
            {canEdit ? (
              <div className="setup-mod-actions">
                <button type="button" onClick={() => editItem(item)} aria-label={`Edit ${item.name}`}>
                  <Edit3 size={16} />
                </button>
                <button type="button" onClick={() => deleteItem(item)} aria-label={`Delete ${item.name}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  return (
    <section
      ref={setupPageRef}
      className={`setup-page ${styleClass} ${themeClass}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        "--setup-bg-shift-x": "0px",
        "--setup-bg-shift-y": "0px",
        "--setup-bg-wash-shift-x": "0px",
        "--setup-bg-wash-shift-y": "0px",
        "--setup-accent": settings.accent_color || DEFAULT_SETTINGS.accent_color,
        "--setup-base": settings.background_color || DEFAULT_SETTINGS.background_color,
        "--setup-item-bg": settings.item_background || DEFAULT_SETTINGS.item_background,
      }}
    >
      {settings.background_url ? (
        <div
          className="setup-bg-image"
          style={{ backgroundImage: `url("${mediaUrl(settings.background_url)}")` }}
        />
      ) : null}

      <main className="setup-shell">
        {canEdit ? (
          <Button className="setup-edit-float" onClick={() => setEditOpen((open) => !open)}>
            <Settings2 size={16} />
            {editOpen ? "Close editor" : "Edit setup page"}
          </Button>
        ) : null}

        <header className="setup-hero">
          <p className="setup-kicker">MRBIT SETUP</p>
          <h1>{settings.title}</h1>
          <p>{settings.intro}</p>
        </header>

        <label className="setup-search" aria-label="Search setup products">
          <Search size={22} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
          />
        </label>

        {loading ? (
          <div className="setup-empty">Loading the setup list...</div>
        ) : selectedCategory ? (
          <section className="setup-content">
            <div className="setup-section-head">
              <button type="button" onClick={() => setSelectedCategoryId("")}>
                <ArrowLeft size={18} />
                Categories
              </button>
              <div>
                <h2>{selectedCategory.name}</h2>
                {selectedCategory.description ? <p>{selectedCategory.description}</p> : null}
              </div>
            </div>

            {visibleItems.length ? (
              <div className="setup-item-grid">
                {visibleItems.map((item) => renderSetupItemCard(item))}
              </div>
            ) : (
              <div className="setup-empty">No products match this search yet.</div>
            )}
          </section>
        ) : (
          <section className="setup-content">
            {filteredCategories.length ? (
              <div className="setup-category-grid">
                {filteredCategories.map((category, index) => (
                  <article
                    className="setup-category-card"
                    key={category.id}
                    style={{
                      background: category.background || "var(--setup-item-bg)",
                      ...imageScaleStyle(category.image_scale),
                    }}
                    onClick={() => setSelectedCategoryId(category.id)}
                  >
                    {category.image_url ? (
                      <img
                        src={mediaUrl(category.image_url)}
                        alt=""
                        loading={index < 3 ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={index < 3 ? "high" : "auto"}
                      />
                    ) : null}
                    <div className="setup-category-body">
                      <span>{(itemsByCategory[category.id] || []).length} items</span>
                      <h2>{category.name}</h2>
                      {category.description ? <p>{category.description}</p> : null}
                    </div>
                    {canEdit ? (
                      <div className="setup-mod-actions setup-category-mod" onClick={(event) => event.stopPropagation()}>
                        <button type="button" onClick={() => editCategory(category)} aria-label={`Edit ${category.name}`}>
                          <Edit3 size={16} />
                        </button>
                        <button type="button" onClick={() => deleteCategory(category)} aria-label={`Delete ${category.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : !queryText || !matchingItems.length ? (
              <div className="setup-empty">
                {canEdit
                  ? "No setup categories yet. Open the editor and add the first one."
                  : "The setup list is being built."}
              </div>
            ) : null}
            {queryText && matchingItems.length ? (
              <div className="setup-search-products">
                <div className="setup-item-grid">
                  {matchingItems.map((item) => renderSetupItemCard(item))}
                </div>
              </div>
            ) : null}
            {queryText && !filteredCategories.length && !matchingItems.length ? (
              <div className="setup-empty">No categories or products match this search yet.</div>
            ) : null}
          </section>
        )}

        {canEdit && editOpen ? (
          <section className="setup-editor">
            <div className="setup-editor-card setup-editor-wide">
              <h2>Page settings</h2>
              <div className="setup-form-grid">
                <label>
                  Title
                  <Input value={settingsForm.title} onChange={(event) => setSettingsForm((form) => ({ ...form, title: event.target.value }))} />
                </label>
                <label>
                  Accent color
                  <Input value={settingsForm.accent_color} onChange={(event) => setSettingsForm((form) => ({ ...form, accent_color: event.target.value }))} />
                </label>
                <label>
                  Background color
                  <Input value={settingsForm.background_color} onChange={(event) => setSettingsForm((form) => ({ ...form, background_color: event.target.value }))} />
                </label>
                <label>
                  Item background
                  <Input value={settingsForm.item_background} onChange={(event) => setSettingsForm((form) => ({ ...form, item_background: event.target.value }))} />
                </label>
              </div>
              <label>
                Intro text
                <Textarea value={settingsForm.intro} onChange={(event) => setSettingsForm((form) => ({ ...form, intro: event.target.value }))} />
              </label>
              <label>
                Background image URL
                <Input value={settingsForm.background_url} onChange={(event) => setSettingsForm((form) => ({ ...form, background_url: event.target.value }))} />
              </label>
              <div className="setup-editor-actions">
                <UploadButton
                  label={uploading === "page-bg" ? "Uploading..." : "Upload background"}
                  disabled={Boolean(uploading)}
                  onUpload={(file) => uploadImage(file, (url) => setSettingsForm((form) => ({ ...form, background_url: url })), "page-bg", "background")}
                />
                <Button disabled={saving} onClick={saveSettings}>
                  <Save size={16} />
                  Save page
                </Button>
              </div>
            </div>

            <div className="setup-editor-card">
              <h2>{editingCategoryId ? "Edit category" : "Add category"}</h2>
              <label>
                Name
                <Input value={categoryForm.name} onChange={(event) => setCategoryForm((form) => ({ ...form, name: event.target.value }))} />
              </label>
              <label>
                Description
                <Textarea value={categoryForm.description} onChange={(event) => setCategoryForm((form) => ({ ...form, description: event.target.value }))} />
              </label>
              <label>
                Image URL
                <Input value={categoryForm.image_url} onChange={(event) => setCategoryForm((form) => ({ ...form, image_url: event.target.value }))} />
              </label>
              <label>
                Image scale
                <Input
                  type="number"
                  min="0.35"
                  max="2.5"
                  step="0.05"
                  value={categoryForm.image_scale}
                  onChange={(event) => setCategoryForm((form) => ({ ...form, image_scale: event.target.value }))}
                />
              </label>
              <label className="setup-checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(categoryForm.is_software)}
                  onChange={(event) => setCategoryForm((form) => ({ ...form, is_software: event.target.checked }))}
                />
                <span>
                  <strong>Software</strong>
                  <small>Use website links instead of Amazon buttons for items in this category.</small>
                </span>
              </label>
              <label>
                Card background
                <Input value={categoryForm.background} onChange={(event) => setCategoryForm((form) => ({ ...form, background: event.target.value }))} />
              </label>
              <label>
                Sort order
                <Input type="number" value={categoryForm.sort_order} onChange={(event) => setCategoryForm((form) => ({ ...form, sort_order: event.target.value }))} />
              </label>
              <div className="setup-editor-actions">
                <UploadButton
                  label={uploading === "category" ? "Uploading..." : "Upload category image"}
                  disabled={Boolean(uploading)}
                  onUpload={(file) => uploadImage(file, (url) => setCategoryForm((form) => ({ ...form, image_url: url })), "category", "category")}
                />
                <Button disabled={saving} onClick={saveCategory}>
                  <ImagePlus size={16} />
                  {editingCategoryId ? "Save category" : "Add category"}
                </Button>
                {editingCategoryId ? (
                  <Button variant="ghost" onClick={() => { setEditingCategoryId(""); setCategoryForm(EMPTY_CATEGORY); }}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="setup-editor-card">
              <h2>{editingItemId ? "Edit item" : "Add item"}</h2>
              <label>
                Category
                <select value={itemForm.category_id} onChange={(event) => setItemForm((form) => ({ ...form, category_id: event.target.value }))}>
                  <option value="">Choose category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Product name
                <Input value={itemForm.name} onChange={(event) => setItemForm((form) => ({ ...form, name: event.target.value }))} />
              </label>
              <label>
                Description
                <Textarea value={itemForm.description} onChange={(event) => setItemForm((form) => ({ ...form, description: event.target.value }))} />
              </label>
              <label>
                {itemFormIsSoftware ? "Website link" : "Amazon link"}
                <Input value={itemForm.amazon_url} onChange={(event) => setItemForm((form) => ({ ...form, amazon_url: event.target.value }))} />
              </label>
              <div className="setup-form-grid">
                <label>
                  Price
                  <Input value={itemForm.price} placeholder="$129.99" onChange={(event) => setItemForm((form) => ({ ...form, price: event.target.value }))} />
                </label>
                <label>
                  Price note
                  <Input value={itemForm.price_note} onChange={(event) => setItemForm((form) => ({ ...form, price_note: event.target.value }))} />
                </label>
                <label>
                  Sort order
                  <Input type="number" value={itemForm.sort_order} onChange={(event) => setItemForm((form) => ({ ...form, sort_order: event.target.value }))} />
                </label>
              </div>
              <label>
                Image URL
                <Input value={itemForm.image_url} onChange={(event) => setItemForm((form) => ({ ...form, image_url: event.target.value }))} />
              </label>
              <label>
                Image scale
                <Input
                  type="number"
                  min="0.35"
                  max="2.5"
                  step="0.05"
                  value={itemForm.image_scale}
                  onChange={(event) => setItemForm((form) => ({ ...form, image_scale: event.target.value }))}
                />
              </label>
              <label>
                Card background
                <Input value={itemForm.background} onChange={(event) => setItemForm((form) => ({ ...form, background: event.target.value }))} />
              </label>
              <div className="setup-editor-actions">
                <UploadButton
                  label={uploading === "item" ? "Uploading..." : "Upload item image"}
                  disabled={Boolean(uploading)}
                  onUpload={(file) => uploadImage(file, (url) => setItemForm((form) => ({ ...form, image_url: url })), "item", "item")}
                />
                <Button disabled={saving} onClick={saveItem}>
                  <PackageOpen size={16} />
                  {editingItemId ? "Save item" : "Add item"}
                </Button>
                {editingItemId ? (
                  <Button variant="ghost" onClick={() => { setEditingItemId(""); setItemForm({ ...EMPTY_ITEM, category_id: itemForm.category_id }); }}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </section>
  );
}
