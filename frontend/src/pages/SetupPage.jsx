import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Edit3, ImagePlus, PackageOpen, Save, Search, Settings2, ShoppingBag, Trash2, UploadCloud } from "lucide-react";
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
  background_url: "",
  background_color: "#5F438C",
  item_background: "rgba(38,38,42,0.82)",
  accent_color: "#A78BFA",
};

const EMPTY_CATEGORY = {
  name: "",
  description: "",
  image_url: "",
  background: "",
  sort_order: 0,
};

const EMPTY_ITEM = {
  category_id: "",
  name: "",
  description: "",
  image_url: "",
  amazon_url: "",
  price_note: "",
  background: "",
  sort_order: 0,
};

function mediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return `${FILE_BASE}${url}`;
}

function normalizeNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
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
  const { siteStyle, theme } = useTheme();
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
  const categories = data.categories || [];
  const items = data.items || [];
  const canEdit = Boolean(data.can_edit);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  const styleClass = siteStyle === "apple" ? "setup-style-apple" : siteStyle === "sleek" ? "setup-style-sleek" : "setup-style-default";
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

  const uploadImage = async (file, onUrl, label) => {
    setUploading(label);
    try {
      const formData = new FormData();
      formData.append("file", file);
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
      const payload = { ...categoryForm, sort_order: normalizeNumber(categoryForm.sort_order) };
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
      amazon_url: item.amazon_url || "",
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

  const filteredCategories = useMemo(() => {
    if (!queryText) return categories;
    return categories.filter((category) => {
      const categoryMatch = `${category.name} ${category.description}`.toLowerCase().includes(queryText);
      const itemMatch = (itemsByCategory[category.id] || []).some((item) =>
        `${item.name} ${item.description} ${item.price_note}`.toLowerCase().includes(queryText)
      );
      return categoryMatch || itemMatch;
    });
  }, [categories, itemsByCategory, queryText]);

  const visibleItems = useMemo(() => {
    const scoped = selectedCategory ? itemsByCategory[selectedCategory.id] || [] : [];
    if (!queryText) return scoped;
    return scoped.filter((item) =>
      `${item.name} ${item.description} ${item.price_note}`.toLowerCase().includes(queryText)
    );
  }, [itemsByCategory, queryText, selectedCategory]);

  return (
    <section
      className={`setup-page ${styleClass} ${themeClass}`}
      style={{
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
      <div className="setup-bg-wash" />

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
                {visibleItems.map((item) => (
                  <article
                    className="setup-item-card"
                    key={item.id}
                    style={{ background: item.background || "var(--setup-item-bg)" }}
                  >
                    {item.image_url ? (
                      <img src={mediaUrl(item.image_url)} alt="" />
                    ) : (
                      <div className="setup-image-placeholder">
                        <PackageOpen size={44} />
                      </div>
                    )}
                    <div className="setup-item-body">
                      {item.price_note ? <span className="setup-pill">{item.price_note}</span> : null}
                      <h3>{item.name}</h3>
                      {item.description ? <p>{item.description}</p> : null}
                      <div className="setup-item-actions">
                        {item.amazon_url ? (
                          <a href={item.amazon_url} target="_blank" rel="noreferrer">
                            <ShoppingBag size={17} />
                            View on Amazon
                          </a>
                        ) : (
                          <span className="setup-muted-link">Amazon link coming soon</span>
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
                ))}
              </div>
            ) : (
              <div className="setup-empty">No products match this search yet.</div>
            )}
          </section>
        ) : (
          <section className="setup-content">
            {filteredCategories.length ? (
              <div className="setup-category-grid">
                {filteredCategories.map((category) => (
                  <article
                    className="setup-category-card"
                    key={category.id}
                    style={{ background: category.background || "var(--setup-item-bg)" }}
                    onClick={() => setSelectedCategoryId(category.id)}
                  >
                    {category.image_url ? <img src={mediaUrl(category.image_url)} alt="" /> : null}
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
            ) : (
              <div className="setup-empty">
                {canEdit
                  ? "No setup categories yet. Open the editor and add the first one."
                  : "The setup list is being built."}
              </div>
            )}
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
                  onUpload={(file) => uploadImage(file, (url) => setSettingsForm((form) => ({ ...form, background_url: url })), "page-bg")}
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
                  onUpload={(file) => uploadImage(file, (url) => setCategoryForm((form) => ({ ...form, image_url: url })), "category")}
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
                Amazon link
                <Input value={itemForm.amazon_url} onChange={(event) => setItemForm((form) => ({ ...form, amazon_url: event.target.value }))} />
              </label>
              <div className="setup-form-grid">
                <label>
                  Price/note
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
                Card background
                <Input value={itemForm.background} onChange={(event) => setItemForm((form) => ({ ...form, background: event.target.value }))} />
              </label>
              <div className="setup-editor-actions">
                <UploadButton
                  label={uploading === "item" ? "Uploading..." : "Upload item image"}
                  disabled={Boolean(uploading)}
                  onUpload={(file) => uploadImage(file, (url) => setItemForm((form) => ({ ...form, image_url: url })), "item")}
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
