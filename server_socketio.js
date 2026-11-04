const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Sala simples para testar a conexão. O jogo ainda precisará integrar
// seus comandos e estado de batalha a estes eventos.
const rooms = new Map();

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function publicRoom(room) {
  return {
    code: room.code,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, isHost: p.id === room.hostId
    }))
  };
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/version", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "version.json"));
});

// O painel só anuncia a atualização aos jogadores conectados.
// A atualização real do código é publicada pelo GitHub -> Render.
app.post("/api/admin/announce", (req, res) => {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: "Configure ADMIN_TOKEN no Render." });
  }
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: "Token inválido." });
  }

  const version = String(req.body.version || "").trim().slice(0, 30);
  const notes = String(req.body.notes || "").trim().slice(0, 1500);
  if (!version || !notes) {
    return res.status(400).json({ error: "Informe versão e novidades." });
  }

  io.emit("update_available", { version, notes });
  res.json({ ok: true, sent: true });
});

io.on("connection", socket => {
  socket.on("create_room", ({ name, code: requestedCode } = {}, callback = () => {}) => {
    const playerName = String(name || "Jogador").trim().slice(0, 18);
    let code = String(requestedCode || "").toUpperCase().trim();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      do { code = makeCode(); } while (rooms.has(code));
    }
    if (rooms.has(code)) return callback({ ok: false, error: "Esse código já está em uso. Crie outra sala." });

    const room = {
      code,
      hostId: socket.id,
      players: new Map()
    };
    room.players.set(socket.id, { id: socket.id, name: playerName });
    rooms.set(code, room);
    socket.join(code);
    callback({ ok: true, room: publicRoom(room) });
    io.to(code).emit("room_changed", publicRoom(room));
  });

  socket.on("join_room", ({ code, name } = {}, callback = () => {}) => {
    const roomCode = String(code || "").toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return callback({ ok: false, error: "Sala não encontrada." });
    if (room.players.size >= 3) return callback({ ok: false, error: "Sala cheia (máximo 3)." });

    const playerName = String(name || "Jogador").trim().slice(0, 18);
    room.players.set(socket.id, { id: socket.id, name: playerName });
    socket.join(roomCode);
    callback({ ok: true, room: publicRoom(room) });
    io.to(roomCode).emit("room_changed", publicRoom(room));
  });

  socket.on("leave_room", () => leaveRoom(socket));

  // Retransmite os eventos do Hollow Fight somente para jogadores da mesma sala.
  socket.on("game_relay", message => {
    const room = findRoomFor(socket.id);
    if (!room || !message || typeof message.event !== "string") return;
    const allowed = new Set(["lob", "cmd", "inp", "st"]);
    if (!allowed.has(message.event)) return;
    socket.to(room.code).emit("game_relay", {
      event: message.event,
      data: message.data,
      peer: socket.id
    });
  });

  // Eventos de jogo para integrar depois:
  // client -> game_input; servidor valida e distribui game_state.
  socket.on("game_input", payload => {
    const room = findRoomFor(socket.id);
    if (!room) return;
    if (socket.id !== room.hostId) {
      // Por enquanto, apenas encaminha ao anfitrião. A lógica authoritative
      // (validar ataques, dano, vida etc.) será implementada na integração.
      io.to(room.hostId).emit("player_input", {
        playerId: socket.id,
        payload
      });
    }
  });

  socket.on("game_state", payload => {
    const room = findRoomFor(socket.id);
    if (!room || socket.id !== room.hostId) return;
    socket.to(room.code).emit("game_state", payload);
  });

  socket.on("disconnect", () => leaveRoom(socket));
});

function findRoomFor(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
}

function leaveRoom(socket) {
  const room = findRoomFor(socket.id);
  if (!room) return;

  room.players.delete(socket.id);
  socket.leave(room.code);

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === socket.id) {
    // Migração simples de anfitrião. Ainda não transfere estado da batalha.
    room.hostId = room.players.keys().next().value;
    io.to(room.hostId).emit("became_host");
  }

  io.to(room.code).emit("room_changed", publicRoom(room));
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Hollow Fight server listening on ${PORT}`);
});
