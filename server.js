import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const app =
  express();

const server =
  http.createServer(app);


/* =====================================================
   STATIC FILES
===================================================== */

app.use(
  express.static(
    __dirname
  )
);


/* =====================================================
   MAIN PAGE
===================================================== */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
  "/health",
  (req, res) => {

    res.json({

      ok:true,

      service:"usbooth",

      version:"2.0.0",

      timestamp:
        new Date().toISOString()

    });

  }
);


/* =====================================================
   START
===================================================== */

const PORT =
  process.env.PORT ||
  3000;

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================"
    );

    console.log(
      "♡ UsBooth server started"
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      "================================"
    );

  }
);
