import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";


/* =========================================================
   PATH
   ========================================================= */

const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );


/* =========================================================
   EXPRESS
   ========================================================= */

const app =
  express();

const server =
  http.createServer(
    app
  );


/* =========================================================
   SERVE INDEX.HTML
   ========================================================= */

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


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
  "/health",
  (req, res) => {

    res.json({
      ok:true,
      service:"usbooth"
    });

  }
);


/* =========================================================
   START
   ========================================================= */

const port =
  process.env.PORT ||
  3000;


server.listen(
  port,
  "0.0.0.0",
  () => {

    console.log(
      `UsBooth running on port ${port}`
    );

  }
);
