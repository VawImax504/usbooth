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

/* =========================================================
   BASIC ROUTES
   ========================================================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "UsBooth"
  });
});


/* =========================================================
   TURN CREDENTIALS
   =========================================================

   IMPORTANT:
   Put these in your hosting provider's Environment
   Variables / Secrets.

   DO NOT put them in index.html.
   DO NOT commit them to GitHub.

   TURN_KEY_ID
   TURN_API_TOKEN
*/

app.get("/turn-credentials", async (req, res) => {

  try {

    const keyId = process.env.TURN_KEY_ID;
    const apiToken = process.env.TURN_API_TOKEN;

    if (!keyId || !apiToken) {

      console.error(
        "TURN_KEY_ID or TURN_API_TOKEN is missing."
      );

      return res.status(500).json({
        error: "TURN server is not configured."
      });

    }


    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          ttl: 3600
        })
      }
    );


    if (!response.ok) {

      const text = await response.text();

      console.error(
        "Cloudflare TURN error:",
        response.status,
        text
      );

      return res.status(500).json({
        error: "Could not obtain TURN credentials."
      });

    }


    const data = await response.json();


    /*
      Cloudflare returns:

      {
        iceServers: [...]
      }

      We send that directly to the browser.
    */

    res.json(data);

  } catch (error) {

    console.error(
      "TURN credential generation failed:",
      error
    );

    res.status(500).json({
      error: "TURN credential generation failed."
    });

  }

});


/* =========================================================
   SOCKET.IO
   ========================================================= */

io.on("connection", (socket) => {

  console.log(
    "Socket connected:",
    socket.id
  );


  /* =======================================================
     CREATE ROOM
     ======================================================= */

  socket.on("create-room", (cb) => {

    let room;

    do {

      room =
        randomBytes(3)
          .toString("hex")
          .toUpperCase();

    } while (rooms.has(room));


    rooms.set(
      room,
      new Set([socket.id])
    );


    socket.join(room);

    socket.data.room = room;


    console.log(
      `Room created: ${room}`
    );


    cb?.({
      ok: true,
      room
    });

  });


  /* =======================================================
     JOIN ROOM
     ======================================================= */

  socket.on("join-room", (room, cb) => {

    room =
      String(room || "")
        .trim()
        .toUpperCase();


    const members =
      rooms.get(room);


    if (!members) {

      cb?.({
        ok: false,
        error: "Room not found"
      });

      return;

    }


    if (members.size >= 2) {

      cb?.({
        ok: false,
        error: "Room is full"
      });

      return;

    }


    members.add(socket.id);

    socket.join(room);

    socket.data.room = room;


    /*
      Tell the first phone that
      the second phone has arrived.
    */

    socket.to(room).emit(
      "peer-joined"
    );


    console.log(
      `Socket ${socket.id} joined room ${room}`
    );


    cb?.({
      ok: true,
      room
    });

  });


  /* =======================================================
     WEBRTC OFFER
     ======================================================= */

  socket.on(
    "offer",
    ({ room, offer }) => {

      if (!room || !offer) return;

      socket
        .to(room)
        .emit(
          "offer",
          offer
        );

    }
  );


  /* =======================================================
     WEBRTC ANSWER
     ======================================================= */

  socket.on(
    "answer",
    ({ room, answer }) => {

      if (!room || !answer) return;

      socket
        .to(room)
        .emit(
          "answer",
          answer
        );

    }
  );


  /* =======================================================
     ICE CANDIDATES
     ======================================================= */

  socket.on(
    "ice-candidate",
    ({ room, candidate }) => {

      if (!room || !candidate) return;

      socket
        .to(room)
        .emit(
          "ice-candidate",
          candidate
        );

    }
  );


  /* =======================================================
     READY TO SHOOT
     ======================================================= */

  socket.on(
    "ready-to-shoot",
    (room) => {

      if (!room) return;

      socket
        .to(room)
        .emit(
          "partner-ready-to-shoot"
        );

    }
  );


  /* =======================================================
     SYNCHRONIZED SHUTTER
     ======================================================= */

  socket.on(
    "shoot-now",
    (room) => {

      if (!room) return;

      socket
        .to(room)
        .emit(
          "shoot-now"
        );

    }
  );


  /* =======================================================
     DISCONNECT
     ======================================================= */

  socket.on(
    "disconnect",
    () => {

      console.log(
        "Socket disconnected:",
        socket.id
      );


      const room =
        socket.data.room;


      if (!room) return;


      const members =
        rooms.get(room);


      if (!members) return;


      members.delete(
        socket.id
      );


      if (members.size === 0) {

        rooms.delete(room);

        console.log(
          `Room deleted: ${room}`
        );

      } else {

        socket
          .to(room)
          .emit(
            "peer-left"
          );

      }

    }
  );

});


/* =========================================================
   START SERVER
   ========================================================= */

const port =
  process.env.PORT || 3000;


server.listen(
  port,
  () => {

    console.log(
      `UsBooth running on port ${port}`
    );

  }
);
