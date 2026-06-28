import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Video, 
  Calendar, 
  Plus, 
  Users, 
  Settings, 
  History, 
  LogOut, 
  Copy, 
  Check, 
  Clock, 
  UserPlus, 
  Sun, 
  Moon,
  Keyboard,
  Compass,
  BellRing
} from "lucide-react";
import { ScheduledMeeting, Friend } from "../types";

interface LobbyProps {
  onJoinRoom: (roomId: string, name: string, avatar: string, password?: string, hostOptions?: any) => void;
  scheduledMeetings: ScheduledMeeting[];
  onAddScheduledMeeting: (meeting: Partial<ScheduledMeeting>) => void;
}

export default function Lobby({
  onJoinRoom,
  scheduledMeetings,
  onAddScheduledMeeting
}: LobbyProps) {
  // Theme & Settings State
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [enableDesktopNotif, setEnableDesktopNotif] = useState(true);

  // Profile setup
  const [username, setUsername] = useState(() => localStorage.getItem("conf-username") || "Антон (Разработчик)");
  const [avatarIndex, setAvatarIndex] = useState(() => Number(localStorage.getItem("conf-avatar-idx") || "0"));
  const [activeStatus, setActiveStatus] = useState<"online" | "dnd">("online");

  // Create conference configuration
  const [createTitle, setCreateTitle] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(15);

  // Join configuration
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");

  // Schedule config
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [schedulePass, setSchedulePass] = useState("");

  // Recent Rooms
  const [recentRooms, setRecentRooms] = useState<{ id: string; name: string; date: string }[]>([]);

  // Friends drawer state
  const [showFriends, setShowFriends] = useState(false);
  const [friendsList, setFriendsList] = useState<Friend[]>([
    { id: "fr-1", name: "Алина (Дизайнер)", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop", status: "online", isFavorite: true },
    { id: "fr-2", name: "Дмитрий (iOS Dev)", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop", status: "dnd" },
    { id: "fr-3", name: "Светлана (QA)", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", status: "offline" }
  ]);
  const [newFriendName, setNewFriendName] = useState("");

  // Presets of beautiful avatars
  const avatarPresets = [
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop", // Male dev
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop", // Female designer
    "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop", // Male manager
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", // Female QA
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"  // Male system architect
  ];

  // Save profile state automatically
  useEffect(() => {
    localStorage.setItem("conf-username", username);
    localStorage.setItem("conf-avatar-idx", String(avatarIndex));
  }, [username, avatarIndex]);

  // Load recent meetings
  useEffect(() => {
    const loaded = JSON.parse(localStorage.getItem("conf-recent") || "[]");
    setRecentRooms(loaded);
  }, []);

  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = `meet-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
    
    // Add to recent rooms
    const record = { id: cleanId, name: createTitle || `Конференция ${cleanId}`, date: new Date().toLocaleDateString() };
    const updated = [record, ...recentRooms.filter(r => r.id !== cleanId)].slice(0, 5);
    localStorage.setItem("conf-recent", JSON.stringify(updated));
    
    onJoinRoom(cleanId, username, avatarPresets[avatarIndex], createPassword || undefined, {
      maxParticipants,
      title: createTitle
    });
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    
    // Sanitize code
    const cleanId = joinCode.trim().toLowerCase();

    // Add to recents
    const record = { id: cleanId, name: `Конференция ${cleanId}`, date: new Date().toLocaleDateString() };
    const updated = [record, ...recentRooms.filter(r => r.id !== cleanId)].slice(0, 5);
    localStorage.setItem("conf-recent", JSON.stringify(updated));

    onJoinRoom(cleanId, username, avatarPresets[avatarIndex], joinPassword || undefined);
  };

  const handleScheduleMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle.trim() || !scheduleTime) return;

    onAddScheduledMeeting({
      title: scheduleTitle,
      hostName: username,
      time: new Date(scheduleTime).toISOString(),
      password: schedulePass || undefined,
      maxParticipants: 10
    });

    // Reset fields
    setScheduleTitle("");
    setScheduleTime("");
    setSchedulePass("");
    alert("Конференция успешно запланирована!");
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;

    const newFriend: Friend = {
      id: `fr-${Date.now()}`,
      name: newFriendName,
      avatar: avatarPresets[Math.floor(Math.random() * avatarPresets.length)],
      status: "online"
    };

    setFriendsList([...friendsList, newFriend]);
    setNewFriendName("");
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? "bg-[#020617] text-slate-100" : "bg-[#f4f4f5] text-zinc-900"} relative overflow-hidden`}>
      {/* Background Ambient Glows */}
      {isDarkMode && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none z-0" />
        </>
      )}
      
      {/* Header bar */}
      <header className={`px-6 py-4 border-b flex items-center justify-between backdrop-blur-md sticky top-0 z-40 ${isDarkMode ? "border-white/10 bg-[#020617]/80" : "border-zinc-200 bg-white/80"}`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Video size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display tracking-tight leading-none">COLLAB-HUB</h1>
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDarkMode ? "text-gray-500" : "text-zinc-400"}`}>ВИДЕОКОНФЕРЕНЦИИ</span>
          </div>
        </div>

        {/* Profile and Settings toolbar */}
        <div className="flex items-center space-x-3">
          <button
            id="lobby-theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-xl transition-all ${isDarkMode ? "bg-white/5 text-gray-300 hover:bg-white/10" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"}`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            id="lobby-friends-toggle"
            onClick={() => setShowFriends(!showFriends)}
            className={`px-3 py-2 rounded-xl flex items-center space-x-1.5 transition-all text-xs font-medium ${isDarkMode ? "bg-white/5 text-gray-300 hover:bg-white/10" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"}`}
          >
            <Users size={16} />
            <span>Контакты ({friendsList.filter(f => f.status === "online").length})</span>
          </button>

          <button
            id="lobby-settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-all ${isDarkMode ? "bg-white/5 text-gray-300 hover:bg-white/10" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"}`}
          >
            <Settings size={18} />
          </button>

          {/* User mini profile info */}
          <div className="flex items-center space-x-2.5 pl-3 border-l border-white/10">
            <div className="relative">
              <img
                src={avatarPresets[avatarIndex]}
                alt="Profile"
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-white/20"
              />
              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${isDarkMode ? "border-[#09090b]" : "border-white"} ${activeStatus === "online" ? "bg-emerald-500" : "bg-amber-500"}`} />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold">{username}</p>
              <select
                id="lobby-status-select"
                value={activeStatus}
                onChange={(e) => setActiveStatus(e.target.value as any)}
                className="text-[10px] bg-transparent outline-none border-0 text-gray-500 p-0 font-medium cursor-pointer"
              >
                <option value="online" className="bg-zinc-950 text-white">В сети</option>
                <option value="dnd" className="bg-zinc-950 text-white">Не беспокоить</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Grid */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (Profile & Conference Management Actions) */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-8 space-y-6"
        >
          
          {/* Section 1: Profile Customizer */}
          <section className={`p-6 rounded-3xl border transition-all ${isDarkMode ? "bg-[#030712]/40 border-white/10 glass-card" : "bg-white border-zinc-200 shadow-sm"}`}>
            <h3 className="font-display font-semibold text-base mb-4">Ваш цифровой профиль</h3>
            
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Large Avatar frame selector */}
              <div className="flex flex-col items-center space-y-2">
                <img
                  src={avatarPresets[avatarIndex]}
                  alt="Current Profile"
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-full border-4 border-blue-500/20 object-cover shadow-2xl"
                />
                <span className="text-xs text-gray-400">Выберите аватар:</span>
                <div className="flex space-x-1.5">
                  {avatarPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAvatarIndex(idx)}
                      className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${avatarIndex === idx ? "border-blue-500 scale-105" : "border-transparent"}`}
                    >
                      <img src={preset} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Username text customizer */}
              <div className="flex-grow w-full space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Ваше имя или никнейм</label>
                  <input
                    id="profile-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Например, Антон (Разработчик)"
                    className={`w-full px-4 py-3 text-sm rounded-xl outline-none border transition-all ${isDarkMode ? "bg-black/20 border-white/5 text-white focus:border-blue-500/50" : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-blue-500"}`}
                  />
                </div>
                
                <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center space-x-3">
                  <BellRing size={16} className="text-blue-400" />
                  <p className="text-xs text-blue-300 leading-relaxed">
                    Все настройки сохраняются локально. Входя в комнату, другие участники мгновенно увидят выбранное имя и аватар.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Meeting Actions Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Conference form */}
            <section className={`p-6 rounded-3xl border transition-all ${isDarkMode ? "bg-[#030712]/40 border-white/10 glass-card" : "bg-white border-zinc-200 shadow-sm"}`}>
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Plus size={18} />
                </div>
                <h3 className="font-display font-semibold text-base">Создать конференцию</h3>
              </div>

              <form onSubmit={handleCreateMeeting} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Название комнаты (необязательно)</label>
                  <input
                    id="create-room-title"
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="Синк, Летучка, Чат..."
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border transition-all ${isDarkMode ? "bg-black/20 border-white/5 text-white focus:border-blue-500" : "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-blue-500"}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Пароль комнаты (необязательно)</label>
                  <input
                    id="create-room-pass"
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Пароль для приватности"
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border transition-all ${isDarkMode ? "bg-black/20 border-white/5 text-white focus:border-blue-500" : "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-blue-500"}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Лимит участников</label>
                  <select
                    id="create-room-limit"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border transition-all ${isDarkMode ? "bg-black/20 border-white/5 text-white focus:border-blue-500" : "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-blue-500"}`}
                  >
                    <option value={5} className="bg-zinc-950 text-white">5 участников</option>
                    <option value={15} className="bg-zinc-950 text-white">15 участников (Стандарт)</option>
                    <option value={50} className="bg-zinc-950 text-white">50 участников</option>
                  </select>
                </div>

                <button
                  id="create-room-submit-btn"
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-semibold tracking-wider transition-all hover:shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  СОЗДАТЬ И ВОЙТИ
                </button>
              </form>
            </section>

            {/* Join Conference form */}
            <section className={`p-6 rounded-3xl border transition-all ${isDarkMode ? "bg-[#030712]/40 border-white/10 glass-card" : "bg-white border-zinc-200 shadow-sm"}`}>
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Compass size={18} />
                </div>
                <h3 className="font-display font-semibold text-base">Подключиться к комнате</h3>
              </div>

              <form onSubmit={handleJoinMeeting} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Код конференции</label>
                  <input
                    id="join-room-code"
                    type="text"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Например: meet-543-982"
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border transition-all ${isDarkMode ? "bg-black/20 border-white/5 text-white focus:border-blue-500" : "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-blue-500"}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Пароль (если требуется)</label>
                  <input
                    id="join-room-pass"
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Пароль от организатора"
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border transition-all ${isDarkMode ? "bg-black/20 border-white/5 text-white focus:border-blue-500" : "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-blue-500"}`}
                  />
                </div>

                <div className="p-3 bg-white/[0.02] rounded-xl border border-white/5 text-[10px] text-gray-500 leading-normal">
                  Вы можете мгновенно подключиться по коду, либо открыть общую ссылку-приглашение в браузере.
                </div>

                <button
                  id="join-room-submit-btn"
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-semibold tracking-wider transition-all hover:shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  ПОДКЛЮЧИТЬСЯ ПО КОДУ
                </button>
              </form>
            </section>
          </div>

          {/* Section 3: Schedule a Meeting Panel */}
          <section className={`p-6 rounded-3xl border transition-all ${isDarkMode ? "bg-[#030712]/40 border-white/10 glass-card" : "bg-white border-zinc-200 shadow-sm"}`}>
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Calendar size={18} />
              </div>
              <h3 className="font-display font-semibold text-base">Запланировать новую встречу</h3>
            </div>

            <form onSubmit={handleScheduleMeeting} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Тема встречи</label>
                <input
                  id="schedule-title"
                  type="text"
                  required
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                  placeholder="Обсуждение проекта..."
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border transition-all ${isDarkMode ? "bg-black/20 border-white/5 text-white focus:border-blue-500" : "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-blue-500"}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Дата и время</label>
                <input
                  id="schedule-time"
                  type="datetime-local"
                  required
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border transition-all ${isDarkMode ? "bg-black/20 border-white/5 text-white focus:border-blue-500" : "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-blue-500"}`}
                />
              </div>

              <button
                id="schedule-submit-btn"
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-xs font-semibold tracking-wider transition-all hover:shadow-lg shadow-emerald-500/20 cursor-pointer w-full"
              >
                ЗАПЛАНИРОВАТЬ
              </button>
            </form>
          </section>

          {/* Section 4: Recent History List */}
          {recentRooms.length > 0 && (
            <section className={`p-6 rounded-3xl border transition-all ${isDarkMode ? "bg-[#030712]/40 border-white/10 glass-card" : "bg-white border-zinc-200 shadow-sm"}`}>
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                  <History size={18} />
                </div>
                <h3 className="font-display font-semibold text-base">Недавние конференции</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentRooms.map((room, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all hover:-translate-y-0.5 ${isDarkMode ? "bg-black/20 border-white/5 hover:bg-white/[0.03]" : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"}`}
                  >
                    <div className="truncate pr-3">
                      <p className="text-xs font-semibold truncate text-blue-400">{room.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Дата: {room.date} • {room.id}</p>
                    </div>
                    <button
                      id={`recent-join-${idx}`}
                      onClick={() => onJoinRoom(room.id, username, avatarPresets[avatarIndex])}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold rounded-lg shrink-0"
                    >
                      Войти
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

        </motion.div>

        {/* Right Column (Scheduled meetings & Friends System Panel) */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-4 space-y-6"
        >
          
          {/* Section 1: Scheduled Meetings Panel */}
          <section className={`p-6 rounded-3xl border transition-all ${isDarkMode ? "bg-[#030712]/40 border-white/10 glass-card" : "bg-white border-zinc-200 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Clock size={16} className="text-amber-400" />
                <h3 className="font-display font-semibold text-sm">Предстоящие встречи</h3>
              </div>
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold uppercase">План</span>
            </div>

            <div className="space-y-3">
              {scheduledMeetings.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Нет запланированных встреч</p>
              ) : (
                scheduledMeetings.map((meet, idx) => (
                  <div
                    key={idx}
                    id={`sched-${meet.id}`}
                    className={`p-3.5 rounded-xl border flex flex-col space-y-2.5 transition-all ${isDarkMode ? "bg-black/20 border-white/5" : "bg-zinc-50 border-zinc-200"}`}
                  >
                    <div>
                      <h4 className="text-xs font-semibold leading-tight text-white">{meet.title}</h4>
                      <p className="text-[10px] text-gray-500 mt-1">Организатор: {meet.hostName}</p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-gray-400">
                        <Clock size={12} className="text-blue-400" />
                        <span className="text-[10px] font-mono">
                          {new Date(meet.time).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(meet.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <button
                        id={`sched-join-${meet.id}`}
                        onClick={() => onJoinRoom(meet.id, username, avatarPresets[avatarIndex])}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                      >
                        Запустить
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Section 2: Friends drawer Panel */}
          <section className={`p-6 rounded-3xl border transition-all ${isDarkMode ? "bg-[#030712]/40 border-white/10 glass-card" : "bg-white border-zinc-200 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Users size={16} className="text-pink-400" />
                <h3 className="font-display font-semibold text-sm">Мои друзья и коллеги</h3>
              </div>
            </div>

            {/* Quick add form */}
            <form onSubmit={handleAddFriend} className="flex items-center space-x-1 mb-4">
              <input
                id="add-friend-input"
                type="text"
                required
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                placeholder="Добавить по имени..."
                className={`flex-grow px-3 py-2 text-xs rounded-lg outline-none border transition-all ${isDarkMode ? "bg-black/20 border-white/5 text-white focus:border-blue-500" : "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-blue-500"}`}
              />
              <button
                id="add-friend-submit"
                type="submit"
                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shrink-0"
              >
                <UserPlus size={14} />
              </button>
            </form>

            <div className="space-y-2.5">
              {friendsList.map((friend) => (
                <div
                  key={friend.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between ${isDarkMode ? "bg-black/10 border-white/5" : "bg-zinc-50 border-zinc-200"}`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="relative">
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border ${isDarkMode ? "border-[#121214]" : "border-white"} ${friend.status === "online" ? "bg-emerald-500" : friend.status === "dnd" ? "bg-amber-500 animate-pulse" : "bg-gray-400"}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold">{friend.name}</p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">{friend.status === "online" ? "В сети" : friend.status === "dnd" ? "Не беспокоить" : "Офлайн"}</p>
                    </div>
                  </div>

                  {friend.status !== "offline" && (
                    <button
                      id={`invite-friend-${friend.id}`}
                      onClick={() => {
                        const directRoom = `meet-direct-${Math.floor(100+Math.random()*900)}`;
                        alert(`Отправлено приглашение пользователю ${friend.name} подключиться к комнате ${directRoom}!`);
                        onJoinRoom(directRoom, username, avatarPresets[avatarIndex]);
                      }}
                      className="px-2.5 py-1 bg-gradient-to-tr from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-[9px] font-bold rounded-lg uppercase tracking-wider shadow-sm"
                    >
                      Звонок
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

        </motion.div>
      </main>

      {/* Slide-out Settings drawer / dialog overlay */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#030712]/90 border border-white/10 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl relative glass-card">
            <button
              id="close-settings-btn"
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-white/5 rounded-full"
            >
              <X icon="" size={18} />
            </button>

            <h3 className="font-display font-bold text-lg mb-4 flex items-center space-x-2">
              <Settings className="text-blue-500" />
              <span>Системные Настройки</span>
            </h3>

            <div className="space-y-4">
              {/* Notification toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <p className="text-xs font-semibold">Уведомления в браузере</p>
                  <p className="text-[10px] text-gray-500">Показывать оповещения о входе участников</p>
                </div>
                <input
                  id="settings-notif-toggle"
                  type="checkbox"
                  checked={enableDesktopNotif}
                  onChange={(e) => setEnableDesktopNotif(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-blue-600"
                />
              </div>

              {/* Hotkeys */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2.5">
                <p className="text-xs font-semibold text-gray-400 flex items-center space-x-1">
                  <Keyboard size={14} className="text-blue-400" />
                  <span>Быстрые горячие клавиши:</span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-300">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span>M</span>
                    <span className="text-blue-400 font-bold">Вкл/Выкл Микрофон</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span>V</span>
                    <span className="text-blue-400 font-bold">Вкл/Выкл Камеру</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span>W</span>
                    <span className="text-blue-400 font-bold">Открыть Доску</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span>C</span>
                    <span className="text-blue-400 font-bold">Открыть Чат</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              id="settings-close-submit"
              onClick={() => setShowSettings(false)}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              СОХРАНИТЬ И ЗАКРЫТЬ
            </button>
          </div>
        </div>
      )}

      {/* Footer credit */}
      <footer className="py-6 text-center text-[10px] text-gray-500 border-t border-white/5 mt-auto bg-black/10">
        <p>© 2026 Collab-Hub Video Platform. Поддержка WebRTC 2.0, WebSockets и Canvas-Whiteboard.</p>
      </footer>
    </div>
  );
}

// Custom simple icon component fallback inside setting
function X({ icon, size }: { icon: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
