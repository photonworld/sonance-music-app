import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Disc3,
  Eye,
  FileAudio,
  Gem,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  crystallizeAcousticFossil,
  deleteAcousticFossil,
  loadAcousticFossils,
  saveAcousticFossil,
} from '../synesthesia/acousticFossil';
import { SynesthesiaAudioAnalyzer } from '../synesthesia/audioAnalyzer';
import { DEMO_JOURNEYS, DemoMusicSynthesizer } from '../synesthesia/demoAudioSynth';
import {
  requestSemanticDirectorPlan,
  resolveInterpolatedPhase,
} from '../synesthesia/emotionDirector';
import {
  buildDeterministicVisualSeed,
  computeSentimentSignature,
} from '../synesthesia/hashSeed';
import { getActiveLyricLine, parseLyrics } from '../synesthesia/lrcParser';
import { SynesthesiaRenderer } from '../synesthesia/synesthesiaRenderer';
import {
  triggerHapticLight,
  triggerHapticMedium,
  triggerHapticSelectionChanged,
  triggerHapticSelectionEnd,
  triggerHapticSelectionStart,
  triggerHapticSuccess,
} from '../utils/haptics';
import {
  AcousticFossil,
  DemoJourney,
  SyncedLyricLine,
  SynesthesiaDirectorPlan,
  SynesthesiaStoryboardPhase,
} from '../synesthesia/types';
import { formatDuration } from '../utils/audioMetadata';

interface SynesthesiaStudioProps {
  onPauseGlobalPlayer?: () => void;
  onShowNotice?: (message: string) => void;
}

type ActivePanel = 'none' | 'upload' | 'inspector' | 'gallery';

const STYLE_LABELS: Record<SynesthesiaDirectorPlan['visualStylePreset'], string> = {
  'bengali-monsoon': 'Bengali Monsoon · Watercolor & Petals',
  'sufi-lantern': 'Sufi Mysticism · Calligraphy & Lanterns',
  'cosmic-neon': 'Cosmic Neon · Stardust & Chrome',
};

const FossilConstellationIcon: React.FC<{ fossil: AcousticFossil }> = ({ fossil }) => {
  const cx = 36;
  const cy = 36;
  const radiusBase = 21;
  const points = fossil.constellationAngles.map((ang, idx) => {
    const r = radiusBase * (0.62 + ((idx * 37) % 10) * 0.045);
    return {
      x: cx + Math.cos(ang) * r,
      y: cy + Math.sin(ang) * r,
    };
  });

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0" aria-hidden="true">
      <defs>
        <radialGradient id={`fg-${fossil.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={fossil.palette[2]} stopOpacity="0.85" />
          <stop offset="55%" stopColor={fossil.palette[0]} stopOpacity="0.35" />
          <stop offset="100%" stopColor={fossil.palette[3]} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r="32" fill={`url(#fg-${fossil.id})`} />
      {points.length > 2 && (
        <polygon
          points={points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill={fossil.palette[0]}
          fillOpacity="0.16"
          stroke={fossil.palette[2]}
          strokeWidth="1.2"
        />
      )}
      {points.map((p, idx) => (
        <g key={idx}>
          <line
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke={fossil.palette[1]}
            strokeOpacity="0.45"
            strokeWidth="0.9"
          />
          <circle cx={p.x} cy={p.y} r="2.2" fill={fossil.palette[2]} />
        </g>
      ))}
      <circle cx={cx} cy={cy} r="4" fill={fossil.palette[2]} />
    </svg>
  );
};

export const SynesthesiaStudio: React.FC<SynesthesiaStudioProps> = ({
  onPauseGlobalPlayer,
  onShowNotice,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const uploadedObjUrlRef = useRef<string | null>(null);

  const analyzerRef = useRef<SynesthesiaAudioAnalyzer | null>(null);
  const demoSynthRef = useRef<DemoMusicSynthesizer | null>(null);
  const rendererRef = useRef<SynesthesiaRenderer | null>(null);

  const [mode, setMode] = useState<'demo' | 'upload'>('demo');
  const [selectedJourney, setSelectedJourney] = useState<DemoJourney>(DEMO_JOURNEYS[0]);
  const [plan, setPlan] = useState<SynesthesiaDirectorPlan>(DEMO_JOURNEYS[0].directorPlan);
  const [lyricsText, setLyricsText] = useState<string>(DEMO_JOURNEYS[0].lrcLyrics);
  const [audioFingerprint, setAudioFingerprint] = useState<string>('demo-bengali-monsoon');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(DEMO_JOURNEYS[0].durationSeconds);
  const [volume, setVolume] = useState(0.85);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [fossils, setFossils] = useState<AcousticFossil[]>(() => loadAcousticFossils());

  // Upload form state
  const [uploadAudioFile, setUploadAudioFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadLyrics, setUploadLyrics] = useState('');
  const [analyzingUpload, setAnalyzingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Live inspector phase readout (throttled ~4Hz for DOM calm)
  const [activePhase, setActivePhase] = useState<SynesthesiaStoryboardPhase>(
    DEMO_JOURNEYS[0].directorPlan.storyboard[0]
  );

  // Spectral accumulation for Acoustic Fossil crystallization
  const spectralStatsRef = useRef({
    peakRms: 0.45,
    bassSum: 0,
    trebleSum: 0,
    samples: 0,
  });

  const hudIdleTimerRef = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const activePanelRef = useRef(activePanel);
  activePanelRef.current = activePanel;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const syncedLyrics: SyncedLyricLine[] = useMemo(
    () => parseLyrics(lyricsText, duration || plan.durationSeconds),
    [duration, lyricsText, plan.durationSeconds]
  );

  const visualSeed = useMemo(() => {
    const sentiment = computeSentimentSignature(lyricsText, plan.overallEmotion);
    return buildDeterministicVisualSeed(plan.songTitle, sentiment, audioFingerprint);
  }, [audioFingerprint, lyricsText, plan.overallEmotion, plan.songTitle]);

  const planRef = useRef(plan);
  planRef.current = plan;
  const syncedLyricsRef = useRef(syncedLyrics);
  syncedLyricsRef.current = syncedLyrics;
  const visualSeedRef = useRef(visualSeed);
  visualSeedRef.current = visualSeed;

  const resetHudIdleTimer = useCallback(() => {
    setHudVisible(true);
    if (hudIdleTimerRef.current !== null) {
      window.clearTimeout(hudIdleTimerRef.current);
      hudIdleTimerRef.current = null;
    }
    if (isPlayingRef.current && activePanelRef.current === 'none') {
      hudIdleTimerRef.current = window.setTimeout(() => {
        if (isPlayingRef.current && activePanelRef.current === 'none') {
          setHudVisible(false);
        }
      }, 3200);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying || activePanel !== 'none') {
      setHudVisible(true);
      if (hudIdleTimerRef.current !== null) {
        window.clearTimeout(hudIdleTimerRef.current);
        hudIdleTimerRef.current = null;
      }
      return;
    }
    resetHudIdleTimer();
  }, [activePanel, isPlaying, resetHudIdleTimer]);

  const handleCrystallizeSong = useCallback(
    (silent = false) => {
      const stats = spectralStatsRef.current;
      const count = Math.max(1, stats.samples);
      const fossil = crystallizeAcousticFossil(planRef.current, visualSeedRef.current, {
        peakRms: stats.peakRms,
        avgBass: stats.bassSum / count || 0.38,
        avgTreble: stats.trebleSum / count || 0.34,
      });
      const updated = saveAcousticFossil(fossil);
      setFossils(updated);
      if (!silent) {
        onShowNotice?.(`Crystallized "${fossil.songTitle}" into an Acoustic Fossil`);
      }
    },
    [onShowNotice]
  );

  // Initialize Web Audio Analyzer, Demo Synth, and WebGL + Canvas2D Renderer
  useEffect(() => {
    if (!glCanvasRef.current || !fxCanvasRef.current) return;

    const analyzer = new SynesthesiaAudioAnalyzer();
    const synth = new DemoMusicSynthesizer();
    const renderer = new SynesthesiaRenderer(glCanvasRef.current, fxCanvasRef.current);

    analyzerRef.current = analyzer;
    demoSynthRef.current = synth;
    rendererRef.current = renderer;

    synth.loadJourney(DEMO_JOURNEYS[0]);

    let rafId = 0;
    let lastDomPhaseSync = 0;

    const loop = (now: number) => {
      const playing = isPlayingRef.current;
      const metrics = analyzer.sample(playing);

      if (playing) {
        spectralStatsRef.current.peakRms = Math.max(spectralStatsRef.current.peakRms, metrics.rms);
        spectralStatsRef.current.bassSum += metrics.subBass;
        spectralStatsRef.current.trebleSum += metrics.trebleInstruments;
        spectralStatsRef.current.samples += 1;
      }

      const activeDur = Math.max(1, durationRef.current || planRef.current.durationSeconds || 1);
      const timeSec =
        modeRef.current === 'upload' && audioElRef.current
          ? audioElRef.current.currentTime
          : currentTimeRef.current;
      const progressRatio = Math.max(0, Math.min(1, timeSec / activeDur));

      const phase = resolveInterpolatedPhase(planRef.current, progressRatio);
      const activeLyric = getActiveLyricLine(syncedLyricsRef.current, timeSec);

      renderer.renderFrame({
        metrics,
        preset: planRef.current.visualStylePreset,
        phase,
        seed: visualSeedRef.current,
        activeLyric,
        isPlaying: playing,
      });

      if (now - lastDomPhaseSync > 260) {
        lastDomPhaseSync = now;
        setActivePhase(phase);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      synth.dispose();
      analyzer.dispose();
      if (uploadedObjUrlRef.current) {
        URL.revokeObjectURL(uploadedObjUrlRef.current);
        uploadedObjUrlRef.current = null;
      }
      if (hudIdleTimerRef.current !== null) {
        window.clearTimeout(hudIdleTimerRef.current);
      }
    };
  }, []);

  // Fullscreen state listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const pauseAllLocalPlayback = useCallback(() => {
    demoSynthRef.current?.pause();
    if (audioElRef.current && !audioElRef.current.paused) {
      audioElRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const handleTogglePlay = useCallback(async () => {
    const analyzer = analyzerRef.current;
    const synth = demoSynthRef.current;
    if (!analyzer || !synth) return;

    if (isPlaying) {
      pauseAllLocalPlayback();
      return;
    }

    onPauseGlobalPlayer?.();
    const ctx = analyzer.ensureContext();
    analyzer.setVolume(volume);

    if (mode === 'demo') {
      synth.connect(ctx, analyzer.getInputNode());
      if (currentTime >= duration - 0.3) {
        synth.seek(0);
        setCurrentTime(0);
      }
      setIsPlaying(true);
      synth.start(
        (sec) => {
          currentTimeRef.current = sec;
          setCurrentTime(sec);
        },
        () => {
          setIsPlaying(false);
          handleCrystallizeSong(false);
        }
      );
    } else if (audioElRef.current) {
      analyzer.attachMediaElement(audioElRef.current);
      try {
        await audioElRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Synesthesia audio playback error:', err);
        setIsPlaying(false);
      }
    }
  }, [
    currentTime,
    duration,
    handleCrystallizeSong,
    isPlaying,
    mode,
    onPauseGlobalPlayer,
    pauseAllLocalPlayback,
    volume,
  ]);

  const handleSelectDemoJourney = useCallback(
    (journey: DemoJourney, autoPlay = true) => {
      pauseAllLocalPlayback();
      if (uploadedObjUrlRef.current) {
        URL.revokeObjectURL(uploadedObjUrlRef.current);
        uploadedObjUrlRef.current = null;
      }
      setMode('demo');
      setSelectedJourney(journey);
      setPlan(journey.directorPlan);
      setLyricsText(journey.lrcLyrics);
      setAudioFingerprint(`demo-${journey.id}`);
      setDuration(journey.durationSeconds);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      setActivePhase(journey.directorPlan.storyboard[0]);
      spectralStatsRef.current = { peakRms: 0.45, bassSum: 0, trebleSum: 0, samples: 0 };

      const synth = demoSynthRef.current;
      const analyzer = analyzerRef.current;
      if (synth && analyzer) {
        synth.loadJourney(journey);
        if (autoPlay) {
          onPauseGlobalPlayer?.();
          const ctx = analyzer.ensureContext();
          analyzer.setVolume(volume);
          synth.connect(ctx, analyzer.getInputNode());
          setIsPlaying(true);
          synth.start(
            (sec) => {
              currentTimeRef.current = sec;
              setCurrentTime(sec);
            },
            () => {
              setIsPlaying(false);
              handleCrystallizeSong(false);
            }
          );
        }
      }
    },
    [handleCrystallizeSong, onPauseGlobalPlayer, pauseAllLocalPlayback, volume]
  );

  const handleSeek = useCallback(
    (nextSec: number) => {
      const clamped = Math.max(0, Math.min(duration || 1, nextSec));
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      if (mode === 'demo') {
        demoSynthRef.current?.seek(clamped);
      } else if (audioElRef.current) {
        audioElRef.current.currentTime = clamped;
      }
    },
    [duration, mode]
  );

  const handleVolumeChange = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolume(clamped);
    analyzerRef.current?.setVolume(clamped);
    if (audioElRef.current) {
      audioElRef.current.volume = clamped;
    }
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (!stageRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stageRef.current.requestFullscreen();
      }
    } catch {
      // ignore unsupported fullscreen errors
    }
  }, []);

  const handleLrcFilePick = async (file: File) => {
    try {
      const text = await file.text();
      setUploadLyrics(text);
    } catch {
      setUploadError('Could not read lyrics file.');
    }
  };

  const handleAnalyzeAndLaunchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadAudioFile) {
      setUploadError('Please select an audio file (.mp3, .wav, .ogg).');
      return;
    }

    setUploadError(null);
    setAnalyzingUpload(true);

    try {
      const analyzer = analyzerRef.current ?? new SynesthesiaAudioAnalyzer();
      analyzerRef.current = analyzer;
      const { durationSeconds, fingerprint } =
        await analyzer.extractFileFingerprint(uploadAudioFile);

      const cleanTitle =
        uploadTitle.trim() ||
        uploadAudioFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      const cleanArtist = uploadArtist.trim() || 'Independent Artist';

      const directorPlan = await requestSemanticDirectorPlan({
        title: cleanTitle,
        artist: cleanArtist,
        lyrics: uploadLyrics.trim(),
        durationSeconds,
        audioFingerprint: fingerprint,
      });

      pauseAllLocalPlayback();

      if (uploadedObjUrlRef.current) {
        URL.revokeObjectURL(uploadedObjUrlRef.current);
      }
      const nextUrl = URL.createObjectURL(uploadAudioFile);
      uploadedObjUrlRef.current = nextUrl;

      if (!audioElRef.current) {
        audioElRef.current = new Audio();
        audioElRef.current.crossOrigin = 'anonymous';
      }
      const audioEl = audioElRef.current;
      audioEl.src = nextUrl;
      audioEl.volume = volume;
      audioEl.ontimeupdate = () => {
        currentTimeRef.current = audioEl.currentTime;
        setCurrentTime(audioEl.currentTime);
      };
      audioEl.onloadedmetadata = () => {
        if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
          setDuration(audioEl.duration);
        }
      };
      audioEl.onended = () => {
        setIsPlaying(false);
        handleCrystallizeSong(false);
      };

      setMode('upload');
      setPlan(directorPlan);
      setLyricsText(uploadLyrics.trim());
      setAudioFingerprint(fingerprint);
      setDuration(directorPlan.durationSeconds || durationSeconds);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      setActivePhase(directorPlan.storyboard[0]);
      spectralStatsRef.current = { peakRms: 0.45, bassSum: 0, trebleSum: 0, samples: 0 };
      setActivePanel('none');

      onPauseGlobalPlayer?.();
      const ctx = analyzer.ensureContext();
      void ctx.resume();
      analyzer.setVolume(volume);
      analyzer.attachMediaElement(audioEl);
      await audioEl.play();
      setIsPlaying(true);
      onShowNotice?.(`Directed "${directorPlan.songTitle}" in ${STYLE_LABELS[directorPlan.visualStylePreset]}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Semantic Synesthesia analysis failed.';
      setUploadError(msg);
    } finally {
      setAnalyzingUpload(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Studio Quick Bar: 3 Cultural Demo Journeys */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Semantic Synesthesia Studio
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            AI lyric &amp; cultural physics visual universe synchronized to Sub-Bass, Vocals, and Treble harmonics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {DEMO_JOURNEYS.map((journey) => {
            const active = mode === 'demo' && selectedJourney.id === journey.id;
            return (
              <button
                key={journey.id}
                type="button"
                onClick={() => {
                  void triggerHapticMedium();
                  handleSelectDemoJourney(journey, true);
                }}
                className="sonance-press min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: active
                    ? 'var(--accent-primary)'
                    : 'color-mix(in srgb, var(--bg-surface) 74%, transparent)',
                  borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                  color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                }}
              >
                {journey.preset === 'bengali-monsoon'
                  ? 'Bengali Monsoon'
                  : journey.preset === 'sufi-lantern'
                    ? 'Sufi Mysticism'
                    : 'Cyberpunk Cosmic'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Generative Canvas Viewport */}
      <div
        ref={stageRef}
        onMouseMove={(e) => {
          resetHudIdleTimer();
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            rendererRef.current?.setPointer(
              (e.clientX - rect.left) / rect.width,
              (e.clientY - rect.top) / rect.height,
              true
            );
          }
        }}
        onMouseLeave={() => {
          rendererRef.current?.setPointer(0.5, 0.5, false);
        }}
        onTouchStart={(e) => {
          resetHudIdleTimer();
          const rect = e.currentTarget.getBoundingClientRect();
          const touch = e.touches[0];
          if (touch && rect.width > 0 && rect.height > 0) {
            rendererRef.current?.setPointer(
              (touch.clientX - rect.left) / rect.width,
              (touch.clientY - rect.top) / rect.height,
              true
            );
          }
        }}
        onTouchMove={(e) => {
          resetHudIdleTimer();
          const rect = e.currentTarget.getBoundingClientRect();
          const touch = e.touches[0];
          if (touch && rect.width > 0 && rect.height > 0) {
            rendererRef.current?.setPointer(
              (touch.clientX - rect.left) / rect.width,
              (touch.clientY - rect.top) / rect.height,
              true
            );
          }
        }}
        onTouchEnd={() => {
          rendererRef.current?.setPointer(0.5, 0.5, false);
        }}
        className={`relative w-full overflow-hidden border select-none ${
          isFullscreen ? 'h-screen rounded-none border-0' : 'h-[70vh] min-h-[520px] max-h-[780px] rounded-3xl'
        }`}
        style={{
          backgroundColor: '#040714',
          borderColor: 'rgba(255, 255, 255, 0.14)',
        }}
      >
        {/* Layer 1: WebGL GLSL Chladni + Cultural Fluid Shader */}
        <canvas
          ref={glCanvasRef}
          className="absolute inset-0 w-full h-full block"
          aria-hidden="true"
        />

        {/* Layer 2: Canvas2D Generative Particles, Soul Core, Gravitational Lensing & Kinetic Typography */}
        <canvas
          ref={fxCanvasRef}
          className="absolute inset-0 w-full h-full block"
          aria-label="Semantic Synesthesia Generative Music Canvas"
        />

        {/* Minimalist Floating Top HUD (auto-hides during playback inactivity) */}
        <div
          className={`absolute top-0 inset-x-0 z-20 p-4 sm:p-5 flex flex-wrap items-start justify-between gap-3 transition-opacity duration-500 ${
            hudVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="rounded-2xl bg-black/45 backdrop-blur-md border border-white/15 px-4 py-2.5 text-white max-w-md min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-white/70">
              <span>{STYLE_LABELS[plan.visualStylePreset]}</span>
              <span aria-hidden="true">·</span>
              <span>Seed #{visualSeed.hashHex.slice(0, 6)}</span>
            </div>
            <h2 className="font-display text-base sm:text-lg font-bold truncate mt-0.5">
              {plan.songTitle}
            </h2>
            <p className="text-xs text-white/75 truncate">
              {plan.artist} · {activePhase.phaseName} ({activePhase.emotionLabel})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                setActivePanel((p) => (p === 'upload' ? 'none' : 'upload'));
              }}
              className="sonance-press min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/15 text-xs font-semibold text-white whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Upload Audio + Lyrics</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                setActivePanel((p) => (p === 'inspector' ? 'none' : 'inspector'));
              }}
              className={`sonance-press min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl backdrop-blur-md border text-xs font-semibold text-white whitespace-nowrap shrink-0 ${
                activePanel === 'inspector'
                  ? 'bg-sky-500/80 border-sky-300/60'
                  : 'bg-black/45 hover:bg-black/65 border-white/15'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>AI Emotion Inspector</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                setActivePanel((p) => (p === 'gallery' ? 'none' : 'gallery'));
              }}
              className={`sonance-press min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl backdrop-blur-md border text-xs font-semibold text-white whitespace-nowrap shrink-0 ${
                activePanel === 'gallery'
                  ? 'bg-amber-500/80 border-amber-300/60'
                  : 'bg-black/45 hover:bg-black/65 border-white/15'
              }`}
            >
              <Gem className="w-3.5 h-3.5" />
              <span>Fossils ({fossils.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                void handleToggleFullscreen();
              }}
              aria-label={isFullscreen ? 'Exit fullscreen immersive mode' : 'Enter fullscreen immersive mode'}
              className="sonance-press min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/15 text-white shrink-0"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Floating Subtle Hint when Playing & HUD Hidden */}
        {!hudVisible && (
          <button
            type="button"
            onClick={resetHudIdleTimer}
            aria-label="Reveal controls"
            className="absolute bottom-4 right-4 z-10 w-10 h-10 rounded-full bg-black/30 hover:bg-black/55 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/75"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}

        {/* Minimalist Floating Bottom Transport HUD */}
        <div
          className={`absolute bottom-0 inset-x-0 z-20 p-4 sm:p-5 transition-opacity duration-500 ${
            hudVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="mx-auto max-w-3xl rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 px-4 py-3 text-white space-y-2.5">
            {/* Seekbar + Tabular Timestamps */}
            <div className="flex items-center gap-3">
              <span className="font-mono-tabular text-[11px] text-white/80 w-10 shrink-0">
                {formatDuration(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.2}
                value={Math.min(currentTime, duration || 1)}
                onMouseDown={() => void triggerHapticSelectionStart()}
                onTouchStart={() => void triggerHapticSelectionStart()}
                onChange={(e) => {
                  void triggerHapticSelectionChanged(75);
                  handleSeek(parseFloat(e.target.value));
                }}
                onMouseUp={() => void triggerHapticSelectionEnd()}
                onTouchEnd={() => void triggerHapticSelectionEnd()}
                aria-label="Synesthesia playback seekbar"
                className="sonance-slider flex-1"
                style={{
                  background: `linear-gradient(to right, ${activePhase.palette[2]} ${
                    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
                  }%, rgba(255,255,255,0.22) ${
                    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
                  }%)`,
                  height: '4px',
                  borderRadius: '9999px',
                }}
              />
              <span className="font-mono-tabular text-[11px] text-white/80 w-10 text-right shrink-0">
                {formatDuration(duration)}
              </span>
            </div>

            {/* Play/Pause, Active Metaphor & Volume */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticMedium();
                    void handleTogglePlay();
                  }}
                  aria-label={isPlaying ? 'Pause synesthesia playback' : 'Play synesthesia playback'}
                  className="sonance-press w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-slate-950 shadow-lg"
                  style={{ backgroundColor: activePhase.palette[2] }}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {activePhase.emotionLabel}
                  </p>
                  <p className="text-[11px] text-white/75 truncate">
                    {activePhase.visualMetaphor}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticSuccess();
                    handleCrystallizeSong(false);
                  }}
                  className="sonance-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Crystallize Fossil</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 w-28">
                  <Volume2 className="w-4 h-4 text-white/75 shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    aria-label="Synesthesia volume"
                    className="sonance-slider flex-1"
                    style={{
                      background: `linear-gradient(to right, #ffffff ${volume * 100}%, rgba(255,255,255,0.22) ${
                        volume * 100
                      }%)`,
                      height: '4px',
                      borderRadius: '9999px',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer 1: Upload Audio (.mp3/.wav/.ogg) + Lyrics (.lrc / text) */}
        {activePanel === 'upload' && (
          <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={handleAnalyzeAndLaunchUpload}
              className="w-full max-w-lg rounded-3xl bg-zinc-950/95 border border-white/15 p-5 sm:p-6 text-white space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">
                    Direct Custom Song Universe
                  </h3>
                  <p className="text-xs text-white/70">
                    Upload .mp3, .wav, or .ogg plus optional .lrc or plain lyrics for Gemini semantic direction.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePanel('none')}
                  aria-label="Close upload dialog"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <label className="block rounded-2xl border border-dashed border-white/25 hover:border-sky-400/70 p-4 cursor-pointer text-center bg-white/5 transition-colors">
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setUploadAudioFile(file);
                    if (file && !uploadTitle) {
                      setUploadTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
                    }
                  }}
                  className="hidden"
                />
                <FileAudio className="w-7 h-7 mx-auto mb-1.5 text-sky-400" />
                <p className="text-xs font-semibold">
                  {uploadAudioFile ? uploadAudioFile.name : 'Choose Audio File (.mp3, .wav, .ogg)'}
                </p>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-white/75 mb-1">
                    Song Title
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Amar Sonar Bangla / Midnight"
                    className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-white/75 mb-1">
                    Artist
                  </label>
                  <input
                    type="text"
                    value={uploadArtist}
                    onChange={(e) => setUploadArtist(e.target.value)}
                    placeholder="Artist name"
                    className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-white/75">
                    Lyrics (.lrc with timestamps or plain text)
                  </label>
                  <label className="text-[11px] font-semibold text-sky-400 hover:underline cursor-pointer">
                    Load .lrc / .txt file
                    <input
                      type="file"
                      accept=".lrc,.txt,text/plain"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleLrcFilePick(f);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={uploadLyrics}
                  onChange={(e) => setUploadLyrics(e.target.value)}
                  placeholder="[00:12.00] Paste Bengali, Hindi, English, or poetic lyrics..."
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-sky-400"
                />
              </div>

              {uploadError && (
                <div className="rounded-xl bg-rose-500/15 border border-rose-400/40 px-3 py-2 text-xs text-rose-200">
                  {uploadError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActivePanel('none')}
                  className="px-4 py-2 rounded-xl border border-white/15 text-xs font-medium text-white/80 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={analyzingUpload}
                  className="sonance-press inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold disabled:opacity-60 whitespace-nowrap"
                >
                  {analyzingUpload ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Directing Universe...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Analyze &amp; Launch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Drawer 2: AI Emotion & Storyboard Inspector */}
        {activePanel === 'inspector' && (
          <div className="absolute top-16 right-4 bottom-24 z-30 w-[340px] max-w-[92vw] rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/15 p-4 text-white overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-sky-400" />
                <h3 className="font-display text-sm font-bold">AI Emotion Inspector</h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel('none')}
                aria-label="Close AI Emotion Inspector"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-white/70">
                <span>Language: {plan.detectedLanguage.toUpperCase()}</span>
                <span>Chladni {visualSeed.chladniM}×{visualSeed.chladniN}</span>
              </div>
              <p className="text-xs font-semibold text-white">{plan.overallEmotion}</p>
              <p className="text-[11px] text-white/75 leading-relaxed">{plan.poeticSummary}</p>
              <p className="text-[11px] text-sky-300 pt-1">
                Motifs: {plan.culturalMotifs.join(' · ')}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">
                Timestamped Storyboard
              </p>
              {plan.storyboard.map((phase, idx) => {
                const isCurrent = activePhase.phaseName === phase.phaseName;
                const startSec = Math.round(phase.startRatio * (duration || plan.durationSeconds));
                const endSec = Math.round(phase.endRatio * (duration || plan.durationSeconds));
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSeek(startSec + 0.2)}
                    className={`w-full text-left rounded-xl border p-2.5 transition-colors ${
                      isCurrent
                        ? 'bg-white/15 border-sky-400/70'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {phase.phaseName}
                      </span>
                      <span className="font-mono-tabular text-[10px] text-white/70 shrink-0">
                        {formatDuration(startSec)}–{formatDuration(endSec)}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/75 mt-0.5 line-clamp-2">
                      {phase.visualMetaphor}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-white/70">
                        {phase.emotionLabel} · {phase.kineticStyle}
                      </span>
                      <div className="flex items-center gap-1">
                        {phase.palette.slice(0, 3).map((hex, cIdx) => (
                          <span
                            key={cIdx}
                            className="w-3 h-3 rounded-full border border-white/25"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Drawer 3: Emotional Memory Gallery (Acoustic Fossils) */}
        {activePanel === 'gallery' && (
          <div className="absolute top-16 right-4 bottom-24 z-30 w-[350px] max-w-[92vw] rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/15 p-4 text-white overflow-y-auto space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gem className="w-4 h-4 text-amber-300" />
                <h3 className="font-display text-sm font-bold">Emotional Memory Gallery</h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel('none')}
                aria-label="Close Acoustic Fossils Gallery"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-white/70 leading-relaxed">
              Finished or crystallized songs leave behind a persistent glowing Acoustic Fossil shaped by their Chladni resonance and emotional arc.
            </p>

            {fossils.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center space-y-2">
                <Disc3 className="w-8 h-8 mx-auto text-white/40" />
                <p className="text-xs font-medium text-white/80">No Acoustic Fossils yet</p>
                <p className="text-[11px] text-white/55">
                  Finish any song or click &ldquo;Crystallize Fossil&rdquo; to archive its crystalline signature.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {fossils.map((fossil) => (
                  <div
                    key={fossil.id}
                    className="rounded-2xl bg-white/5 border border-white/12 p-3 flex items-center gap-3"
                  >
                    <FossilConstellationIcon fossil={fossil} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{fossil.songTitle}</p>
                      <p className="text-[11px] text-white/70 truncate">{fossil.artist}</p>
                      <p className="text-[11px] text-amber-200/90 truncate mt-0.5">
                        {fossil.overallEmotion}
                      </p>
                      <p className="font-mono-tabular text-[10px] text-white/55 mt-0.5">
                        {fossil.detectedLanguage.toUpperCase()} · {fossil.chladniM}×{fossil.chladniN} · #{fossil.seedHex.slice(0, 6)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFossils(deleteAcousticFossil(fossil.id))}
                      aria-label={`Delete fossil ${fossil.songTitle}`}
                      className="p-1.5 rounded-lg text-white/55 hover:text-rose-300 hover:bg-white/10 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
