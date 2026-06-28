export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  role: "host" | "moderator" | "participant";
  status: "online" | "dnd";
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: string;
  file?: {
    name: string;
    size: string;
    type: string;
    url: string;
  };
  replyTo?: {
    id: string;
    userName: string;
    text: string;
  };
}

export interface WhiteboardAction {
  id: string;
  type: "draw" | "shape" | "text" | "clear";
  userId: string;
  color: string;
  thickness: number;
  points?: number[]; // [x1, y1, x2, y2, ...]
  shapeType?: "circle" | "square" | "line" | "arrow";
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  text?: string;
  position?: { x: number; y: number };
}

export interface RoomState {
  id: string;
  name: string;
  isLocked: boolean;
  isChatLocked: boolean;
  isBoardLocked: boolean;
  hostId: string;
  users: { [userId: string]: UserProfile };
  whiteboardData: WhiteboardAction[];
  messages: ChatMessage[];
}

export interface ScheduledMeeting {
  id: string;
  title: string;
  hostName: string;
  time: string;
  password?: string;
  maxParticipants: number;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "dnd" | "offline";
  isFavorite?: boolean;
}

export interface NotificationItem {
  id: string;
  text: string;
  type: "join" | "leave" | "screen" | "hand" | "reaction" | "system" | "admin";
  timestamp: Date;
}
