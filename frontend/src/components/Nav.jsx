import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Lock, ChevronDown, Menu, Upload, LogOut, UserCircle, Crown, Settings, Check, BarChart3 } from "lucide-react";
import DiscordIcon from "@/components/DiscordIcon";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useUploadAccess } from "@/lib/uploadAccess";
import AccessUploadModal from "@/components/AccessUploadModal";
import UploadModal from "@/components/UploadModal";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const ASSETS_CHANGED_EVENT = "effectsacademy:assets-changed";

const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "blue", label: "Blue", note: "Default" },
  { value: "gray", label: "Gray" },
];

const FONT_OPTIONS = [
  { value: "space", label: "Space Grotesk" },
  { value: "outfit", label: "Outfit", note: "Default" },
  { value: "mono", label: "JetBrains Mono" },
];

const PRIMARY_TABS = [
  { to: "/", label: "Browse" },
  { to: "/category/torrents", label: "Torrents" },
  { to: "/category/project-files", label: "Project Files" },
  { to: "/category/overlays", label: "Overlays" },
  { to: "/category/audios", label: "Audios" },
  { to: "/category/videos", label: "Videos" },
  { to: "/ai-image", label: "AI Tools" },
];

const MORE_TABS = [
  { to: "/category/sound-fx", label: "Sound FX" },
  { to: "/category/presets", label: "Presets" },
  { to: "/category/premium", label: "Premium" },
  { to: "/dmca", label: "DMCA" },
  { to: "/suggestions", label: "Suggestions" },
];

export default function Nav() {
  const { isUploader, lock, localPasswordEnabled } = useUploadAccess();
  const { user, hasPremium, logout } = useAuth();
  const { theme, setTheme, font, setFont } = useTheme();
  const [accessOpen, setAccessOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const canViewStats = ["Admin", "Uploader"].includes(user?.role);

  const tabClass = ({ isActive }) =>
    `relative whitespace-nowrap px-2.5 py-1.5 text-sm font-medium rounded-lg btn-press ${
      isActive
        ? "text-white bg-white/10"
        : "text-zinc-400 hover:text-white hover:bg-white/5"
    }`;

  const notifyAssetsChanged = () => {
    window.dispatchEvent(new Event(ASSETS_CHANGED_EVENT));
  };

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 glass"
      data-testid="main-nav"
    >
      <div className="relative max-w-[1500px] mx-auto px-4 md:px-7 h-16 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <Link
          to="/"
          className="relative z-10 flex items-center gap-2 btn-press shrink-0"
          data-testid="nav-logo"
        >
          <img
            src="/apple-touch-icon.png"
            alt="Effects Academy"
            className="h-11 w-11 rounded-full object-cover flex-shrink-0"
            style={{ filter: "drop-shadow(0 0 14px rgba(82,87,255,0.5))" }}
          />
          <span className="font-display font-bold tracking-tight text-base">
            Effects<span className="text-neon">Academy</span>
          </span>
        </Link>

        <nav className="hidden xl:flex min-w-0 items-center justify-center gap-0.5 px-2">
          {PRIMARY_TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={tabClass}
              data-testid={`nav-tab-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {t.label}
            </NavLink>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="whitespace-nowrap px-2.5 py-1.5 text-sm font-medium rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 btn-press flex items-center gap-1"
                data-testid="nav-tab-more"
              >
                More <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="glass border-white/10 text-white"
              align="end"
            >
              {canViewStats && (
                <DropdownMenuItem
                  onClick={() => navigate("/stats")}
                  className="cursor-pointer hover:bg-white/10 focus:bg-white/10"
                  data-testid="nav-more-stats"
                >
                  <span className="inline-flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5" /> Stats
                  </span>
                </DropdownMenuItem>
              )}
              {MORE_TABS.map((t) => (
                <DropdownMenuItem
                  key={t.to}
                  onClick={() => navigate(t.to)}
                  className="cursor-pointer hover:bg-white/10 focus:bg-white/10"
                  data-testid={`nav-more-${t.label.toLowerCase()}`}
                >
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="whitespace-nowrap px-2.5 py-1.5 text-sm font-medium rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 btn-press flex items-center gap-1.5"
                data-testid="nav-settings"
              >
                <Settings className="w-3.5 h-3.5" /> Settings
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="glass border-white/10 text-white min-w-44" align="end">
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">Site theme</div>
              {THEME_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className="cursor-pointer hover:bg-white/10 focus:bg-white/10 flex items-center justify-between gap-4"
                  data-testid={`theme-${option.value}`}
                >
                  <span>{option.label}{option.note ? <span className="text-zinc-500 ml-1">({option.note})</span> : null}</span>
                  {theme === option.value && <Check className="w-4 h-4 text-neon" />}
                </DropdownMenuItem>
              ))}
              <div className="mx-2 my-1 border-t border-white/10" />
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">Site font</div>
              {FONT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setFont(option.value)}
                  className="cursor-pointer hover:bg-white/10 focus:bg-white/10 flex items-center justify-between gap-4"
                  data-testid={`font-${option.value}`}
                >
                  <span>{option.label}{option.note ? <span className="text-zinc-500 ml-1">({option.note})</span> : null}</span>
                  {font === option.value && <Check className="w-4 h-4 text-neon" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="relative z-10 flex flex-nowrap items-center justify-end gap-2 min-w-0">
          {!isUploader ? (
            <Button
              onClick={() => setAccessOpen(true)}
              variant="ghost"
              className="shrink-0 whitespace-nowrap border border-white/10 text-white bg-white/[0.03] hover:bg-white/10 rounded-lg btn-press"
              data-testid="access-upload-btn"
            >
              <Lock className="w-4 h-4 mr-2" />
              Access Upload
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setUploadOpen(true)}
                className="bg-neon text-[#05050A] hover:bg-neon/90 font-semibold rounded-lg btn-press"
                data-testid="open-upload-btn"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
              {localPasswordEnabled && (
                <Button
                  onClick={() => {
                    lock();
                    toast.success("Locked uploader session.");
                  }}
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-white hover:bg-white/10 btn-press"
                  data-testid="lock-uploader-btn"
                  title="Lock uploader"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </>
          )}

          {user ? (
            <div className="hidden md:flex shrink-0 items-center gap-1">
              <button
                onClick={() => navigate("/premium")}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/10 text-sm btn-press"
                data-testid="nav-account-button"
                title={user.email ? `Signed in as ${user.email}` : "Signed in"}
              >
                {hasPremium ? <Crown className="w-4 h-4 text-purple-300" /> : <UserCircle className="w-4 h-4" />}
                {hasPremium ? "Premium" : "Signed in"}
              </button>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10"
                title="Sign out"
                data-testid="nav-sign-out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden md:inline-flex shrink-0 whitespace-nowrap items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/10 text-sm btn-press"
              data-testid="nav-sign-in"
            >
              <UserCircle className="w-4 h-4" /> Sign in
            </Link>
          )}

          <a
            href="https://discord.gg/2VvMq3Pz85"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex shrink-0 whitespace-nowrap items-center gap-2 bg-discord hover:bg-[#4752C4] text-white px-4 py-2 rounded-lg text-sm font-semibold btn-press"
            data-testid="nav-discord-link"
          >
            <DiscordIcon className="w-[18px] h-[18px]" />
            Discord
          </a>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="xl:hidden text-white p-2 rounded-md hover:bg-white/10 btn-press"
            data-testid="mobile-menu-toggle"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="xl:hidden border-t border-white/5 px-4 py-3 flex flex-wrap gap-2">
          {[...PRIMARY_TABS, ...(canViewStats ? [{ to: "/stats", label: "Stats" }] : []), ...MORE_TABS].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={tabClass}
            >
              {t.label}
            </NavLink>
          ))}
          <div className="w-full mt-2 pt-3 border-t border-white/5 flex items-center gap-2">
            <span className="text-xs text-zinc-500 mr-1 flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> Theme</span>
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`px-3 py-1.5 rounded-lg text-xs border btn-press ${theme === option.value ? "bg-neon/20 border-neon/40 text-white" : "bg-white/5 border-white/10 text-zinc-400"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="w-full pt-2 flex items-center gap-2">
            <span className="text-xs text-zinc-500 mr-1">Font</span>
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFont(option.value)}
                className={`px-3 py-1.5 rounded-lg text-xs border btn-press ${font === option.value ? "bg-neon/20 border-neon/40 text-white" : "bg-white/5 border-white/10 text-zinc-400"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <AccessUploadModal open={accessOpen} onOpenChange={setAccessOpen} />
      <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} onSaved={notifyAssetsChanged} />
    </header>
  );
}
