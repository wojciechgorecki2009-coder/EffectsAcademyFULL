import { useEffect, useRef, useState } from "react";
import { Download, Headphones, Music2, SlidersHorizontal, Sparkles, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";

const SPEEDS = [
  { label: "Normal", value: 1 },
  { label: "0.9x", value: 0.9 },
  { label: "0.8x", value: 0.8 },
  { label: "0.7x", value: 0.7 },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

function audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i += 1) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = clamp(buffer.getChannelData(channel)[i], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function processAudioBuffer(inputBuffer, settings, selection) {
  const speed = settings.speed || 1;
  const outputLength = Math.max(1, Math.floor(inputBuffer.length / speed));
  const output = new AudioBuffer({
    length: outputLength,
    numberOfChannels: inputBuffer.numberOfChannels,
    sampleRate: inputBuffer.sampleRate,
  });
  const selectionStart = selection[0] * inputBuffer.length;
  const selectionEnd = selection[1] * inputBuffer.length;
  const delaySamples = Math.max(1, Math.floor(inputBuffer.sampleRate * 0.085));
  let peak = 0;

  for (let channel = 0; channel < inputBuffer.numberOfChannels; channel += 1) {
    const source = inputBuffer.getChannelData(channel);
    const target = output.getChannelData(channel);
    const delay = new Float32Array(delaySamples);
    let delayIndex = 0;
    let muffled = 0;
    let lowBass = 0;

    for (let i = 0; i < outputLength; i += 1) {
      const sourceIndex = i * speed;
      const indexA = Math.floor(sourceIndex);
      const indexB = Math.min(indexA + 1, source.length - 1);
      let sample = lerp(source[indexA] || 0, source[indexB] || 0, sourceIndex - indexA);
      const selected = sourceIndex >= selectionStart && sourceIndex <= selectionEnd;

      if (selected) {
        if (settings.muffle > 0) {
          const alpha = 0.04 + (1 - settings.muffle) * 0.22;
          muffled += alpha * (sample - muffled);
          sample = lerp(sample, muffled, settings.muffle);
        }

        if (settings.bass > 0) {
          lowBass += 0.035 * (sample - lowBass);
          sample += lowBass * settings.bass * 1.35;
        }

        if (settings.reverb > 0) {
          const delayed = delay[delayIndex];
          delay[delayIndex] = sample + delayed * 0.42;
          delayIndex = (delayIndex + 1) % delay.length;
          sample = sample * (1 - settings.reverb * 0.35) + delayed * settings.reverb;
        }
      }

      target[i] = sample;
      peak = Math.max(peak, Math.abs(sample));
    }
  }

  if (peak > 0.98) {
    const gain = 0.98 / peak;
    for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
      const target = output.getChannelData(channel);
      for (let i = 0; i < target.length; i += 1) target[i] *= gain;
    }
  }

  return output;
}

export default function AudioLabPage() {
  const canvasRef = useRef(null);
  const dragRef = useRef(false);
  const selectionAnchorRef = useRef(0);
  const [fileName, setFileName] = useState("");
  const [buffer, setBuffer] = useState(null);
  const [inputUrl, setInputUrl] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [selection, setSelection] = useState([0.12, 0.55]);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState({ speed: 1, reverb: 0.35, bass: 0.35, muffle: 0 });

  useEffect(() => {
    return () => {
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [inputUrl, outputUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "rgba(82, 87, 255, 0.95)");
    gradient.addColorStop(0.5, "rgba(168, 85, 247, 0.9)");
    gradient.addColorStop(1, "rgba(34, 211, 238, 0.9)");

    ctx.fillStyle = "rgba(255,255,255,0.035)";
    for (let x = 0; x < width; x += 48) ctx.fillRect(x, 0, 1, height);

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x += 1) {
      let min = 1;
      let max = -1;
      for (let j = 0; j < step; j += 1) {
        const datum = data[x * step + j] || 0;
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.moveTo(x, (1 + min) * amp);
      ctx.lineTo(x, (1 + max) * amp);
    }
    ctx.stroke();

    const sx = selection[0] * width;
    const sw = (selection[1] - selection[0]) * width;
    ctx.fillStyle = "rgba(82, 87, 255, 0.22)";
    ctx.fillRect(sx, 0, sw, height);
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.strokeRect(sx, 0.5, sw, height - 1);
  }, [buffer, selection]);

  const loadFile = async (file) => {
    if (!file) return;
    try {
      const objectUrl = URL.createObjectURL(file);
      const arrayBuffer = await file.arrayBuffer();
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
      await context.close();
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setInputUrl(objectUrl);
      setOutputUrl("");
      setFileName(file.name);
      setBuffer(decoded);
      setSelection([0.12, 0.55]);
      toast.success("Audio loaded into Audio Lab.");
    } catch {
      toast.error("Could not read that audio file.");
    }
  };

  const pointerToRatio = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return clamp((event.clientX - rect.left) / rect.width, 0, 1);
  };

  const startSelection = (event) => {
    if (!buffer) return;
    const ratio = pointerToRatio(event);
    selectionAnchorRef.current = ratio;
    dragRef.current = true;
    setSelection([ratio, ratio]);
  };

  const moveSelection = (event) => {
    if (!dragRef.current || !buffer) return;
    const ratio = pointerToRatio(event);
    setSelection([Math.min(selectionAnchorRef.current, ratio), Math.max(selectionAnchorRef.current, ratio)]);
  };

  const endSelection = () => {
    dragRef.current = false;
    setSelection((current) => {
      if (current[1] - current[0] < 0.01) return [0, 1];
      return current;
    });
  };

  const render = async () => {
    if (!buffer) return toast.error("Upload an audio file first.");
    setProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const processed = processAudioBuffer(buffer, settings, selection);
      const blob = audioBufferToWav(processed);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      toast.success("Preview rendered. Give it a listen.");
    } catch {
      toast.error("Could not process this audio.");
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!outputUrl) return toast.error("Render the edited audio first.");
    const a = document.createElement("a");
    a.href = outputUrl;
    a.download = `${titleFromFilename(fileName)}-audio-lab.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const selectedStart = buffer ? selection[0] * buffer.duration : 0;
  const selectedEnd = buffer ? selection[1] * buffer.duration : 0;

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-12 pt-28 pb-16" data-testid="audio-lab-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-neon/25 bg-neon/10 px-4 py-1.5 text-sm text-neon">
            <Wand2 className="w-4 h-4" /> Private browser tool
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black tracking-tighter mt-4">Audio Lab</h1>
          <p className="text-zinc-400 max-w-2xl mt-3">
            Upload a song privately, select a part of the timeline, add quick effects, preview it, then download your edit. Nothing here is published to EffectsAcademy.
          </p>
        </div>
        <label className="cursor-pointer rounded-xl bg-neon hover:bg-neon/90 text-white font-bold px-5 py-3 btn-press inline-flex items-center gap-2">
          <Upload className="w-4 h-4" /> Upload audio
          <input type="file" accept="audio/*" hidden onChange={(e) => loadFile(e.target.files?.[0])} />
        </label>
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-6">
        <div className="rounded-3xl border border-white/10 bg-[var(--site-panel)] p-5 md:p-6 overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-neon/10 border border-neon/20 flex items-center justify-center">
                <Music2 className="w-5 h-5 text-neon" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{fileName || "No audio loaded yet"}</p>
                <p className="text-sm text-zinc-500">
                  {buffer ? `${formatTime(buffer.duration)} • selected ${formatTime(selectedStart)} - ${formatTime(selectedEnd)}` : "Choose an MP3, WAV, or audio file to begin"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">
              <span>Timeline</span>
              <span>{buffer ? "Drag across the waveform to select a section" : "Waiting for upload"}</span>
            </div>
            <canvas
              ref={canvasRef}
              width={1200}
              height={260}
              onPointerDown={startSelection}
              onPointerMove={moveSelection}
              onPointerUp={endSelection}
              onPointerLeave={endSelection}
              className="w-full h-56 rounded-xl bg-[#05050A] border border-white/5 cursor-crosshair"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-2">
              <span>0:00</span>
              <span>{buffer ? formatTime(buffer.duration) : "0:00"}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Headphones className="w-4 h-4 text-neon" /> Original preview</p>
              {inputUrl ? <audio controls src={inputUrl} className="w-full" /> : <p className="text-sm text-zinc-500">Upload a file to preview it here.</p>}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-300" /> Edited preview</p>
              {outputUrl ? <audio controls src={outputUrl} className="w-full" /> : <p className="text-sm text-zinc-500">Render your edit to preview the result.</p>}
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-white/10 bg-[var(--site-panel)] p-5 md:p-6 h-fit">
          <h2 className="font-display text-2xl font-bold flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-neon" /> Quick effects</h2>
          <p className="text-sm text-zinc-500 mt-1">Effects apply to the highlighted timeline section.</p>

          <div className="space-y-5 mt-6">
            <div>
              <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">Speed</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {SPEEDS.map((speed) => (
                  <button
                    key={speed.value}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, speed: speed.value }))}
                    className={`rounded-lg border px-2 py-2 text-sm btn-press ${settings.speed === speed.value ? "bg-neon text-white border-neon" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"}`}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>

            <EffectSlider label="Reverb" value={settings.reverb} onChange={(value) => setSettings((s) => ({ ...s, reverb: value }))} />
            <EffectSlider label="Bass" value={settings.bass} onChange={(value) => setSettings((s) => ({ ...s, bass: value }))} />
            <EffectSlider label="Muffle" value={settings.muffle} onChange={(value) => setSettings((s) => ({ ...s, muffle: value }))} />

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSettings({ speed: 1, reverb: 0.35, bass: 0.35, muffle: 0 })}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm font-semibold btn-press"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setSelection([0, 1])}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm font-semibold btn-press"
              >
                Select all
              </button>
            </div>

            <button
              type="button"
              onClick={render}
              disabled={!buffer || processing}
              className="w-full rounded-xl bg-neon hover:bg-neon/90 disabled:bg-white/10 disabled:text-zinc-500 text-white font-bold py-3.5 btn-press"
              data-testid="audio-lab-render"
            >
              {processing ? "Rendering..." : "Render preview"}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!outputUrl}
              className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white font-bold py-3.5 btn-press inline-flex items-center justify-center gap-2"
              data-testid="audio-lab-download"
            >
              <Download className="w-4 h-4" /> Download WAV
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function EffectSlider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">{label}</label>
        <span className="text-xs text-zinc-500">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#5257FF] mt-2"
      />
    </div>
  );
}
