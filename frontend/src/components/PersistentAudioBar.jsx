import { Pause, Play, Volume2, VolumeX, Repeat } from "lucide-react";
import {
  seekGlobalAudio,
  setGlobalLooping,
  setGlobalVolume,
  toggleGlobalAudio,
  toggleGlobalMute,
  useGlobalAudio,
} from "@/lib/globalAudio";

function fmt(t) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function PersistentAudioBar() {
  const audio = useGlobalAudio();

  if (!audio.src) return null;

  const pct = audio.duration > 0 ? Math.min(100, (audio.progress / audio.duration) * 100) : 0;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:inset-x-6 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#08080d]/90 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl overflow-hidden">
        <div className="px-4 py-3 md:px-5 md:py-4">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={toggleGlobalAudio}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center btn-press shrink-0 shadow-lg shadow-white/10"
              aria-label={audio.playing ? "Pause audio" : "Play audio"}
            >
              {audio.playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm md:text-base text-white truncate">
                    {audio.title || "Audio preview"}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {audio.loading ? "Loading audio..." : audio.subtitle || "Playing from EffectsAcademy"}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-zinc-500 tabular-nums shrink-0">
                  <span>{fmt(audio.progress)}</span>
                  <span className="text-zinc-700">/</span>
                  <span>{fmt(audio.duration)}</span>
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={audio.duration || 0}
                step={0.01}
                value={audio.progress}
                onChange={(e) => seekGlobalAudio(parseFloat(e.target.value))}
                onInput={(e) => seekGlobalAudio(parseFloat(e.target.value))}
                disabled={!audio.duration}
                className="audio-slider audio-slider-progress w-full"
                style={{ "--pct": `${pct}%` }}
                aria-label="Audio progress"
              />

              <div className="mt-2 flex sm:hidden items-center justify-between text-[11px] font-mono text-zinc-500 tabular-nums">
                <span>{fmt(audio.progress)}</span>
                <span>{fmt(audio.duration)}</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setGlobalLooping(!audio.looping)}
                className={`${audio.looping ? "text-neon bg-neon/10 border-neon/30" : "text-zinc-400 hover:text-white border-white/10"} border rounded-lg w-9 h-9 flex items-center justify-center btn-press`}
                title={audio.looping ? "Loop is on" : "Loop is off"}
                aria-pressed={audio.looping}
              >
                <Repeat className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={toggleGlobalMute}
                className="text-zinc-400 hover:text-white btn-press"
                aria-label={audio.muted ? "Unmute audio" : "Mute audio"}
              >
                {audio.muted || audio.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={audio.muted ? 0 : audio.volume}
                onChange={(e) => setGlobalVolume(parseFloat(e.target.value))}
                className="audio-slider audio-slider-volume w-24"
                style={{ "--pct": `${(audio.muted ? 0 : audio.volume) * 100}%` }}
                aria-label="Audio volume"
              />
            </div>
          </div>

          <div className="mt-3 flex md:hidden items-center justify-between gap-3 border-t border-white/5 pt-3">
            <button
              type="button"
              onClick={() => setGlobalLooping(!audio.looping)}
              className={`${audio.looping ? "text-neon bg-neon/10 border-neon/30" : "text-zinc-400 hover:text-white border-white/10"} border rounded-lg px-3 h-8 flex items-center gap-2 text-xs btn-press`}
              aria-pressed={audio.looping}
            >
              <Repeat className="w-4 h-4" /> Loop
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleGlobalMute}
                className="text-zinc-400 hover:text-white btn-press"
                aria-label={audio.muted ? "Unmute audio" : "Mute audio"}
              >
                {audio.muted || audio.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={audio.muted ? 0 : audio.volume}
                onChange={(e) => setGlobalVolume(parseFloat(e.target.value))}
                className="audio-slider audio-slider-volume w-24"
                style={{ "--pct": `${(audio.muted ? 0 : audio.volume) * 100}%` }}
                aria-label="Audio volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
