import React, { useEffect, useRef, useState } from "react";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Tv, 
  Volume2, 
  Crown, 
  Sparkles, 
  ShieldCheck,
  Shield,
  Hand
} from "lucide-react";
import { UserProfile } from "../types";

interface ConferenceGridProps {
  localUser: UserProfile;
  users: { [userId: string]: UserProfile };
  hostId: string;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
}

export default function ConferenceGrid({
  localUser,
  users,
  hostId,
  localStream,
  screenStream
}: ConferenceGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [backgroundMode, setBackgroundMode] = useState<"none" | "blur" | "space" | "office">("none");
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  // List of all active participants to render (real + virtual)
  const participants = Object.values(users);

  // Bind local camera stream to video tag
  useEffect(() => {
    if (localVideoRef.current && localStream && backgroundMode === "none") {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, backgroundMode]);

  // Bind local screen share stream to video tag
  useEffect(() => {
    if (localScreenRef.current && screenStream) {
      localScreenRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Active speaker simulation: rotate between unmuted participants every few seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const activeMics = participants.filter(p => p.isMicOn);
      if (activeMics.length > 0) {
        // pick a random speaking user
        const speaker = activeMics[Math.floor(Math.random() * activeMics.length)];
        setActiveSpeakerId(speaker.id);
      } else {
        setActiveSpeakerId(null);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [users]);

  // Canvas-based Virtual Background & Blur processing
  useEffect(() => {
    if (backgroundMode === "none" || !localStream || !localUser.isCamOn) {
      setIsProcessingVideo(false);
      return;
    }

    const videoElement = document.createElement("video");
    videoElement.srcObject = localStream;
    videoElement.muted = true;
    videoElement.play().catch(() => {});

    setIsProcessingVideo(true);
    let animationFrameId: number;

    const processFrame = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || videoElement.paused || videoElement.ended) {
        animationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      // Sync sizes
      if (canvas.width !== videoElement.videoWidth) {
        canvas.width = videoElement.videoWidth || 640;
        canvas.height = videoElement.videoHeight || 480;
      }

      const w = canvas.width;
      const h = canvas.height;

      // Draw Background
      if (backgroundMode === "blur") {
        // Draw blurred copy as backplate
        ctx.save();
        ctx.filter = "blur(12px) brightness(0.8)";
        ctx.drawImage(videoElement, 0, 0, w, h);
        ctx.restore();
        
        // Overlay focused foreground (vignetted or simple crop)
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) / 2.2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(videoElement, 0, 0, w, h);
        ctx.restore();
      } else if (backgroundMode === "space") {
        // Draw deep cosmic nebula background
        const grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, w);
        grad.addColorStop(0, "#2563eb"); // bright royal blue
        grad.addColorStop(0.5, "#4f46e5"); // indigo
        grad.addColorStop(1, "#030712"); // deep space black
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Simulated floating stars
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.beginPath();
        ctx.arc(w * 0.25, h * 0.3, 2, 0, Math.PI*2);
        ctx.arc(w * 0.8, h * 0.2, 3, 0, Math.PI*2);
        ctx.arc(w * 0.6, h * 0.75, 1.5, 0, Math.PI*2);
        ctx.fill();

        // Draw overlay face clip
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2 + 30, w * 0.3, h * 0.45, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(videoElement, 0, 0, w, h);
        ctx.restore();
      } else if (backgroundMode === "office") {
        // Draw nice virtual boardroom office background
        ctx.fillStyle = "#1e293b"; // dark office slate
        ctx.fillRect(0, 0, w, h);
        
        // Grid pattern for "glass boardroom"
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        for (let i = 0; i < w; i += 40) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, h);
          ctx.stroke();
        }
        
        // Office plants/furniture simulation (circles/rects)
        ctx.fillStyle = "rgba(16, 185, 129, 0.2)"; // Plant green
        ctx.beginPath();
        ctx.arc(50, h - 50, 60, 0, Math.PI*2);
        ctx.fill();

        // Draw face clip
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2 + 20, w * 0.28, h * 0.42, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(videoElement, 0, 0, w, h);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    videoElement.onloadedmetadata = () => {
      animationFrameId = requestAnimationFrame(processFrame);
    };

    return () => {
      cancelAnimationFrame(animationFrameId);
      videoElement.pause();
      videoElement.srcObject = null;
    };
  }, [backgroundMode, localStream, localUser.isCamOn]);

  // Render a single participant video or avatar container
  const renderParticipant = (p: UserProfile, isLocal: boolean) => {
    const isSpeaking = activeSpeakerId === p.id && p.isMicOn;
    const isHost = p.id === hostId;

    return (
      <div 
        key={p.id}
        id={`participant-card-${p.id}`}
        className={`relative flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md rounded-3xl border aspect-video overflow-hidden group transition-all duration-300 ${isSpeaking ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.35)] ring-4 ring-emerald-500/10" : "border-white/10 shadow-xl"}`}
      >
        {/* Cam On - Real Video Feed */}
        {p.isCamOn ? (
          isLocal ? (
            backgroundMode !== "none" ? (
              <canvas
                ref={canvasRef}
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )
          ) : p.id.startsWith("demo-") ? (
            // Simulated video stream for demo users (using beautiful stock clips or high-quality styled loops)
            <div className="w-full h-full bg-gradient-to-tr from-indigo-950/40 to-purple-950/40 relative flex items-center justify-center">
              {/* Animated pulses representing a living stream */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500 via-indigo-600 to-black animate-pulse" />
              <img
                src={p.avatar}
                alt={p.name}
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded-full border-2 border-white/20 object-cover shadow-2xl relative z-10"
              />
              <div className="absolute top-3 right-3 flex items-center bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                ● Live Demo
              </div>
            </div>
          ) : (
            // External participants real video (mocked nicely for layout fallback)
            <div className="w-full h-full bg-[#1b1b1f] flex flex-col items-center justify-center">
              <img
                src={p.avatar}
                alt={p.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-full border border-white/10 object-cover mb-2"
              />
              <span className="text-xs text-gray-400">Ожидание WebRTC потока...</span>
            </div>
          )
        ) : (
          /* Cam Off - Avatar visual fallback */
          <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-zinc-950 flex flex-col items-center justify-center relative">
            <div className="relative">
              <img
                src={p.avatar}
                alt={p.name}
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded-full object-cover border-2 border-white/10 shadow-2xl group-hover:scale-105 transition-all duration-300"
              />
              {isSpeaking && (
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-75" />
              )}
            </div>
            <div className="mt-3 text-sm font-semibold tracking-wide text-gray-200">
              {p.name}
            </div>
            <div className="mt-1 text-xs text-gray-500">Видео выключено</div>
          </div>
        )}

        {/* Floating Controls Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 flex items-center justify-between opacity-90 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center space-x-2">
            {isHost && (
              <span 
                className="bg-amber-500/20 text-amber-300 border border-amber-500/30 p-1 rounded-md"
                title="Организатор конференции"
              >
                <Crown size={12} />
              </span>
            )}
            <span className="text-xs font-medium text-white truncate max-w-[120px] md:max-w-[180px]">
              {p.name} {isLocal && "(Вы)"}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            {p.isHandRaised && (
              <span className="bg-amber-500 text-black p-1 rounded-md animate-bounce" title="Поднята рука">
                <Hand size={12} />
              </span>
            )}
            <span className={`p-1 rounded-md ${p.isMicOn ? "bg-white/10 text-emerald-400" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
              {p.isMicOn ? <Mic size={12} /> : <MicOff size={12} />}
            </span>
            <span className={`p-1 rounded-md ${p.isCamOn ? "bg-white/10 text-blue-400" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
              {p.isCamOn ? <Video size={12} /> : <VideoOff size={12} />}
            </span>
          </div>
        </div>

        {/* Dynamic speech sound wave bars */}
        {isSpeaking && (
          <div className="absolute top-3 left-3 flex items-end space-x-0.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md">
            <div className="w-0.5 h-3 bg-emerald-400 animate-[bounce_0.6s_infinite]" />
            <div className="w-0.5 h-4 bg-emerald-400 animate-[bounce_0.4s_infinite]" />
            <div className="w-0.5 h-2 bg-emerald-400 animate-[bounce_0.8s_infinite]" />
            <span className="text-[10px] font-semibold text-emerald-400 ml-1.5">ГОВОРИТ</span>
          </div>
        )}
      </div>
    );
  };

  // Determine grid columns
  const totalPeers = participants.length;
  let gridLayoutClass = "grid-cols-1";
  if (totalPeers === 2) {
    gridLayoutClass = "grid-cols-1 sm:grid-cols-2";
  } else if (totalPeers >= 3 && totalPeers <= 4) {
    gridLayoutClass = "grid-cols-2";
  } else if (totalPeers > 4) {
    gridLayoutClass = "grid-cols-2 md:grid-cols-3";
  }

  return (
    <div className="flex flex-col h-full bg-transparent p-4 space-y-4 overflow-y-auto relative z-10">
      {/* Screen Sharing Monitor Area */}
      {(screenStream || participants.some(p => p.isScreenSharing)) && (
        <div className="w-full flex flex-col justify-center bg-zinc-950 border border-blue-500/20 rounded-2xl p-2 relative aspect-video shadow-2xl overflow-hidden">
          {screenStream ? (
            <video
              ref={localScreenRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain rounded-xl"
            />
          ) : (
            <div className="w-full h-full bg-slate-900/40 flex flex-col items-center justify-center">
              <Tv size={48} className="text-blue-400 animate-pulse mb-3" />
              <span className="text-sm font-semibold text-gray-200">
                {participants.find(p => p.isScreenSharing)?.name} демонстрирует экран
              </span>
            </div>
          )}
          <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 shadow-lg">
            <Tv size={12} className="animate-pulse" />
            <span>ДЕМОНСТРАЦИЯ ЭКРАНА</span>
          </div>
        </div>
      )}

      {/* Main Grid Area */}
      <div className={`grid gap-4 flex-grow ${gridLayoutClass}`}>
        {participants.map((p) => renderParticipant(p, p.id === localUser.id))}
      </div>

      {/* Background and Virtual Effects controls (Only shown if local user has camera on) */}
      {localUser.isCamOn && localStream && (
        <div className="glass p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <Sparkles size={14} className="text-blue-400" />
            <span>Эффекты камеры (Виртуальный фон):</span>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            <button
              id="bg-effect-none"
              onClick={() => setBackgroundMode("none")}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${backgroundMode === "none" ? "bg-blue-600 border-blue-500 text-white font-medium" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}
            >
              Без эффектов
            </button>
            <button
              id="bg-effect-blur"
              onClick={() => setBackgroundMode("blur")}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${backgroundMode === "blur" ? "bg-blue-600 border-blue-500 text-white font-medium" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}
            >
              Размытие фона
            </button>
            <button
              id="bg-effect-space"
              onClick={() => setBackgroundMode("space")}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${backgroundMode === "space" ? "bg-blue-600 border-blue-500 text-white font-medium" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}
            >
              Космос 🌌
            </button>
            <button
              id="bg-effect-office"
              onClick={() => setBackgroundMode("office")}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${backgroundMode === "office" ? "bg-blue-600 border-blue-500 text-white font-medium" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}
            >
              Офис 🏢
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
