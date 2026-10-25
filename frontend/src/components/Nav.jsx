import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock, Upload, LogOut, UserCircle, Crown, Settings2, Check, BarChart3, BadgePercent, ChevronRight } from "lucide-react";
import DiscordIcon from "@/components/DiscordIcon";
import TwitchIcon from "@/components/TwitchIcon";
import LiquidGlass from "@/components/LiquidGlass";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useUploadAccess } from "@/lib/uploadAccess";
import AccessUploadModal from "@/components/AccessUploadModal";
import UploadModal from "@/components/UploadModal";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { EASE_OUT, SPRING } from "@/lib/motion";

const ASSETS_CHANGED_EVENT = "effectsacademy:assets-changed";

const THEME_OPTIONS = [
  { value: "dark", label: "Dark", note: "Default" },
  { value: "blue", label: "Light" },
  { value: "gray", label: "Gray" },
];

const FONT_OPTIONS = [
  { value: "system", label: "San Francisco", note: "Default" },
  { value: "outfit", label: "Outfit" },
  { value: "space", label: "Space Grotesk" },
  { value: "mono", label: "JetBrains Mono" },
];

const PRIMARY_TABS = [
  { to: "/", label: "Browse" },
  { to: "/category/premium", label: "Premium" },
  { to: "/category/videos", label: "Videos" },
  { to: "/convert", label: "Converter" },
];

const MORE_TABS = [
  { to: "/category/torrents", label: "Torrents" },
  { to: "/category/project-files", label: "Project Files" },
  { to: "/category/overlays", label: "Overlays" },
  { to: "/category/audios", label: "Audios" },
  { to: "/category/sound-fx", label: "Sound FX" },
  { to: "/category/presets", label: "Presets" },
  { to: "/dmca", label: "DMCA" },
  { to: "/suggestions", label: "Suggestions" },
];

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function IconButton({ as: Tag = "button", className = "", children, ...props }) {
  return (
    <Tag
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition-[color,background-color,transform] duration-300 ease-spring hover:bg-[var(--fill-2)] hover:text-ink active:scale-90 ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

const FONT_FAMILIES = {
  system: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif",
  outfit: "'Outfit', sans-serif",
  space: "'Space Grotesk', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

function SettingsGroup({ title, options, value, onSelect, testPrefix, previewFonts = false }) {
  return (
    <div className="px-1 pb-1">
      <div className="px-2.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</div>
      {options.map((option) => (
        <DropdownMenuItem
          key={option.value}
          onClick={() => onSelect(option.value)}
          className="flex cursor-pointer items-center justify-between gap-6 rounded-xl px-2.5 py-2 text-[0.9rem] text-ink focus:bg-[var(--fill-2)] focus:text-ink"
          data-testid={`${testPrefix}-${option.value}`}
        >
          <span style={previewFonts ? { fontFamily: FONT_FAMILIES[option.value] } : undefined}>
            {option.label}
            {option.note ? <span className="ml-1.5 text-ink-3">{option.note}</span> : null}
          </span>
          <Check className={`h-4 w-4 text-tint transition-opacity duration-200 ${value === option.value ? "opacity-100" : "opacity-0"}`} />
        </DropdownMenuItem>
      ))}
    </div>
  );
}

const menuItemClass =
  "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-[0.9rem] text-ink focus:bg-[var(--fill-2)] focus:text-ink [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-ink-2";

/*
 * Everything account-related lives behind one avatar: plan, Stats for
 * moderators, upload access and sign out. Keeps the bar to a few icons.
 */
function AccountMenu({ user, hasPremium, canViewStats, isUploader, localPasswordEnabled, onAccessUpload, onLockUploader, onLogout }) {
  const navigate = useNavigate();
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fill-2)] text-[14px] font-semibold text-ink transition-transform duration-300 ease-spring hover:scale-105 active:scale-90"
          data-testid="nav-account-button"
          title={user.email ? `Signed in as ${user.email}` : "Signed in"}
          aria-label="Account menu"
        >
          {user.picture ? <img src={user.picture} alt="" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" /> : initial}
          {hasPremium && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ffb340] text-black shadow-[0_0_0_2px_rgb(var(--panel))]">
              <Crown className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="glass min-w-64 rounded-[22px] border-0 p-1.5 text-ink" align="end" sideOffset={14}>
        <div className="px-2.5 pb-2.5 pt-2">
          <p className="truncate text-[14px] font-semibold text-ink">{user.name || "Signed in"}</p>
          <p className="truncate text-[12.5px] text-ink-3">{user.email}</p>
          <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${hasPremium ? "bg-[#ffb340]/15 text-[#c27a00] dark:text-[#ffb340]" : "bg-[var(--fill-2)] text-ink-2"}`}>
            {hasPremium ? <><Crown className="h-3 w-3" /> Premium</> : "Free plan"}
          </span>
        </div>
        <DropdownMenuSeparator className="mx-2.5 my-1 h-px bg-[var(--line)]" />
        <DropdownMenuItem className={menuItemClass} onClick={() => navigate("/premium")}>
          {hasPremium ? <Crown /> : <UserCircle />}
          {hasPremium ? "Manage Premium" : "Get Premium"}
        </DropdownMenuItem>
        {canViewStats && (
          <DropdownMenuItem className={menuItemClass} onClick={() => navigate("/stats")} data-testid="nav-tab-stats">
            <BarChart3 /> Stats
          </DropdownMenuItem>
        )}
        {!isUploader && (
          <DropdownMenuItem className={menuItemClass} onClick={onAccessUpload} data-testid="access-upload-btn">
            <Lock /> Access Upload
          </DropdownMenuItem>
        )}
        {isUploader && localPasswordEnabled && (
          <DropdownMenuItem className={menuItemClass} onClick={onLockUploader} data-testid="lock-uploader-btn">
            <Lock /> Lock uploader
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="mx-2.5 my-1 h-px bg-[var(--line)]" />
        <DropdownMenuItem className={menuItemClass} onClick={onLogout} data-testid="nav-sign-out">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Segmented({ options, value, onSelect, layoutId }) {
  return (
    <div className="relative flex rounded-full bg-[var(--fill)] p-1">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={`relative z-10 flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-300 ${active ? "text-ink" : "text-ink-2"}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-full bg-panel shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_var(--line)]"
                transition={SPRING}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Nav() {
  const { isUploader, lock, localPasswordEnabled } = useUploadAccess();
  const { user, hasPremium, logout, config } = useAuth();
  const { theme, setTheme, font, setFont } = useTheme();
  const [accessOpen, setAccessOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const scrolled = useScrolled();
  const reduce = useReducedMotion();
  const canViewStats = ["Admin", "Uploader"].includes(user?.role);
  const activePromotion = config?.active_premium_promotion;
  const promotionPercent = Number(activePromotion?.percent_off || 0);
  const showPromotionBanner = Boolean(activePromotion && promotionPercent > 0);
  const tabs = [...PRIMARY_TABS, ...(canViewStats ? [{ to: "/stats", label: "Stats", icon: BarChart3 }] : [])];

  useEffect(() => setMobileOpen(false), [pathname]);

  // Sticky page toolbars sit just under the floating nav (and the promo strip when shown).
  useEffect(() => {
    document.documentElement.style.setProperty("--sticky-top", showPromotionBanner ? "6.75rem" : "5.25rem");
  }, [showPromotionBanner]);

  const lockUploader = () => {
    lock();
    toast.success("Locked uploader session.");
  };

  const notifyAssetsChanged = () => {
    window.dispatchEvent(new Event(ASSETS_CHANGED_EVENT));
  };

  const isTabActive = (to) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <>
      {showPromotionBanner && (
        <Link
          to="/premium"
          className="promo-sale-banner group fixed inset-x-0 top-0 z-[60] flex h-9 items-center justify-center gap-2 bg-panel-2/90 px-4 text-center text-[13px] text-ink backdrop-blur-xl"
          style={{ boxShadow: "inset 0 -1px 0 var(--line)" }}
          data-testid="premium-promotion-banner"
        >
          <BadgePercent className="h-3.5 w-3.5 shrink-0 text-tint" />
          <span className="truncate">
            {activePromotion.name || "Premium sale"} Premium promotion · {promotionPercent}% off
          </span>
          <span className="link-more hidden text-[13px] sm:inline-flex">
            Get Premium <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}

      <header
        className={`pointer-events-none fixed inset-x-0 z-50 px-3 transition-[top] duration-500 ease-out-expo sm:px-5 ${
          showPromotionBanner ? "promo-nav-offset top-[2.9rem]" : "top-3"
        }`}
        data-testid="main-nav"
      >
        <motion.div
          className="pointer-events-auto mx-auto"
          initial={reduce ? false : { y: -24, opacity: 0, filter: "blur(8px)" }}
          animate={{
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            maxWidth: scrolled ? 1080 : 1240,
            transitionEnd: { filter: "none" },
          }}
          transition={{ ...SPRING, opacity: { duration: 0.6, ease: EASE_OUT }, filter: { duration: 0.6, ease: EASE_OUT } }}
        >
          <LiquidGlass
            className={`rounded-full transition-[height,box-shadow] duration-500 ease-out-expo ${scrolled ? "h-[3.25rem]" : "h-14"}`}
            edge={20}
            strength={42}
          >
            <div className="relative flex h-full items-center gap-2 pl-2 pr-2 sm:pl-2.5">
              <Link
                to="/"
                className="group relative z-10 flex shrink-0 items-center gap-2.5 rounded-full py-1 pl-0.5 pr-3 transition-transform duration-500 ease-spring active:scale-95"
                data-testid="nav-logo"
              >
                <img
                  src="/apple-touch-icon.png"
                  alt="Effects Academy"
                  className="h-9 w-9 flex-shrink-0 rounded-full object-cover shadow-[0_2px_10px_rgb(0_0_0/0.25)] transition-transform duration-700 ease-spring group-hover:rotate-[-8deg] group-hover:scale-105"
                />
                <span className="hidden font-display text-[15px] font-semibold tracking-[-0.02em] text-ink sm:inline">
                  Effects Academy
                </span>
              </Link>

              <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex" aria-label="Primary">
                {PRIMARY_TABS.map((t) => {
                  const active = isTabActive(t.to);
                  return (
                    <NavLink
                      key={t.to}
                      to={t.to}
                      end={t.to === "/"}
                      className={`relative whitespace-nowrap rounded-full px-3.5 py-[7px] text-[13.5px] font-medium tracking-[-0.01em] transition-colors duration-300 ${
                        active ? "text-ink" : "text-ink-2 hover:text-ink"
                      }`}
                      data-testid={`nav-tab-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active-lens"
                          className="absolute inset-0 rounded-full bg-[var(--fill-2)] shadow-[inset_0_0.5px_0_rgb(255_255_255/0.35),inset_0_0_0_0.5px_var(--line)]"
                          transition={SPRING}
                        />
                      )}
                      <span className="relative">{t.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5 lg:ml-0">
                <IconButton
                  as="a"
                  href="https://discord.gg/2VvMq3Pz85"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden hover:!text-[#5865F2] sm:inline-flex"
                  data-testid="nav-discord-link"
                  title="Discord"
                  aria-label="Discord"
                >
                  <DiscordIcon className="h-[18px] w-[18px]" />
                </IconButton>

                <IconButton
                  as={Link}
                  to="/premium"
                  className="hidden hover:!text-[#9146FF] sm:inline-flex"
                  data-testid="nav-twitch-link"
                  title="Twitch subscriber discount"
                  aria-label="Twitch subscriber discount"
                >
                  <TwitchIcon className="h-[16px] w-[16px]" />
                </IconButton>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton className="hidden sm:inline-flex" data-testid="nav-settings" title="Appearance" aria-label="Appearance settings">
                      <Settings2 className="h-[17px] w-[17px]" />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="glass min-w-56 rounded-[22px] border-0 p-1.5 text-ink" align="end" sideOffset={14}>
                    <SettingsGroup title="Appearance" options={THEME_OPTIONS} value={theme} onSelect={setTheme} testPrefix="theme" />
                    <div className="mx-2.5 my-1 h-px bg-[var(--line)]" />
                    <SettingsGroup title="Font" options={FONT_OPTIONS} value={font} onSelect={setFont} testPrefix="font" previewFonts />
                  </DropdownMenuContent>
                </DropdownMenu>

                {isUploader && (
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className="btn btn-sm btn-secondary mx-0.5 h-9 px-3 xl:px-3.5"
                    data-testid="open-upload-btn"
                    title="Upload"
                  >
                    <Upload /> <span className="hidden xl:inline">Upload</span>
                  </button>
                )}

                {user ? (
                  <AccountMenu
                    user={user}
                    hasPremium={hasPremium}
                    canViewStats={canViewStats}
                    isUploader={isUploader}
                    localPasswordEnabled={localPasswordEnabled}
                    onAccessUpload={() => setAccessOpen(true)}
                    onLockUploader={lockUploader}
                    onLogout={logout}
                  />
                ) : (
                  <>
                    {isUploader && localPasswordEnabled ? (
                      <IconButton onClick={lockUploader} data-testid="lock-uploader-btn" title="Lock uploader" aria-label="Lock uploader">
                        <LogOut className="h-4 w-4" />
                      </IconButton>
                    ) : null}
                    {!isUploader ? (
                      <IconButton onClick={() => setAccessOpen(true)} data-testid="access-upload-btn" title="Access Upload" aria-label="Access Upload">
                        <Lock className="h-4 w-4" />
                      </IconButton>
                    ) : null}
                    <Link to="/login" className="btn btn-sm btn-primary ml-1 hidden h-9 md:inline-flex" data-testid="nav-sign-in">
                      Sign in
                    </Link>
                  </>
                )}

                <IconButton
                  onClick={() => setMobileOpen((v) => !v)}
                  className="lg:hidden"
                  data-testid="mobile-menu-toggle"
                  aria-expanded={mobileOpen}
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                >
                  <span className="relative block h-3 w-4">
                    <motion.span
                      className="absolute left-0 top-0 block h-[1.5px] w-4 rounded-full bg-current"
                      animate={mobileOpen ? { y: 5.25, rotate: 45 } : { y: 0, rotate: 0 }}
                      transition={SPRING}
                    />
                    <motion.span
                      className="absolute bottom-0 left-0 block h-[1.5px] w-4 rounded-full bg-current"
                      animate={mobileOpen ? { y: -5.25, rotate: -45 } : { y: 0, rotate: 0 }}
                      transition={SPRING}
                    />
                  </span>
                </IconButton>
              </div>
            </div>
          </LiquidGlass>

          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                key="mobile-menu"
                className="glass mt-2 overflow-hidden rounded-[28px] lg:hidden"
                initial={{ opacity: 0, y: -12, scale: 0.97, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(6px)", transition: { duration: 0.22 } }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                style={{ transformOrigin: "top center" }}
              >
                <motion.nav
                  className="grid grid-cols-2 gap-1 p-3 sm:grid-cols-3"
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.025, delayChildren: 0.06 } } }}
                >
                  {[...tabs, ...MORE_TABS].map((t) => (
                    <motion.div
                      key={t.to}
                      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } } }}
                    >
                      <NavLink
                        to={t.to}
                        end={t.to === "/"}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center justify-between rounded-2xl px-3.5 py-3 text-[15px] font-medium transition-colors duration-200 ${
                            isActive ? "bg-[var(--fill-2)] text-ink" : "text-ink-2 hover:bg-[var(--fill)] hover:text-ink"
                          }`
                        }
                      >
                        {t.label}
                        <ChevronRight className="h-4 w-4 text-ink-3" />
                      </NavLink>
                    </motion.div>
                  ))}
                </motion.nav>

                <div className="space-y-3 border-t border-[var(--line)] p-4">
                  {!user ? (
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="btn btn-primary btn-block md:hidden">
                      <UserCircle /> Sign in
                    </Link>
                  ) : (
                    <div className="flex gap-2 md:hidden">
                      <Link to="/premium" onClick={() => setMobileOpen(false)} className="btn btn-secondary flex-1">
                        {hasPremium ? <Crown className="text-[#ffb340]" /> : <UserCircle />} {hasPremium ? "Premium" : "Account"}
                      </Link>
                      <button type="button" onClick={logout} className="btn btn-secondary btn-icon" aria-label="Sign out">
                        <LogOut />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2 sm:hidden">
                    <Link to="/premium" onClick={() => setMobileOpen(false)} className="btn btn-secondary flex-1">
                      <TwitchIcon className="h-4 w-4" /> Twitch
                    </Link>
                    <a href="https://discord.gg/2VvMq3Pz85" target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex-1">
                      <DiscordIcon className="h-4 w-4" /> Discord
                    </a>
                  </div>
                  <div className="grid gap-2 pt-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                      <Settings2 className="h-3.5 w-3.5" /> Appearance
                    </p>
                    <Segmented options={THEME_OPTIONS} value={theme} onSelect={setTheme} layoutId="m-theme" />
                    <Segmented options={FONT_OPTIONS.map((o) => ({ ...o, label: o.value === "system" ? "SF" : o.label.split(" ")[0] }))} value={font} onSelect={setFont} layoutId="m-font" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AccessUploadModal open={accessOpen} onOpenChange={setAccessOpen} />
        <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} onSaved={notifyAssetsChanged} />
      </header>
    </>
  );
}
