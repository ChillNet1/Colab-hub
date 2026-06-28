import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface User {
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

interface ChatMessage {
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

interface WhiteboardAction {
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

interface Room {
  id: string;
  name: string;
  password?: string;
  maxParticipants: number;
  isLocked: boolean;
  isChatLocked: boolean;
  isBoardLocked: boolean;
  hostId: string;
  users: { [userId: string]: User };
  whiteboardData: WhiteboardAction[];
  messages: ChatMessage[];
}

interface ScheduledMeeting {
  id: string;
  title: string;
  hostName: string;
  time: string;
  password?: string;
  maxParticipants: number;
}

// Global in-memory storage
const rooms: { [roomId: string]: Room } = {};
const scheduledMeetings: ScheduledMeeting[] = [
  {
    id: "meet-999-111",
    title: "Еженедельный синк по дизайну",
    hostName: "Алина (Дизайнер)",
    time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    maxParticipants: 10
  },
  {
    id: "meet-888-222",
    title: "Планирование спринта",
    hostName: "Алексей (PM)",
    time: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    maxParticipants: 15
  }
];

// Active WebSocket connections mapped by userId -> WebSocket
const activeConnections: { [userId: string]: WebSocket } = {};
// User's active room mapping userId -> roomId
const userRooms: { [userId: string]: string } = {};

const app = express();
const PORT = 3000;

app.use(express.json());

// API Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/meetings", (req, res) => {
  res.json(scheduledMeetings);
});

app.post("/api/meetings", (req, res) => {
  const { title, hostName, time, password, maxParticipants } = req.body;
  if (!title || !hostName || !time) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const newMeeting: ScheduledMeeting = {
    id: `meet-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`,
    title,
    hostName,
    time,
    password,
    maxParticipants: maxParticipants || 10
  };
  scheduledMeetings.push(newMeeting);
  res.status(201).json(newMeeting);
});

// Helper to broadcast to a room
function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
  const room = rooms[roomId];
  if (!room) return;

  const payload = JSON.stringify(message);
  Object.keys(room.users).forEach((uId) => {
    if (uId === excludeUserId) return;
    const ws = activeConnections[uId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// Virtual Interactive Participants Manager (Demo Mode)
const activeRoomDemoTimers: { [roomId: string]: NodeJS.Timeout[] } = {};

function startDemoParticipants(roomId: string) {
  if (activeRoomDemoTimers[roomId]) return; // already running

  const room = rooms[roomId];
  if (!room) return;

  const demoUsers: User[] = [
    {
      id: "demo-pm",
      name: "Алексей (Product Manager)",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
      isMicOn: true,
      isCamOn: true,
      isScreenSharing: false,
      isHandRaised: false,
      role: "moderator",
      status: "online"
    },
    {
      id: "demo-designer",
      name: "Елена (Designer)",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      isMicOn: false,
      isCamOn: true,
      isScreenSharing: false,
      isHandRaised: false,
      role: "participant",
      status: "online"
    }
  ];

  // Add them to room state
  demoUsers.forEach(du => {
    room.users[du.id] = du;
  });

  // Broadcast join
  demoUsers.forEach(du => {
    broadcastToRoom(roomId, {
      type: "user_joined",
      user: du
    });
  });

  const timers: NodeJS.Timeout[] = [];

  // Chat messages simulation
  const chatScenarios = [
    { delay: 8000, userId: "demo-pm", text: "Всем привет! Как слышно?" },
    { delay: 15000, userId: "demo-designer", text: "Привет! Видео и звук отличные 🙌. Я готова показать доску." },
    { delay: 30000, userId: "demo-pm", text: "Елена, нарисуй на доске примерную схему интерфейса, пожалуйста." },
    { delay: 45000, userId: "demo-designer", text: "Секунду, сейчас нарисую концепт главного экрана..." },
    { delay: 70000, userId: "demo-pm", text: "Классный концепт! 👍 Давайте проголосуем реакциями." }
  ];

  chatScenarios.forEach(scenario => {
    const timer = setTimeout(() => {
      const roomCheck = rooms[roomId];
      if (!roomCheck || !roomCheck.users[scenario.userId]) return;
      if (roomCheck.isChatLocked) return;

      const user = roomCheck.users[scenario.userId];
      const msg: ChatMessage = {
        id: `msg-demo-${Math.random()}`,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        text: scenario.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      roomCheck.messages.push(msg);
      broadcastToRoom(roomId, {
        type: "chat_message",
        message: msg
      });
    }, scenario.delay);
    timers.push(timer);
  });

  // Reaction simulations
  const reactionInterval = setInterval(() => {
    const roomCheck = rooms[roomId];
    if (!roomCheck) return;
    const activeDemoUsers = ["demo-pm", "demo-designer"].filter(id => roomCheck.users[id]);
    if (activeDemoUsers.length === 0) return;

    const randomUser = activeDemoUsers[Math.floor(Math.random() * activeDemoUsers.length)];
    const reactions = ["👍", "❤️", "😂", "👏", "🔥", "😮"];
    const randomEmoji = reactions[Math.floor(Math.random() * reactions.length)];

    broadcastToRoom(roomId, {
      type: "reaction",
      userId: randomUser,
      userName: roomCheck.users[randomUser].name,
      emoji: randomEmoji
    });
  }, 18000);
  timers.push(reactionInterval);

  // Whiteboard drawing simulation
  const drawTimer = setTimeout(() => {
    const roomCheck = rooms[roomId];
    if (!roomCheck || roomCheck.isBoardLocked || !roomCheck.users["demo-designer"]) return;

    // Simulate "Elena" drawing on whiteboard
    // Step 1: Cursor moves
    let steps = 0;
    const startX = 200, startY = 150;
    const drawInterval = setInterval(() => {
      const innerRoom = rooms[roomId];
      if (!innerRoom || innerRoom.isBoardLocked || !innerRoom.users["demo-designer"]) {
        clearInterval(drawInterval);
        return;
      }

      steps++;
      const currentX = startX + steps * 15;
      const currentY = startY + Math.sin(steps / 2) * 30;

      // Broadcast cursor move
      broadcastToRoom(roomId, {
        type: "whiteboard_cursor",
        userId: "demo-designer",
        userName: "Елена (Designer)",
        color: "#ec4899", // pink-500
        x: currentX,
        y: currentY
      });

      if (steps > 15) {
        clearInterval(drawInterval);
        // Save simulated path to room whiteboard actions
        const action: WhiteboardAction = {
          id: `draw-${Math.random()}`,
          type: "shape",
          userId: "demo-designer",
          color: "#ec4899",
          thickness: 4,
          shapeType: "circle",
          startPoint: { x: startX, y: startY },
          endPoint: { x: currentX, y: currentY + 20 }
        };
        innerRoom.whiteboardData.push(action);
        broadcastToRoom(roomId, {
          type: "whiteboard_draw",
          action
        });
      }
    }, 200);

  }, 50000);
  timers.push(drawTimer);

  // Periodic Raise Hand simulation
  const handTimer = setTimeout(() => {
    const roomCheck = rooms[roomId];
    if (!roomCheck || !roomCheck.users["demo-designer"]) return;

    roomCheck.users["demo-designer"].isHandRaised = true;
    broadcastToRoom(roomId, {
      type: "user_state_update",
      userId: "demo-designer",
      updates: { isHandRaised: true }
    });

    // Chat comment about hand raised
    const msg: ChatMessage = {
      id: `msg-demo-hand`,
      userId: "demo-designer",
      userName: "Елена (Designer)",
      userAvatar: roomCheck.users["demo-designer"].avatar,
      text: "Я подняла руку, хочу задать вопрос по макету 🙋‍♀️",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    roomCheck.messages.push(msg);
    broadcastToRoom(roomId, {
      type: "chat_message",
      message: msg
    });

  }, 35000);
  timers.push(handTimer);

  activeRoomDemoTimers[roomId] = timers;
}

function stopDemoParticipants(roomId: string) {
  const timers = activeRoomDemoTimers[roomId];
  if (timers) {
    timers.forEach(clearTimeout);
    timers.forEach(clearInterval);
    delete activeRoomDemoTimers[roomId];
  }
}

// HTTP Server
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws: WebSocket) => {
  let currentUserId: string | null = null;

  ws.on("message", (messageStr: string) => {
    try {
      const message = JSON.parse(messageStr);
      const { type } = message;

      switch (type) {
        case "join": {
          const { roomId, userId, name, avatar, role, password } = message;
          currentUserId = userId;
          activeConnections[userId] = ws;
          userRooms[userId] = roomId;

          // Check room exists or create
          if (!rooms[roomId]) {
            rooms[roomId] = {
              id: roomId,
              name: `Комната ${roomId.replace("meet-", "")}`,
              password: password || undefined,
              maxParticipants: 15,
              isLocked: false,
              isChatLocked: false,
              isBoardLocked: false,
              hostId: userId, // First user is the host
              users: {},
              whiteboardData: [],
              messages: []
            };
          }

          const room = rooms[roomId];

          // Validate password if set
          if (room.password && room.password !== password && room.hostId !== userId) {
            ws.send(JSON.stringify({ type: "error", message: "Неверный пароль комнаты" }));
            return;
          }

          // Validate capacity
          if (Object.keys(room.users).length >= room.maxParticipants) {
            ws.send(JSON.stringify({ type: "error", message: "Комната переполнена" }));
            return;
          }

          // Validate room lock
          if (room.isLocked && room.hostId !== userId) {
            ws.send(JSON.stringify({ type: "error", message: "Комната заблокирована администратором" }));
            return;
          }

          // Setup user state
          const user: User = {
            id: userId,
            name,
            avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
            isMicOn: true,
            isCamOn: true,
            isScreenSharing: false,
            isHandRaised: false,
            role: room.hostId === userId ? "host" : role || "participant",
            status: "online"
          };

          room.users[userId] = user;

          // Send confirmation + initial state to joiner
          ws.send(JSON.stringify({
            type: "join_success",
            room: {
              id: room.id,
              name: room.name,
              isLocked: room.isLocked,
              isChatLocked: room.isChatLocked,
              isBoardLocked: room.isBoardLocked,
              hostId: room.hostId,
              users: room.users,
              whiteboardData: room.whiteboardData,
              messages: room.messages
            }
          }));

          // Broadcast join event to everyone else
          broadcastToRoom(roomId, {
            type: "user_joined",
            user
          }, userId);

          // Automatically kickstart demo participants to make the experience lively!
          if (roomId.includes("demo") || roomId === "demo-room" || Object.keys(room.users).length === 1) {
            startDemoParticipants(roomId);
          }
          break;
        }

        case "user_state_update": {
          const { updates } = message;
          if (!currentUserId) return;
          const roomId = userRooms[currentUserId];
          const room = rooms[roomId];
          if (!room || !room.users[currentUserId]) return;

          // Merge updates
          room.users[currentUserId] = {
            ...room.users[currentUserId],
            ...updates
          };

          // Broadcast update
          broadcastToRoom(roomId, {
            type: "user_state_update",
            userId: currentUserId,
            updates
          });
          break;
        }

        case "chat_message": {
          if (!currentUserId) return;
          const roomId = userRooms[currentUserId];
          const room = rooms[roomId];
          if (!room) return;

          if (room.isChatLocked && room.hostId !== currentUserId) {
            ws.send(JSON.stringify({ type: "error", message: "Чат временно заблокирован администратором" }));
            return;
          }

          const user = room.users[currentUserId];
          const chatMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random()}`,
            userId: currentUserId,
            userName: user?.name || "Участник",
            userAvatar: user?.avatar || "",
            text: message.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            file: message.file,
            replyTo: message.replyTo
          };

          room.messages.push(chatMsg);

          broadcastToRoom(roomId, {
            type: "chat_message",
            message: chatMsg
          });
          break;
        }

        case "chat_message_delete": {
          const { messageId } = message;
          if (!currentUserId) return;
          const roomId = userRooms[currentUserId];
          const room = rooms[roomId];
          if (!room) return;

          room.messages = room.messages.filter(m => m.id !== messageId);
          broadcastToRoom(roomId, {
            type: "chat_message_delete",
            messageId
          });
          break;
        }

        case "whiteboard_draw": {
          const { action } = message;
          if (!currentUserId) return;
          const roomId = userRooms[currentUserId];
          const room = rooms[roomId];
          if (!room) return;

          if (room.isBoardLocked && room.hostId !== currentUserId) {
            return; // blocked
          }

          room.whiteboardData.push(action);
          broadcastToRoom(roomId, {
            type: "whiteboard_draw",
            action
          }, currentUserId);
          break;
        }

        case "whiteboard_cursor": {
          const { x, y, color } = message;
          if (!currentUserId) return;
          const roomId = userRooms[currentUserId];
          const room = rooms[roomId];
          if (!room) return;

          const user = room.users[currentUserId];
          broadcastToRoom(roomId, {
            type: "whiteboard_cursor",
            userId: currentUserId,
            userName: user?.name || "Пользователь",
            color: color || "#3b82f6",
            x,
            y
          }, currentUserId);
          break;
        }

        case "whiteboard_clear": {
          if (!currentUserId) return;
          const roomId = userRooms[currentUserId];
          const room = rooms[roomId];
          if (!room) return;

          if (room.isBoardLocked && room.hostId !== currentUserId) return;

          room.whiteboardData = [];
          broadcastToRoom(roomId, {
            type: "whiteboard_clear"
          });
          break;
        }

        case "reaction": {
          const { emoji } = message;
          if (!currentUserId) return;
          const roomId = userRooms[currentUserId];
          const room = rooms[roomId];
          if (!room) return;

          const user = room.users[currentUserId];
          broadcastToRoom(roomId, {
            type: "reaction",
            userId: currentUserId,
            userName: user?.name || "Участник",
            emoji
          });
          break;
        }

        case "admin_action": {
          const { actionType, targetUserId } = message;
          if (!currentUserId) return;
          const roomId = userRooms[currentUserId];
          const room = rooms[roomId];
          if (!room || room.hostId !== currentUserId) return; // Only host

          switch (actionType) {
            case "mute_all":
              Object.keys(room.users).forEach(uid => {
                if (uid !== currentUserId) {
                  room.users[uid].isMicOn = false;
                  const targetWs = activeConnections[uid];
                  if (targetWs) {
                    targetWs.send(JSON.stringify({
                      type: "admin_action",
                      command: "mute_mic"
                    }));
                  }
                }
              });
              broadcastToRoom(roomId, {
                type: "room_state_sync",
                users: room.users
              });
              break;

            case "mute_user":
              if (targetUserId && room.users[targetUserId]) {
                room.users[targetUserId].isMicOn = false;
                const targetWs = activeConnections[targetUserId];
                if (targetWs) {
                  targetWs.send(JSON.stringify({
                    type: "admin_action",
                    command: "mute_mic"
                  }));
                }
                broadcastToRoom(roomId, {
                  type: "room_state_sync",
                  users: room.users
                });
              }
              break;

            case "turn_off_camera":
              if (targetUserId && room.users[targetUserId]) {
                room.users[targetUserId].isCamOn = false;
                const targetWs = activeConnections[targetUserId];
                if (targetWs) {
                  targetWs.send(JSON.stringify({
                    type: "admin_action",
                    command: "disable_camera"
                  }));
                }
                broadcastToRoom(roomId, {
                  type: "room_state_sync",
                  users: room.users
                });
              }
              break;

            case "kick_user":
              if (targetUserId && room.users[targetUserId]) {
                const targetWs = activeConnections[targetUserId];
                if (targetWs) {
                  targetWs.send(JSON.stringify({
                    type: "admin_action",
                    command: "kicked"
                  }));
                }
                // Cleanup user
                delete room.users[targetUserId];
                delete userRooms[targetUserId];

                broadcastToRoom(roomId, {
                  type: "user_left",
                  userId: targetUserId
                });
                broadcastToRoom(roomId, {
                  type: "room_state_sync",
                  users: room.users
                });
              }
              break;

            case "toggle_chat_lock":
              room.isChatLocked = !room.isChatLocked;
              broadcastToRoom(roomId, {
                type: "room_setting_update",
                updates: { isChatLocked: room.isChatLocked }
              });
              break;

            case "toggle_board_lock":
              room.isBoardLocked = !room.isBoardLocked;
              broadcastToRoom(roomId, {
                type: "room_setting_update",
                updates: { isBoardLocked: room.isBoardLocked }
              });
              break;

            case "toggle_room_lock":
              room.isLocked = !room.isLocked;
              broadcastToRoom(roomId, {
                type: "room_setting_update",
                updates: { isLocked: room.isLocked }
              });
              break;

            case "promote_host":
              if (targetUserId && room.users[targetUserId]) {
                room.hostId = targetUserId;
                room.users[currentUserId].role = "participant";
                room.users[targetUserId].role = "host";
                broadcastToRoom(roomId, {
                  type: "host_changed",
                  hostId: targetUserId,
                  users: room.users
                });
              }
              break;
          }
          break;
        }

        case "signal": {
          const { targetUserId, signalData } = message;
          if (!currentUserId) return;
          const targetWs = activeConnections[targetUserId];
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: "signal",
              senderUserId: currentUserId,
              signalData
            }));
          }
          break;
        }
      }
    } catch (e) {
      console.error("WS error: ", e);
    }
  });

  ws.on("close", () => {
    if (currentUserId) {
      const roomId = userRooms[currentUserId];
      delete activeConnections[currentUserId];
      delete userRooms[currentUserId];

      if (roomId && rooms[roomId]) {
        const room = rooms[roomId];
        delete room.users[currentUserId];

        // Notify others
        broadcastToRoom(roomId, {
          type: "user_left",
          userId: currentUserId
        });

        // If no real users left, stop demo simulation and delete room after a small delay
        const realUsersCount = Object.keys(room.users).filter(uid => !uid.startsWith("demo-")).length;
        if (realUsersCount === 0) {
          stopDemoParticipants(roomId);
          delete rooms[roomId];
        } else if (room.hostId === currentUserId) {
          // Elect a new host
          const remainingUids = Object.keys(room.users);
          const firstRealUid = remainingUids.find(uid => !uid.startsWith("demo-"));
          if (firstRealUid) {
            room.hostId = firstRealUid;
            room.users[firstRealUid].role = "host";
            broadcastToRoom(roomId, {
              type: "host_changed",
              hostId: firstRealUid,
              users: room.users
            });
          }
        }
      }
    }
  });
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
