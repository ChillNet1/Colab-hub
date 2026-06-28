import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Tv, 
  MessageSquare, 
  Users, 
  Hand, 
  Smile, 
  Copy, 
  Check, 
  LogOut, 
  Layout, 
  Grid, 
  Compass, 
  ShieldAlert, 
  Play, 
  Square,
  Lock,
  Unlock,
  AlertCircle
} from "lucide-react";
import Lobby from "./components/Lobby";
import Whiteboard from "./components/Whiteboard";
import ConferenceGrid from "./components/ConferenceGrid";
import ChatSidebar from "./components/ChatSidebar";
import { 
  UserProfile, 
  ChatMessage, 
  WhiteboardAction, 
  RoomState, 
  ScheduledMeeting, 
  NotificationItem 
} from "./types";

export default function App() {
  // Navigation: Lobby vs Room
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  
  // Profile settings passed from Lobby
  const [localUser, setLocalUser] = useState<UserProfile>({
    id: `usr-${Math.floor(1000 + Math.random() * 9000)}`,
    name: "Пользователь",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
    isMicOn: true,
    isCamOn: true,
    isScreenSharing: false,
    isHandRaised: false,
    role: "participant",
    status: "online"
  });

  // Scheduled Meetings list
  const [scheduledMeetings, setScheduledMeetings] = useState<ScheduledMeeting[]>([]);

  // Room state synchronized via WebSocket
  const [roomName, setRoomName] = useState("");
  const [roomUsers, setRoomUsers] = useState<{ [userId: string]: UserProfile }>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [whiteboardActions, setWhiteboardActions] = useState<WhiteboardAction[]>([]);
  const [hostId, setHostId] = useState("");

  // Room settings/locks
  const [isLocked, setIsLocked] = useState(false);
  const [isChatLocked, setIsChatLocked] = useState(false);
  const [isBoardLocked, setIsBoardLocked] = useState(false);

  // Layout View states
  // "grid" | "whiteboard" | "split"
  const [currentView, setCurrentView] = useState<"grid" | "whiteboard" | "split">("grid");
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  // Media Streams states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Floating reactions queue
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; userName: string; xOffset: number }[]>([]);

  // Toast Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Live Whiteboard cursors map
  const [whiteboardCursors, setWhiteboardCursors] = useState<{ [userId: string]: { x: number; y: number; name: string; color: string; updatedAt: number } }>({});

  // Copy invitation confirmation
  const [copiedCode, setCopiedCode] = useState(false);

  // Meeting Recorder states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null);

  // Preserved color of the user for cursors/whiteboard drawing
  const [userColor] = useState(() => {
    const colors = ["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#ec4899", "#8b5cf6"];
    return colors[Math.floor(Math.random() * colors.length)];
  });

  // 1. Fetch Scheduled Meetings from Node.js Express server
  useEffect(() => {
    fetch("/api/meetings")
      .then(res => res.json())
      .then(data => setScheduledMeetings(data))
      .catch(err => console.error("Error fetching scheduled meetings: ", err));
  }, [currentRoomId]);

  // 2. Setup audio/video media on entering a room
  useEffect(() => {
    if (!currentRoomId) {
      // Cleanup media when leaving room
      stopAllMedia();
      return;
    }

    // Try to get camera and microphone access
    navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: true
    })
      .then((stream) => {
        setLocalStream(stream);
        // apply track enables based on initial state
        stream.getAudioTracks().forEach(t => t.enabled = localUser.isMicOn);
        stream.getVideoTracks().forEach(t => t.enabled = localUser.isCamOn);
      })
      .catch((err) => {
        console.warn("Could not load camera/mic stream, running simulated stream instead:", err);
      });

  }, [currentRoomId]);

  // Stop camera and screen media helper
  const stopAllMedia = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
  };

  // 3. Connect to WebSocket Server on port 3000
  const connectWebSocket = (roomId: string, name: string, avatar: string, password?: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send join event
      ws.send(JSON.stringify({
        type: "join",
        roomId,
        userId: localUser.id,
        name,
        avatar,
        password,
        role: "participant" // server will elevate to host if room is empty
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type } = data;

        switch (type) {
          case "join_success": {
            const { room } = data;
            setRoomName(room.name);
            setRoomUsers(room.users);
            setChatMessages(room.messages);
            setWhiteboardActions(room.whiteboardData);
            setHostId(room.hostId);
            setIsLocked(room.isLocked);
            setIsChatLocked(room.isChatLocked);
            setIsBoardLocked(room.isBoardLocked);

            // Update local user role
            const selfObj = room.users[localUser.id];
            if (selfObj) {
              setLocalUser(prev => ({ ...prev, role: selfObj.role }));
            }
            break;
          }

          case "user_joined": {
            const { user } = data;
            setRoomUsers(prev => ({ ...prev, [user.id]: user }));
            addNotification(`${user.name} вошел в конференцию`, "join");
            break;
          }

          case "user_left": {
            const { userId } = data;
            setRoomUsers(prev => {
              const clone = { ...prev };
              const target = clone[userId];
              if (target) {
                addNotification(`${target.name} вышел из конференции`, "leave");
                delete clone[userId];
              }
              return clone;
            });
            break;
          }

          case "user_state_update": {
            const { userId, updates } = data;
            setRoomUsers(prev => {
              if (!prev[userId]) return prev;
              return {
                ...prev,
                [userId]: { ...prev[userId], ...updates }
              };
            });

            // If local user's states were updated remotely by host
            if (userId === localUser.id) {
              setLocalUser(prev => {
                const merged = { ...prev, ...updates };
                // Ensure track states match unmuting/muting
                if (localStream) {
                  localStream.getAudioTracks().forEach(t => t.enabled = merged.isMicOn);
                  localStream.getVideoTracks().forEach(t => t.enabled = merged.isCamOn);
                }
                return merged;
              });
            }

            // Notification for screen share
            if (updates.isScreenSharing !== undefined) {
              const u = roomUsers[userId];
              if (u) {
                addNotification(
                  updates.isScreenSharing 
                    ? `${u.name} запустил демонстрацию экрана` 
                    : `${u.name} остановил демонстрацию экрана`, 
                  "screen"
                );
              }
            }

            // Notification for hand raised
            if (updates.isHandRaised) {
              const u = roomUsers[userId];
              if (u && userId !== localUser.id) {
                addNotification(`${u.name} поднял руку 🙋‍♂️`, "hand");
              }
            }
            break;
          }

          case "chat_message": {
            const { message } = data;
            setChatMessages(prev => [...prev, message]);
            break;
          }

          case "chat_message_delete": {
            const { messageId } = data;
            setChatMessages(prev => prev.filter(m => m.id !== messageId));
            break;
          }

          case "whiteboard_draw": {
            const { action } = data;
            setWhiteboardActions(prev => [...prev, action]);
            break;
          }

          case "whiteboard_cursor": {
            const { userId, userName, color, x, y } = data;
            setWhiteboardCursors(prev => ({
              ...prev,
              [userId]: { x, y, name: userName, color, updatedAt: Date.now() }
            }));
            break;
          }

          case "whiteboard_clear": {
            setWhiteboardActions([]);
            break;
          }

          case "reaction": {
            const { userId, userName, emoji } = data;
            triggerReaction(emoji, userName);
            break;
          }

          case "room_state_sync": {
            const { users } = data;
            setRoomUsers(users);
            break;
          }

          case "room_setting_update": {
            const { updates } = data;
            if (updates.isLocked !== undefined) setIsLocked(updates.isLocked);
            if (updates.isChatLocked !== undefined) setIsChatLocked(updates.isChatLocked);
            if (updates.isBoardLocked !== undefined) setIsBoardLocked(updates.isBoardLocked);
            break;
          }

          case "host_changed": {
            const { hostId, users } = data;
            setHostId(hostId);
            setRoomUsers(users);
            const selfObj = users[localUser.id];
            if (selfObj) {
              setLocalUser(prev => ({ ...prev, role: selfObj.role }));
            }
            addNotification("Назначен новый организатор конференции", "admin");
            break;
          }

          case "admin_action": {
            const { command } = data;
            if (command === "mute_mic") {
              toggleMic(false);
              addNotification("Организатор отключил ваш микрофон", "admin");
            } else if (command === "disable_camera") {
              toggleCamera(false);
              addNotification("Организатор выключил вашу камеру", "admin");
            } else if (command === "kicked") {
              handleLeaveRoom();
              alert("Вы были исключены из конференции администратором.");
            }
            break;
          }

          case "error": {
            alert(data.message);
            handleLeaveRoom();
            break;
          }
        }
      } catch (e) {
        console.error("Error handling WS message:", e);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed.");
    };
  };

  // 4. Global Hotkey keypress listeners during conference
  useEffect(() => {
    if (!currentRoomId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is focused on typing in input fields, skip hotkeys
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "m") {
        toggleMic();
      } else if (key === "v") {
        toggleCamera();
      } else if (key === "w") {
        setCurrentView(prev => prev === "whiteboard" ? "grid" : "whiteboard");
      } else if (key === "c") {
        setIsChatOpen(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentRoomId, localUser, localStream]);

  // Action: Join or Create Room from Lobby
  const handleJoinRoom = (roomId: string, name: string, avatar: string, password?: string) => {
    // Save local identity
    const updatedUser = { ...localUser, name, avatar };
    setLocalUser(updatedUser);
    setCurrentRoomId(roomId);
    connectWebSocket(roomId, name, avatar, password);
  };

  // Action: Leave Room
  const handleLeaveRoom = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopAllMedia();
    setCurrentRoomId(null);
    setRoomUsers({});
    setChatMessages([]);
    setWhiteboardActions([]);
    setWhiteboardCursors({});
  };

  // Create scheduled meeting to backend
  const handleAddScheduledMeeting = (meeting: Partial<ScheduledMeeting>) => {
    fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meeting)
    })
      .then(res => res.json())
      .then(newMeeting => {
        setScheduledMeetings(prev => [...prev, newMeeting]);
      })
      .catch(err => console.error("Error planning meeting: ", err));
  };

  // Broadcast local user state changes to room
  const sendStateUpdate = (updates: Partial<UserProfile>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "user_state_update",
        updates
      }));
    }
  };

  // Toggle local Audio mic
  const toggleMic = (forcedState?: boolean) => {
    const newState = forcedState !== undefined ? forcedState : !localUser.isMicOn;
    
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = newState);
    }
    
    setLocalUser(prev => ({ ...prev, isMicOn: newState }));
    sendStateUpdate({ isMicOn: newState });
  };

  // Toggle local Camera video
  const toggleCamera = (forcedState?: boolean) => {
    const newState = forcedState !== undefined ? forcedState : !localUser.isCamOn;

    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = newState);
    }

    setLocalUser(prev => ({ ...prev, isCamOn: newState }));
    sendStateUpdate({ isCamOn: newState });
  };

  // Toggle local Display Screen sharing
  const toggleScreenShare = () => {
    if (!screenStream) {
      navigator.mediaDevices.getDisplayMedia({ video: true })
        .then((stream) => {
          setScreenStream(stream);
          setLocalUser(prev => ({ ...prev, isScreenSharing: true }));
          sendStateUpdate({ isScreenSharing: true });

          // When screen share ends by user clicking browser stop button
          stream.getVideoTracks()[0].onended = () => {
            setScreenStream(null);
            setLocalUser(prev => ({ ...prev, isScreenSharing: false }));
            sendStateUpdate({ isScreenSharing: false });
          };
        })
        .catch((err) => console.warn("Could not share screen:", err));
    } else {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      setLocalUser(prev => ({ ...prev, isScreenSharing: false }));
      sendStateUpdate({ isScreenSharing: false });
    }
  };

  // Toggle local Raised Hand state
  const toggleHand = () => {
    const newState = !localUser.isHandRaised;
    setLocalUser(prev => ({ ...prev, isHandRaised: newState }));
    sendStateUpdate({ isHandRaised: newState });
    if (newState) {
      triggerReaction("🙋‍♀️", localUser.name);
    }
  };

  // Send a visual reaction which flows up on everyone's screen
  const sendReaction = (emoji: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "reaction",
        emoji
      }));
    }
  };

  // Action: Send a text chat message with optional attachment details
  const handleSendMessage = (text: string, file?: any, replyTo?: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat_message",
        text,
        file,
        replyTo
      }));
    }
  };

  // Action: Delete a chat message
  const handleDeleteMessage = (messageId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat_message_delete",
        messageId
      }));
    }
  };

  // Admin capabilities: host triggers setting toggle or action
  const handleAdminAction = (actionType: string, targetUserId?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "admin_action",
        actionType,
        targetUserId
      }));
    }
  };

  // Synchronous broadcast drawing segment to socket
  const handleSendDrawingAction = (action: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "whiteboard_draw",
        action
      }));
    }
  };

  // Visual helper: trigger floating screen reaction
  const triggerReaction = (emoji: string, senderName: string) => {
    const id = `react-${Date.now()}-${Math.random()}`;
    const xOffset = Math.floor(-100 + Math.random() * 200); // randomize horizontal float drift
    setFloatingReactions(prev => [...prev, { id, emoji, userName: senderName, xOffset }]);
    
    // Auto erase reaction from queue after 4s
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 4000);
  };

  // Notification helper: trigger temporary top toast notice
  const addNotification = (text: string, type: any) => {
    const id = `notif-${Date.now()}`;
    setNotifications(prev => [...prev, { id, text, type, timestamp: new Date() }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Meeting local video/audio recorder
  const handleToggleRecord = () => {
    if (!isRecording) {
      // Gather active canvas/video streams or use robust synthetic stream fallbacks
      const tracks: MediaStreamTrack[] = [];

      // 1. Audio Track fallback
      if (localStream && localStream.getAudioTracks().length > 0) {
        tracks.push(localStream.getAudioTracks()[0]);
      } else {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const dest = audioContext.createMediaStreamDestination();
          const silentTrack = dest.stream.getAudioTracks()[0];
          if (silentTrack) {
            tracks.push(silentTrack);
          }
        } catch (e) {
          console.warn("AudioContext fallback failed:", e);
        }
      }

      // 2. Video Track fallback (pulsating recorder card pattern)
      if (localStream && localStream.getVideoTracks().length > 0) {
        tracks.push(localStream.getVideoTracks()[0]);
      } else {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext("2d");
          
          let dotVisible = true;
          const drawFrame = () => {
            if (!ctx) return;
            // Draw gradient background
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, "#0f172a"); // slate-900
            grad.addColorStop(1, "#020617"); // slate-950
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Tech style grids
            ctx.strokeStyle = "rgba(99, 102, 241, 0.05)"; // indigo-500 low opacity
            ctx.lineWidth = 1;
            for (let i = 0; i < canvas.width; i += 40) {
              ctx.beginPath();
              ctx.moveTo(i, 0);
              ctx.lineTo(i, canvas.height);
              ctx.stroke();
            }
            for (let j = 0; j < canvas.height; j += 40) {
              ctx.beginPath();
              ctx.moveTo(0, j);
              ctx.lineTo(canvas.width, j);
              ctx.stroke();
            }

            // Outer border
            ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
            ctx.lineWidth = 8;
            ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

            // Title
            ctx.fillStyle = "#f8fafc";
            ctx.font = "bold 22px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Запись Конференции (Активна)", canvas.width / 2, canvas.height / 2 - 30);

            // Room Info
            ctx.fillStyle = "#38bdf8"; // sky-400
            ctx.font = "bold 15px monospace";
            ctx.fillText(`Комната: ${roomName || currentRoomId || "Конференция"}`, canvas.width / 2, canvas.height / 2 + 10);

            // Timestamp
            ctx.fillStyle = "#94a3b8"; // slate-400
            ctx.font = "13px monospace";
            ctx.fillText(new Date().toLocaleTimeString(), canvas.width / 2, canvas.height / 2 + 40);

            // Rec status indicator
            ctx.fillStyle = dotVisible ? "#ef4444" : "#475569"; // red or slate
            ctx.beginPath();
            ctx.arc(canvas.width / 2 - 170, canvas.height / 2 - 38, 8, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText("REC", canvas.width / 2 - 154, canvas.height / 2 - 34);
          };

          drawFrame();

          const intervalId = setInterval(() => {
            dotVisible = !dotVisible;
            drawFrame();
          }, 1000);

          (canvas as any)._drawIntervalId = intervalId;

          const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(10) : null;
          if (canvasStream) {
            const track = canvasStream.getVideoTracks()[0];
            if (track) {
              tracks.push(track);
              (track as any)._canvasRef = canvas;
            }
          }
        } catch (e) {
          console.warn("Canvas capture fallback failed:", e);
        }
      }

      if (tracks.length === 0) {
        alert("Не удалось создать медиапоток для записи.");
        return;
      }

      const streamToRecord = new MediaStream(tracks);

      try {
        const recorder = new MediaRecorder(streamToRecord, { mimeType: "video/webm" });
        const chunks: Blob[] = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          // Cleanup synthetic canvas rendering interval
          streamToRecord.getTracks().forEach(track => {
            const canvasRef = (track as any)._canvasRef;
            if (canvasRef && canvasRef._drawIntervalId) {
              clearInterval(canvasRef._drawIntervalId);
            }
          });

          // Compile and trigger native client download
          const blob = new Blob(chunks, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Запись_конференции_${currentRoomId}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          addNotification("Запись успешно загружена на компьютер", "system");
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
        addNotification("Запись конференции запущена 🔴", "system");
      } catch (err) {
        console.error("Could not trigger recorder:", err);
        alert("Запись не поддерживается на данном устройстве.");
      }
    } else {
      if (mediaRecorder) {
        mediaRecorder.stop();
        setIsRecording(false);
        setMediaRecorder(null);
      }
    }
  };

  const handleCopyInvite = () => {
    const inviteLink = `${window.location.origin}/?room=${currentRoomId}`;
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 3000);
      });
  };

  // If Room ID is not set, show the main Lobby dashboard
  if (!currentRoomId) {
    return (
      <Lobby
        onJoinRoom={handleJoinRoom}
        scheduledMeetings={scheduledMeetings}
        onAddScheduledMeeting={handleAddScheduledMeeting}
      />
    );
  }

  // Active user is Host?
  const isLocalHost = localUser.id === hostId || localUser.role === "host";

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white overflow-hidden font-sans relative">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-emerald-600/15 rounded-full blur-[140px] pointer-events-none z-0" />
      
      {/* Top Banner Status Info bar */}
      <div className="px-4 py-2.5 bg-[#121214] border-b border-white/5 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center space-x-3 truncate">
          <span className="p-1 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold leading-none shrink-0 uppercase tracking-widest">
            {currentRoomId}
          </span>
          <h2 className="text-xs font-bold font-display truncate max-w-[150px] md:max-w-xs">{roomName || "Подключение к комнате..."}</h2>
          
          {/* Quick Copy Info */}
          <button
            id="copy-invite-badge"
            onClick={handleCopyInvite}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] text-gray-400 hover:text-white hover:bg-white/10"
            title="Скопировать ссылку приглашения"
          >
            {copiedCode ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            <span>{copiedCode ? "Скопировано!" : "Копировать ссылку"}</span>
          </button>
        </div>

        {/* Info indicators */}
        <div className="flex items-center space-x-4">
          {/* Record mode badge indicator */}
          {isRecording && (
            <div className="flex items-center text-rose-400 text-xs font-bold space-x-1.5 animate-pulse bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>ЗАПИСЬ</span>
            </div>
          )}

          {isLocked && (
            <div className="flex items-center text-amber-400 text-xs space-x-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded">
              <Lock size={10} />
              <span>Конференция закрыта</span>
            </div>
          )}

          {/* Toggle buttons for sidebar drawers */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
            <button
              id="sidebar-chat-toggle"
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-1.5 rounded-md transition-colors ${isChatOpen ? "bg-blue-600 text-white" : "hover:bg-white/5 text-gray-400"}`}
              title="Открыть чат"
            >
              <MessageSquare size={14} />
            </button>
            <button
              id="sidebar-users-toggle"
              onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
              className={`p-1.5 rounded-md transition-colors ${isParticipantsOpen ? "bg-blue-600 text-white" : "hover:bg-white/5 text-gray-400"}`}
              title="Участники"
            >
              <Users size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Container Stage (Workspace & Sidebar) */}
      <div className="flex-grow flex w-full overflow-hidden relative">
        
        {/* Workspace core */}
        <div className="flex-grow flex flex-col min-w-0 h-full relative">
          
          {/* View Segment selector tabs */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.01]">
            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 text-xs">
              <button
                id="view-grid-tab"
                onClick={() => setCurrentView("grid")}
                className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-all ${currentView === "grid" ? "bg-zinc-800 text-white shadow-md font-semibold" : "text-gray-400 hover:text-white"}`}
              >
                <Grid size={12} />
                <span>Сетка участников</span>
              </button>
              <button
                id="view-whiteboard-tab"
                onClick={() => setCurrentView("whiteboard")}
                className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-all ${currentView === "whiteboard" ? "bg-zinc-800 text-white shadow-md font-semibold" : "text-gray-400 hover:text-white"}`}
              >
                <Compass size={12} />
                <span>Интерактивная доска</span>
              </button>
              <button
                id="view-split-tab"
                onClick={() => setCurrentView("split")}
                className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-all ${currentView === "split" ? "bg-zinc-800 text-white shadow-md font-semibold" : "text-gray-400 hover:text-white"}`}
              >
                <Layout size={12} />
                <span>Совмещенный вид</span>
              </button>
            </div>

            <span className="text-[10px] text-gray-500 font-medium">Активных участников: {Object.keys(roomUsers).length}</span>
          </div>

          {/* Core Content canvas */}
          <div className="flex-grow min-h-0 relative">
            {currentView === "grid" && (
              <ConferenceGrid
                localUser={localUser}
                users={roomUsers}
                hostId={hostId}
                localStream={localStream}
                screenStream={screenStream}
              />
            )}

            {currentView === "whiteboard" && (
              <Whiteboard
                roomId={currentRoomId}
                userId={localUser.id}
                userName={localUser.name}
                userColor={userColor}
                isLocked={isBoardLocked}
                isHost={isLocalHost}
                whiteboardData={whiteboardActions}
                sendWsMessage={handleSendDrawingAction}
                activeCursors={whiteboardCursors}
              />
            )}

            {currentView === "split" && (
              <div className="w-full h-full flex flex-col md:flex-row p-3 gap-3">
                <div className="w-full md:w-1/2 h-full">
                  <ConferenceGrid
                    localUser={localUser}
                    users={roomUsers}
                    hostId={hostId}
                    localStream={localStream}
                    screenStream={screenStream}
                  />
                </div>
                <div className="w-full md:w-1/2 h-full">
                  <Whiteboard
                    roomId={currentRoomId}
                    userId={localUser.id}
                    userName={localUser.name}
                    userColor={userColor}
                    isLocked={isBoardLocked}
                    isHost={isLocalHost}
                    whiteboardData={whiteboardActions}
                    sendWsMessage={handleSendDrawingAction}
                    activeCursors={whiteboardCursors}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar right drawers (Chat & Participants List) */}
        {(isChatOpen || isParticipantsOpen) && (
          <div className="w-80 border-l border-white/10 flex flex-col shrink-0 h-full bg-[#020617]/60 backdrop-blur-md relative z-10">
            {isChatOpen && !isParticipantsOpen && (
              <ChatSidebar
                userId={localUser.id}
                isHost={isLocalHost}
                isChatLocked={isChatLocked}
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                onDeleteMessage={handleDeleteMessage}
              />
            )}

            {isParticipantsOpen && (
              <div className="flex flex-col h-full bg-[#121214] text-white">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                  <h3 className="font-semibold text-sm">Участники ({Object.keys(roomUsers).length})</h3>
                </div>

                {/* Users List with mic, video indicator states and actions */}
                <div className="flex-grow overflow-y-auto p-4 space-y-3.5">
                  {(Object.values(roomUsers) as UserProfile[]).map((p) => {
                    const isSelf = p.id === localUser.id;
                    const isHost = p.id === hostId;
                    return (
                      <div key={p.id} id={`p-row-${p.id}`} className="flex items-center justify-between gap-2 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                        <div className="flex items-center space-x-2.5 truncate">
                          <img
                            src={p.avatar}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover border border-white/10"
                          />
                          <div className="truncate text-left">
                            <span className="text-xs font-semibold truncate text-white block">
                              {p.name} {isSelf && "(Вы)"}
                            </span>
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest block">
                              {isHost ? "Организатор" : "Участник"}
                            </span>
                          </div>
                        </div>

                        {/* Visual Track Indicators */}
                        <div className="flex items-center space-x-1.5 shrink-0">
                          {p.isHandRaised && (
                            <span className="bg-amber-500 text-black p-1 rounded-lg text-[10px]">
                              <Hand size={10} />
                            </span>
                          )}

                          {/* Action toggle mic / cam manually by Admin/Host */}
                          {isLocalHost && !isSelf ? (
                            <div className="flex items-center space-x-1">
                              <button
                                id={`p-mute-btn-${p.id}`}
                                onClick={() => handleAdminAction("mute_user", p.id)}
                                disabled={!p.isMicOn}
                                className={`p-1.5 rounded-lg text-[10px] ${p.isMicOn ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-rose-500/20 hover:text-rose-400" : "bg-zinc-800 text-zinc-500"}`}
                                title="Выключить микрофон"
                              >
                                {p.isMicOn ? <Mic size={11} /> : <MicOff size={11} />}
                              </button>
                              <button
                                id={`p-cam-btn-${p.id}`}
                                onClick={() => handleAdminAction("turn_off_camera", p.id)}
                                disabled={!p.isCamOn}
                                className={`p-1.5 rounded-lg text-[10px] ${p.isCamOn ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-rose-500/20 hover:text-rose-400" : "bg-zinc-800 text-zinc-500"}`}
                                title="Выключить камеру"
                              >
                                {p.isCamOn ? <Video size={11} /> : <VideoOff size={11} />}
                              </button>
                              <button
                                id={`p-kick-btn-${p.id}`}
                                onClick={() => handleAdminAction("kick_user", p.id)}
                                className="p-1.5 rounded-lg text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white"
                                title="Исключить участника"
                              >
                                Исключить
                              </button>
                            </div>
                          ) : (
                            <div className="flex space-x-1">
                              <span className={`p-1 rounded ${p.isMicOn ? "text-emerald-400" : "text-rose-400"}`}>
                                {p.isMicOn ? <Mic size={11} /> : <MicOff size={11} />}
                              </span>
                              <span className={`p-1 rounded ${p.isCamOn ? "text-blue-400" : "text-rose-400"}`}>
                                {p.isCamOn ? <Video size={11} /> : <VideoOff size={11} />}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Host global room control action buttons */}
                {isLocalHost && (
                  <div className="p-4 border-t border-white/5 space-y-2 bg-white/[0.01]">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Управление комнатой</p>
                    
                    <button
                      id="host-mute-all"
                      onClick={() => handleAdminAction("mute_all")}
                      className="w-full text-left flex items-center justify-between text-xs p-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition-all font-medium"
                    >
                      <span>Выключить звук всем</span>
                      <MicOff size={12} />
                    </button>

                    <button
                      id="host-toggle-chat"
                      onClick={() => handleAdminAction("toggle_chat_lock")}
                      className="w-full text-left flex items-center justify-between text-xs p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-gray-300"
                    >
                      <span>{isChatLocked ? "Разблокировать групповой чат" : "Заблокировать групповой чат"}</span>
                      {isChatLocked ? <Unlock size={12} /> : <Lock size={12} />}
                    </button>

                    <button
                      id="host-toggle-board"
                      onClick={() => handleAdminAction("toggle_board_lock")}
                      className="w-full text-left flex items-center justify-between text-xs p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-gray-300"
                    >
                      <span>{isBoardLocked ? "Разблокировать рисование" : "Заблокировать рисование"}</span>
                      {isBoardLocked ? <Unlock size={12} /> : <Lock size={12} />}
                    </button>

                    <button
                      id="host-toggle-lock"
                      onClick={() => handleAdminAction("toggle_room_lock")}
                      className="w-full text-left flex items-center justify-between text-xs p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-gray-300"
                    >
                      <span>{isLocked ? "Открыть доступ в комнату" : "Заблокировать вход в комнату"}</span>
                      {isLocked ? <Unlock size={12} /> : <Lock size={12} />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating interactive reaction emitter items */}
      <div className="absolute inset-x-0 bottom-24 pointer-events-none z-50 flex flex-col items-center">
        {floatingReactions.map((reaction) => (
          <div
            key={reaction.id}
            style={{ "--x-offset": `${reaction.xOffset}px` } as any}
            className="absolute animate-reaction flex flex-col items-center"
          >
            <span className="text-4xl drop-shadow-lg">{reaction.emoji}</span>
            <span className="text-[9px] bg-black/80 px-2 py-0.5 rounded-full text-white/80 border border-white/5 font-semibold mt-1">
              {reaction.userName}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="p-4 bg-[#121214] border-t border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        
        {/* Toggle MIC / CAMERA tracks */}
        <div className="flex items-center space-x-2">
          <button
            id="control-toggle-mic"
            onClick={() => toggleMic()}
            className={`p-3 rounded-xl flex items-center justify-center transition-all ${localUser.isMicOn ? "bg-zinc-800 text-emerald-400 border border-white/5" : "bg-rose-600 text-white shadow-lg"}`}
            title={localUser.isMicOn ? "Выключить микрофон" : "Включить микрофон"}
          >
            {localUser.isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          <button
            id="control-toggle-cam"
            onClick={() => toggleCamera()}
            className={`p-3 rounded-xl flex items-center justify-center transition-all ${localUser.isCamOn ? "bg-zinc-800 text-blue-400 border border-white/5" : "bg-rose-600 text-white shadow-lg"}`}
            title={localUser.isCamOn ? "Выключить камеру" : "Включить камеру"}
          >
            {localUser.isCamOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
        </div>

        {/* Action controls (Screen Share, Recorder, Board, Raise Hand, Reactions) */}
        <div className="flex items-center space-x-2">
          <button
            id="control-screen-share"
            onClick={toggleScreenShare}
            className={`p-3 rounded-xl flex items-center justify-center transition-all border ${screenStream ? "bg-blue-600 text-white border-blue-500" : "bg-zinc-800 text-gray-300 border-white/5 hover:bg-white/5"}`}
            title={screenStream ? "Остановить показ экрана" : "Показать экран"}
          >
            <Tv size={18} />
          </button>

          <button
            id="control-toggle-record"
            onClick={handleToggleRecord}
            className={`p-3 rounded-xl flex items-center justify-center transition-all border ${isRecording ? "bg-rose-600 text-white border-rose-500" : "bg-zinc-800 text-gray-300 border-white/5 hover:bg-white/5"}`}
            title={isRecording ? "Остановить запись" : "Записать конференцию"}
          >
            <span className={`w-2.5 h-2.5 rounded-full mr-2 shrink-0 ${isRecording ? "bg-white animate-ping" : "bg-rose-500"}`} />
            <span className="text-xs font-bold font-mono uppercase tracking-wider">{isRecording ? "Остановить" : "Запись"}</span>
          </button>

          <button
            id="control-raise-hand"
            onClick={toggleHand}
            className={`p-3 rounded-xl flex items-center justify-center transition-all border ${localUser.isHandRaised ? "bg-amber-500 text-black border-amber-400 animate-pulse" : "bg-zinc-800 text-gray-300 border-white/5 hover:bg-white/5"}`}
            title={localUser.isHandRaised ? "Опустить руку" : "Поднять руку"}
          >
            <Hand size={18} />
          </button>

          {/* Quick reactions strip emitter bar */}
          <div className="hidden sm:flex items-center space-x-1 bg-zinc-800 px-2 py-1 border border-white/5 rounded-xl">
            {["👍", "❤️", "😂", "👏", "🔥", "😮"].map((emoji) => (
              <button
                key={emoji}
                id={`reaction-emit-${emoji}`}
                onClick={() => sendReaction(emoji)}
                className="text-base p-1 hover:scale-125 hover:rotate-12 active:scale-90 transition-all cursor-pointer"
                title={`Отправить реакцию ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Leave Conference button */}
        <button
          id="control-leave-room"
          onClick={handleLeaveRoom}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold tracking-wider rounded-xl flex items-center space-x-2 transition-all hover:shadow-lg shadow-rose-500/20 cursor-pointer uppercase shrink-0"
        >
          <LogOut size={14} />
          <span>Выйти</span>
        </button>
      </div>

      {/* Top Banner Slide Notifications Drawer (Floating) */}
      <div className="absolute top-16 right-4 z-50 flex flex-col space-y-2 max-w-sm pointer-events-none">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className="p-3 bg-zinc-950/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl flex items-center space-x-2.5 text-xs text-white pointer-events-auto transform transition-all animate-[slideIn_0.3s_ease]"
          >
            <AlertCircle size={14} className="text-blue-400 shrink-0" />
            <p className="font-medium">{notif.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
