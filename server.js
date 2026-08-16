import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

const app = express();

const server = http.createServer(app);

const io = new Server(server);


/* =========================================================
   ROOMS
   ========================================================= */

const rooms = new Map();


/* =========================================================
   SERVE WEBSITE
   ========================================================= */

app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "index.html")
  );

});


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/health", (req, res) => {

  res.json({
    ok: true
  });

});


/* =========================================================
   SOCKET.IO
   ========================================================= */

io.on("connection", (socket) => {


  /* -------------------------------------------------------
     CREATE ROOM
     ------------------------------------------------------- */

  socket.on(
    "create-room",
    (callback) => {

      let room;

      do {

        room =
          randomBytes(3)
            .toString("hex")
            .toUpperCase();

      } while (
        rooms.has(room)
      );


      rooms.set(
        room,
        new Set([
          socket.id
        ])
      );


      socket.join(room);

      socket.data.room =
        room;


      callback?.({
        ok: true,
        room
      });

    }
  );


  /* -------------------------------------------------------
     JOIN ROOM
     ------------------------------------------------------- */

  socket.on(
    "join-room",
    (room, callback) => {

      room =
        String(room || "")
          .trim()
          .toUpperCase();


      const members =
        rooms.get(room);


      if (!members) {

        callback?.({
          ok: false,
          error: "Room not found"
        });

        return;

      }


      if (
        members.size >= 2
      ) {

        callback?.({
          ok: false,
          error: "Room is full"
        });

        return;

      }


      members.add(
        socket.id
      );


      socket.join(room);

      socket.data.room =
        room;


      socket.to(room)
        .emit(
          "peer-joined"
        );


      callback?.({
        ok: true,
        room
      });

    }
  );


  /* -------------------------------------------------------
     OLD WEBRTC SIGNALING
     
     These are kept so the server remains compatible
     with the older version of your app.
     The new Metered frontend doesn't depend on them.
     ------------------------------------------------------- */

  socket.on(
    "offer",
    ({ room, offer }) => {

      socket.to(room)
        .emit(
          "offer",
          offer
        );

    }
  );


  socket.on(
    "answer",
    ({ room, answer }) => {

      socket.to(room)
        .emit(
          "answer",
          answer
        );

    }
  );


  socket.on(
    "ice-candidate",
    ({ room, candidate }) => {

      socket.to(room)
        .emit(
          "ice-candidate",
          candidate
        );

    }
  );


  /* -------------------------------------------------------
     OLD READY EVENT
     ------------------------------------------------------- */

  socket.on(
    "ready-to-shoot",
    (room) => {

      socket.to(room)
        .emit(
          "partner-ready-to-shoot"
        );

    }
  );


  /* -------------------------------------------------------
     OLD SHOOT EVENT
     ------------------------------------------------------- */

  socket.on(
    "shoot-now",
    (room) => {

      socket.to(room)
        .emit(
          "shoot-now"
        );

    }
  );


  /* -------------------------------------------------------
     DISCONNECT
     ------------------------------------------------------- */

  socket.on(
    "disconnect",
    () => {

      const room =
        socket.data.room;


      if (!room) {
        return;
      }


      const members =
        rooms.get(room);


      if (!members) {
        return;
      }


      members.delete(
        socket.id
      );


      if (
        members.size === 0
      ) {

        rooms.delete(
          room
        );

      } else {

        socket.to(room)
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
