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

/*
  ============================================================
  METERED TURN
  ============================================================
*/

let turnCache = null;
let turnCacheExpires = 0;

async function getTurnServers() {
  // Return cached credentials if they are still valid
  if (turnCache && Date.now() < turnCacheExpires) {
    return turnCache;
  }

  const appName = process.env.METERED_APP_NAME;
  const secretKey = process.env.METERED_SECRET_KEY;

  if (!appName || !secretKey) {
    throw new Error(
      "Missing METERED_APP_NAME or METERED_SECRET_KEY environment variable."
    );
  }

  /*
    Create a temporary TURN credential.

    The secret key stays on the Render server.
    It is NEVER sent to the browser.
  */

  const createResponse = await fetch(
    `https://${appName}.metered.live/api/v1/turn/credential?secretKey=${encodeURIComponent(
      secretKey
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expiryInSeconds: 86400,
        label: "usbooth",
      }),
    }
  );

  if (!createResponse.ok) {
    const text = await createResponse.text();

    throw new Error(
      `Metered TURN credential creation failed: ${createResponse.status} ${text}`
    );
  }

  const credential = await createResponse.json();

  /*
    Metered gives us an API key for this TURN credential.
    We use that API key to retrieve the ICE server array.
  */

  const iceResponse = await fetch(
    `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(
      credential.apiKey
    )}`
  );

  if (!iceResponse.ok) {
    const text = await iceResponse.text();

    throw new Error(
      `Metered ICE server request failed: ${iceResponse.status} ${text}`
    );
  }

  const iceServers = await iceResponse.json();

  // Cache for 23 hours
  turnCache = iceServers;
  turnCacheExpires = Date.now() + 23 * 60 * 60 * 1000;

  console.log("Metered TURN servers loaded successfully.");

  return iceServers;
}


/*
  ============================================================
  BASIC ROUTES
  ============================================================
*/

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "usbooth",
  });
});


/*
  ============================================================
  TURN ROUTE
  ============================================================

  The browser calls:

      /turn-servers

  It receives ONLY the ICE server configuration.

  The Metered secret key never leaves Render.
*/

app.get("/turn-servers", async (req, res) => {
  try {
    const iceServers = await getTurnServers();

    res.json({
      ok: true,
      iceServers,
    });
  } catch (error) {
    console.error("TURN ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to load TURN servers",
    });
  }
});


/*
  ============================================================
  SOCKET.IO
  ============================================================
*/

io.on("connection", (socket) => {

  /*
    CREATE ROOM
  */

  socket.on("create-room", (cb) => {
    let room;

    do {
      room = randomBytes(3)
        .toString("hex")
        .toUpperCase();
    } while (rooms.has(room));

    rooms.set(room, new Set([socket.id]));

    socket.join(room);
    socket.data.room = room;

    cb?.({
      ok: true,
      room,
    });
  });


  /*
    JOIN ROOM
  */

  socket.on("join-room", (room, cb) => {
    room = String(room || "")
      .trim()
      .toUpperCase();

    const members = rooms.get(room);

    if (!members) {
      cb?.({
        ok: false,
        error: "Room not found",
      });

      return;
    }

    if (members.size >= 2) {
      cb?.({
        ok: false,
        error: "Room is full",
      });

      return;
    }

    members.add(socket.id);

    socket.join(room);
    socket.data.room = room;

    socket.to(room).emit("peer-joined");

    cb?.({
      ok: true,
      room,
    });
  });


  /*
    WEBRTC OFFER
  */

  socket.on("offer", ({ room, offer }) => {
    socket.to(room).emit("offer", offer);
  });


  /*
    WEBRTC ANSWER
  */

  socket.on("answer", ({ room, answer }) => {
    socket.to(room).emit("answer", answer);
  });


  /*
    WEBRTC ICE CANDIDATE
  */

  socket.on("ice-candidate", ({ room, candidate }) => {
    socket.to(room).emit("ice-candidate", candidate);
  });


  /*
    READY TO SHOOT
  */

  socket.on("ready-to-shoot", (room) => {
    socket.to(room).emit("partner-ready-to-shoot");
  });


  /*
    SYNCHRONIZED SHUTTER
  */

  socket.on("shoot-now", (room) => {
    socket.to(room).emit("shoot-now");
  });


  /*
    DISCONNECT
  */

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


/*
  ============================================================
  START SERVER
  ============================================================
*/

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`UsBooth running on port ${port}`);
});
