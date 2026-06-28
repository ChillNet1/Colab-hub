import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Paperclip, 
  Smile, 
  Trash2, 
  CornerUpLeft, 
  FileText, 
  Image, 
  X,
  Lock,
  Download
} from "lucide-react";
import { ChatMessage, UserProfile } from "../types";

interface ChatSidebarProps {
  userId: string;
  isHost: boolean;
  isChatLocked: boolean;
  messages: ChatMessage[];
  onSendMessage: (text: string, file?: any, replyTo?: any) => void;
  onDeleteMessage: (id: string) => void;
}

export default function ChatSidebar({
  userId,
  isHost,
  isChatLocked,
  messages,
  onSendMessage,
  onDeleteMessage
}: ChatSidebarProps) {
  const [inputText, setInputText] = useState("");
  const [selectedReply, setSelectedReply] = useState<ChatMessage | null>(null);
  
  // File upload states
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string; type: string; url: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !attachedFile) return;

    if (isChatLocked && !isHost) {
      alert("Чат временно заблокирован организатором");
      return;
    }

    onSendMessage(
      inputText, 
      attachedFile || undefined, 
      selectedReply ? { id: selectedReply.id, userName: selectedReply.userName, text: selectedReply.text } : undefined
    );

    // Reset states
    setInputText("");
    setAttachedFile(null);
    setSelectedReply(null);
  };

  // Drag and drop attachment handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    // Show mock loading/upload animation
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev === null) return null;
        if (prev >= 100) {
          clearInterval(interval);
          setUploadProgress(null);
          // Set final file info
          setAttachedFile({
            name: file.name,
            size: `${(file.size / 1024).toFixed(1)} КБ`,
            type: file.type,
            url: "#" // mock URL
          });
          return 100;
        }
        return prev + 30;
      });
    }, 200);
  };

  // Quick Emoji Click append
  const quickEmojis = ["👍", "❤️", "😂", "👏", "🔥", "😮", "🙌", "💡", "🚀"];

  const handleEmojiClick = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  return (
    <div 
      className="flex flex-col h-full bg-[#020617]/60 border-l border-white/10 text-white w-full backdrop-blur-md"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
        <h3 className="font-semibold text-sm tracking-wide">Групповой чат</h3>
        {isChatLocked && (
          <div className="flex items-center text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] space-x-1 font-semibold uppercase tracking-wide">
            <Lock size={10} />
            <span>Чат закрыт</span>
          </div>
        )}
      </div>

      {/* Message History */}
      <div className="flex-grow p-4 overflow-y-auto space-y-4 relative">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="p-4 rounded-full bg-white/5 mb-3">
              <Smile size={24} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-300 font-medium">Нет сообщений</p>
            <p className="text-xs text-gray-500 mt-1">Будьте первыми! Отправьте приветствие.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.userId === userId;
            return (
              <div 
                key={msg.id}
                id={`chat-msg-${msg.id}`}
                className={`flex flex-col space-y-1 group ${isSelf ? "items-end" : "items-start"}`}
              >
                {/* Replying indicator */}
                {msg.replyTo && (
                  <div className="text-[10px] text-gray-500 flex items-center space-x-1 bg-white/[0.02] px-2 py-0.5 rounded border border-white/5">
                    <CornerUpLeft size={8} />
                    <span>Ответ на {msg.replyTo.userName}:</span>
                    <span className="truncate max-w-[120px] italic">"{msg.replyTo.text}"</span>
                  </div>
                )}

                <div className={`flex items-start space-x-2 max-w-[85%] ${isSelf ? "flex-row-reverse space-x-reverse" : ""}`}>
                  {/* Sender Avatar */}
                  <img
                    src={msg.userAvatar}
                    alt={msg.userName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                  />

                  {/* Message Bubble */}
                  <div className={`flex flex-col rounded-2xl p-3 text-sm relative ${isSelf ? "bg-blue-600 text-white rounded-tr-none" : "bg-white/5 text-gray-200 rounded-tl-none"}`}>
                    
                    {/* Header: Name & Time */}
                    <div className="flex items-center space-x-1.5 justify-between mb-1">
                      <span className="font-semibold text-xs text-white truncate max-w-[100px]">{msg.userName}</span>
                      <span className="text-[10px] opacity-60 font-mono">{msg.timestamp}</span>
                    </div>

                    {/* Attached file rendering */}
                    {msg.file && (
                      <div className="mb-2 p-2 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center space-x-2 truncate">
                          {msg.file.type.startsWith("image/") ? <Image size={14} className="text-blue-400 shrink-0" /> : <FileText size={14} className="text-amber-400 shrink-0" />}
                          <div className="truncate">
                            <p className="font-medium truncate text-white">{msg.file.name}</p>
                            <p className="text-[10px] opacity-60">{msg.file.size}</p>
                          </div>
                        </div>
                        <a
                          id={`download-${msg.id}`}
                          href={msg.file.url}
                          download
                          className="p-1 hover:bg-white/10 rounded text-gray-300"
                          title="Скачать файл"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    )}

                    {/* Text content */}
                    {msg.text && <p className="leading-relaxed break-words">{msg.text}</p>}

                    {/* Message Actions Menu (Replies and deletions) */}
                    <div className={`absolute top-0 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 p-0.5 rounded-lg bg-zinc-900 border border-white/10 shadow-lg ${isSelf ? "right-full mr-2" : "left-full ml-2"}`}>
                      <button
                        id={`reply-btn-${msg.id}`}
                        onClick={() => setSelectedReply(msg)}
                        className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white"
                        title="Ответить"
                      >
                        <CornerUpLeft size={12} />
                      </button>
                      
                      {(isSelf || isHost) && (
                        <button
                          id={`delete-btn-${msg.id}`}
                          onClick={() => onDeleteMessage(msg.id)}
                          className="p-1 hover:bg-rose-500/10 rounded text-gray-400 hover:text-rose-400"
                          title="Удалить"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />

        {/* Drag Overlay HUD */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-500 m-2 rounded-xl flex flex-col items-center justify-center text-center text-blue-300 z-30 pointer-events-none">
            <Paperclip size={32} className="animate-bounce mb-2" />
            <span className="font-semibold text-sm">Перетащите файлы сюда для отправки</span>
          </div>
        )}
      </div>

      {/* Input controls & attachment state previews */}
      <div className="p-3 border-t border-white/5 bg-white/[0.01]">
        
        {/* Reply HUD banner */}
        {selectedReply && (
          <div className="mb-2 p-2 bg-zinc-900/60 border border-white/5 rounded-lg flex items-center justify-between text-xs text-gray-300">
            <div className="truncate pr-4">
              <span className="font-semibold text-blue-400">Ответ {selectedReply.userName}: </span>
              <span className="italic">"{selectedReply.text}"</span>
            </div>
            <button id="cancel-reply" onClick={() => setSelectedReply(null)} className="text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Upload attachment loading state */}
        {uploadProgress !== null && (
          <div className="mb-2 p-2 bg-zinc-900 border border-white/5 rounded-lg flex items-center justify-between text-xs text-gray-400">
            <span>Загрузка файла...</span>
            <div className="w-24 bg-white/10 rounded-full h-1 overflow-hidden">
              <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* Attached file ready tag */}
        {attachedFile && (
          <div className="mb-2 p-2 bg-blue-950/40 border border-blue-500/20 rounded-lg flex items-center justify-between text-xs text-blue-300">
            <div className="flex items-center space-x-2 truncate">
              <Paperclip size={12} />
              <span className="font-medium truncate">{attachedFile.name}</span>
              <span className="opacity-60 shrink-0 font-mono">({attachedFile.size})</span>
            </div>
            <button id="cancel-file" onClick={() => setAttachedFile(null)} className="text-blue-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Quick emojis strip */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-2 mb-2 border-b border-white/5">
          {quickEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              disabled={isChatLocked && !isHost}
              className="text-xs p-1 rounded hover:bg-white/5 active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Message Input form bar */}
        <form onSubmit={handleSend} className="flex items-center space-x-1.5 relative">
          <button
            id="attach-file-btn"
            type="button"
            disabled={isChatLocked && !isHost}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-colors shrink-0 disabled:opacity-30"
            title="Прикрепить файл"
          >
            <Paperclip size={16} />
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />

          <input
            id="chat-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isChatLocked && !isHost}
            placeholder={isChatLocked && !isHost ? "Чат заблокирован" : "Введите сообщение..."}
            className="flex-grow bg-white/5 hover:bg-white/10 focus:bg-white/5 focus:ring-1 focus:ring-blue-500/50 text-white rounded-xl py-2 px-3 text-xs outline-none border border-transparent focus:border-blue-500/50 transition-all placeholder:text-gray-500 disabled:opacity-50"
          />

          <button
            id="send-msg-btn"
            type="submit"
            disabled={(isChatLocked && !isHost) || (!inputText.trim() && !attachedFile)}
            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-gray-500 text-white rounded-xl transition-all shrink-0 cursor-pointer"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
