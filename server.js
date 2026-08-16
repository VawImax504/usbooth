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
   USBOOTH — TEMPORARY CLOUD MEMORIES
   Memories automatically expire after 10 minutes.
===================================================== */

const ephemeralMemories = new Map();

const MEMORY_TTL_MS = 10 * 60 * 1000;

// Maximum request/image size
const MAX_IMAGE_CHARS = 8 * 1024 * 1024;


/* =====================================================
   CLEAN EXPIRED MEMORIES
===================================================== */

function cleanupExpiredMemories() {

  const now = Date.now();

  for (
    const [id, memory]
    of ephemeralMemories
  ) {

    if (
      memory.expiresAt <= now
    ) {

      ephemeralMemories.delete(id);

      console.log(
        `♡ Memory expired: ${id}`
      );

    }

  }

}


/*
   Check every minute.
*/

setInterval(
  cleanupExpiredMemories,
  60 * 1000
).unref();


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  express.json({
    limit: "10mb"
  })
);


/*
   Serve index.html, booth.html,
   CSS, JS, images, etc.
*/

app.use(
  express.static(
    __dirname
  )
);


/* =====================================================
   CREATE TEMPORARY MEMORY
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
       Validate image.
    */

    if (
      typeof image !== "string"
    ) {

      return res
        .status(400)
        .json({
          error:
            "No image received."
        });

    }


    /*
       Only allow image data URLs.
    */

    if (
      !/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(
        image
      )
    ) {

      return res
        .status(400)
        .json({
          error:
            "Invalid image format."
        });

    }


    /*
       Prevent oversized uploads.
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
       Generate secure random ID.
    */

    const id =
      crypto
        .randomBytes(18)
        .toString("hex");


    /*
       Expiration time:
       exactly 10 minutes
       from creation.
    */

    const expiresAt =
      Date.now() +
      MEMORY_TTL_MS;


    /*
       Store temporarily
       in server memory.
    */

    ephemeralMemories.set(
      id,
      {
        image,
        title,
        expiresAt
      }
    );


    console.log(
      `♡ Temporary memory created: ${id}`
    );


    /*
       Return shareable URL.
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
   VIEW TEMPORARY MEMORY
===================================================== */

app.get(
  "/memory/:id",
  (req, res) => {

    cleanupExpiredMemories();


    const memory =
      ephemeralMemories.get(
        req.params.id
      );


    /*
       Memory doesn't exist
       or has expired.
    */

    if (!memory) {

      return res
        .status(404)
        .send(`

<!DOCTYPE html>

<html>

<head>

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>
UsBooth Memory Expired ♡
</title>

<style>

* {
  box-sizing: border-box;
}

body {

  margin: 0;

  min-height: 100vh;

  display: flex;

  align-items: center;

  justify-content: center;

  padding: 25px;

  text-align: center;

  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  color: white;

  background:

    radial-gradient(
      circle at 15% 5%,
      rgba(255,91,143,.25),
      transparent 30%
    ),

    radial-gradient(
      circle at 85% 80%,
      rgba(145,90,255,.20),
      transparent 30%
    ),

    #09070d;

}

.card {

  width: 100%;

  max-width: 500px;

  padding: 50px 30px;

  border:
    1px solid
    rgba(255,255,255,.10);

  border-radius: 28px;

  background:
    rgba(20,15,22,.90);

  box-shadow:
    0 30px 100px
    rgba(0,0,0,.55);

}

.heart {

  font-size: 60px;

  margin-bottom: 15px;

}

h1 {

  margin:
    0 0 12px;

  font-size: 28px;

}

p {

  margin: 0;

  color: #aaa6b2;

  font-size: 14px;

  line-height: 1.7;

}

a {

  display: inline-block;

  margin-top: 25px;

  padding:
    12px 18px;

  border-radius: 999px;

  background: #ff719f;

  color: #210812;

  text-decoration: none;

  font-size: 11px;

  font-weight: 900;

}

</style>

</head>

<body>

<div class="card">

<div class="heart">
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

<a href="/">
Create another memory
</a>

</div>

</body>

</html>

`);

    }


    /*
       Extract MIME type + base64.
    */

    const match =
      memory.image.match(
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


    /*
       Convert base64
       into actual image bytes.
    */

    const buffer =
      Buffer.from(
        match[2],
        "base64"
      );


    /*
       Prevent browser caching.
    */

    res.setHeader(
      "Content-Type",
      contentType
    );

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "Expires",
      "0"
    );

    res.setHeader(
      "X-UsBooth-Expires-At",
      String(
        memory.expiresAt
      )
    );


    res.send(
      buffer
    );

  }
);


/* =====================================================
   MEMORY INFORMATION API
===================================================== */

app.get(
  "/api/memory/:id",
  (req, res) => {

    cleanupExpiredMemories();


    const memory =
      ephemeralMemories.get(
        req.params.id
      );


    if (!memory) {

      return res
        .status(404)
        .json({

          ok: false,

          error:
            "Memory expired or not found."

        });

    }


    res.json({

      ok: true,

      title:
        memory.title,

      expiresAt:
        memory.expiresAt,

      remainingSeconds:
        Math.max(
          0,
          Math.floor(
            (
              memory.expiresAt -
              Date.now()
            ) / 1000
          )
        ),

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
        "4.1.0",

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
      `☁ Temporary memories expire after 10 minutes.`
    );

  }
);
