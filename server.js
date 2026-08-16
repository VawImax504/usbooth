import express from "express";
import http from "http";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);


/* =====================================================
   USBOOTH — TEMPORARY MEMORY STORAGE
   Photos are automatically deleted after 10 minutes.
   
   IMPORTANT:
   - Photos are stored only in server memory.
   - A server restart clears all temporary memories.
   - Nothing is permanently stored.
===================================================== */

const ephemeralMemories = new Map();

const MEMORY_TTL_MS =
  10 * 60 * 1000; // 10 minutes

const MAX_IMAGE_CHARS =
  8 * 1024 * 1024; // ~8 MB


/* =====================================================
   CLEAN EXPIRED MEMORIES
===================================================== */

function cleanupExpiredMemories() {

  const now =
    Date.now();

  for (
    const [id, item]
    of ephemeralMemories
  ) {

    if (
      item.expiresAt <=
      now
    ) {

      ephemeralMemories.delete(
        id
      );

      console.log(
        `Temporary memory expired: ${id}`
      );

    }

  }

}


/*
   Check for expired memories
   every minute.
*/

setInterval(
  cleanupExpiredMemories,
  60 * 1000
).unref();


/* =====================================================
   MIDDLEWARE
===================================================== */

/*
   JSON is required for the temporary
   memory upload endpoint.
*/

app.use(
  express.json({
    limit: "10mb"
  })
);


/*
   Serve everything inside the
   UsBooth project directory.
*/

app.use(
  express.static(
    __dirname
  )
);


/* =====================================================
   TEMPORARY MEMORY — CREATE
===================================================== */

app.post(
  "/api/memory",
  (req, res) => {

    cleanupExpiredMemories();


    const image =
      req.body?.image;


    const title =
      String(
        req.body?.title ||
        "UsBooth Memory"
      ).slice(
        0,
        80
      );


    /*
       Only accept image data URLs.
    */

    if (
      typeof image !==
        "string" ||

      !/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(
        image
      )
    ) {

      return res
        .status(400)
        .json({
          error:
            "Invalid image."
        });

    }


    /*
       Prevent extremely large uploads.
    */

    if (
      image.length >
      MAX_IMAGE_CHARS
    ) {

      return res
        .status(413)
        .json({
          error:
            "Image is too large."
        });

    }


    /*
       Generate a random,
       hard-to-guess memory ID.
    */

    const id =
      crypto.randomBytes(
        18
      ).toString(
        "hex"
      );


    /*
       Memory automatically
       expires after 10 minutes.
    */

    const expiresAt =
      Date.now() +
      MEMORY_TTL_MS;


    ephemeralMemories.set(
      id,
      {
        image,
        title,
        expiresAt
      }
    );


    console.log(
      `Temporary memory created: ${id}`
    );


    /*
       Return the temporary
       shareable URL.
    */

    res.json({

      ok: true,

      id,

      url:
        `/memory/${id}`,

      expiresAt

    });

  }
);


/* =====================================================
   TEMPORARY MEMORY — VIEW
===================================================== */

app.get(
  "/memory/:id",
  (req, res) => {

    cleanupExpiredMemories();


    const item =
      ephemeralMemories.get(
        req.params.id
      );


    /*
       Memory doesn't exist
       or has expired.
    */

    if (!item) {

      return res
        .status(404)
        .send(`

<!doctype html>

<html>

<head>

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>
UsBooth Memory Expired
</title>

<style>

*{
  box-sizing:border-box;
}

body{

  margin:0;

  min-height:100vh;

  display:flex;

  align-items:center;

  justify-content:center;

  text-align:center;

  padding:30px;

  color:white;

  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  background:

    radial-gradient(
      circle at 20% 10%,
      rgba(255,91,143,.22),
      transparent 30%
    ),

    radial-gradient(
      circle at 80% 80%,
      rgba(142,93,255,.18),
      transparent 30%
    ),

    #0b080d;

}

.card{

  max-width:500px;

  padding:45px 30px;

  border:

    1px solid
    rgba(255,255,255,.1);

  border-radius:28px;

  background:
    rgba(20,15,22,.85);

  box-shadow:
    0 30px 100px
    rgba(0,0,0,.5);

}

.icon{

  font-size:55px;

  margin-bottom:15px;

}

h1{

  margin:0 0 12px;

  font-size:28px;

}

p{

  margin:0;

  color:#aaa6b2;

  line-height:1.7;

  font-size:14px;

}

</style>

</head>

<body>

<div class="card">

<div class="icon">
♡
</div>

<h1>
This memory has expired.
</h1>

<p>
UsBooth temporary memories are
automatically deleted after
10 minutes.
</p>

</div>

</body>

</html>

`);

    }


    /*
       Extract image MIME type
       and base64 data.
    */

    const match =
      item.image.match(
        /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i
      );


    if (!match) {

      return res
        .status(500)
        .send(
          "Invalid stored image."
        );

    }


    let contentType =
      match[1].toLowerCase();


    /*
       Normalize image/jpg.
    */

    if (
      contentType ===
      "image/jpg"
    ) {

      contentType =
        "image/jpeg";

    }


    const buffer =
      Buffer.from(
        match[2],
        "base64"
      );


    /*
       Don't let browsers/cache
       keep the temporary image.
    */

    res.setHeader(
      "Content-Type",
      contentType
    );

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "X-UsBooth-Expires-At",
      String(
        item.expiresAt
      )
    );


    res.send(
      buffer
    );

  }
);


/* =====================================================
   TEMPORARY MEMORY — INFORMATION
===================================================== */

app.get(
  "/api/memory/:id",
  (req, res) => {

    cleanupExpiredMemories();


    const item =
      ephemeralMemories.get(
        req.params.id
      );


    if (!item) {

      return res
        .status(404)
        .json({
          error:
            "Memory expired or not found."
        });

    }


    res.json({

      ok: true,

      title:
        item.title,

      expiresAt:
        item.expiresAt,

      url:
        `/memory/${req.params.id}`

    });

  }
);


/* =====================================================
   HOME PAGE
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

      ok: true,

      service:
        "usbooth",

      version:
        "4.0.0",

      temporaryMemory:
        true,

      memoryLifetime:
        "10 minutes"

    });

  }
);


/* =====================================================
   START SERVER
===================================================== */

const PORT =
  process.env.PORT ||
  3000;


server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `♡ UsBooth running on port ${PORT}`
    );

    console.log(
      `Temporary memories expire after 10 minutes.`
    );

  }
);
