import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  socket.on("create-room", (cb) => {
    let room;

    do {
      room = randomBytes(3).toString("hex").toUpperCase();
    } while (rooms.has(room));

    rooms.set(room, new Set([socket.id]));
    socket.join(room);
    socket.data.room = room;

    cb?.({ ok: true, room });
  });

  socket.on("join-room", (room, cb) => {
    room = String(room || "").trim().toUpperCase();

    const members = rooms.get(room);

    if (!members) {
      cb?.({ ok: false, error: "Room not found" });
      return;
    }

    if (members.size >= 2) {
      cb?.({ ok: false, error: "Room is full" });
      return;
    }

    members.add(socket.id);
    socket.join(room);
    socket.data.room = room;

    socket.to(room).emit("peer-joined");

    cb?.({ ok: true, room });
  });

  socket.on("offer", ({ room, offer }) => {
    socket.to(room).emit("offer", offer);
  });

  socket.on("answer", ({ room, answer }) => {
    socket.to(room).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ room, candidate }) => {
    socket.to(room).emit("ice-candidate", candidate);
  });

  socket.on("ready-to-shoot", (room) => {
    socket.to(room).emit("partner-ready-to-shoot");
  });

  socket.on("shoot-now", (room) => {
    socket.to(room).emit("shoot-now");
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;

    if (!room) return;

    const members = rooms.get(room);

    if (!members) return;

    members.delete(socket.id);

    if (members.size === 0) {
      rooms.delete(room);
    } else {
      socket.to(room).emit("peer-left");
    }
  });
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`UsBooth running on port ${port}`);
});
