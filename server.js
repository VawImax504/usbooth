import express from "express";
import http from "http";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";


const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);


const app = express();

const server =
  http.createServer(app);


/* =====================================================
   EPHEMERAL MEMORY STORAGE
   AUTO DELETE AFTER 10 MINUTES

   Photos live only in server memory.

   A server restart also clears them.

   This is NOT permanent cloud storage.
===================================================== */

const ephemeralMemories =
  new Map();


const MEMORY_TTL_MS =
  10 * 60 * 1000;


const MAX_IMAGE_CHARS =
  8 * 1024 * 1024;


/* =====================================================
   CLEANUP
===================================================== */

function cleanupExpiredMemories(){

  const now =
    Date.now();


  for(
    const [id,item]
    of ephemeralMemories
  ){

    if(
      item.expiresAt <= now
    ){

      ephemeralMemories.delete(id);

    }

  }

}


setInterval(
  cleanupExpiredMemories,
  60 * 1000
).unref();


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  express.json({
    limit:"10mb"
  })
);


app.use(
  express.static(__dirname)
);


/* =====================================================
   CREATE TEMPORARY MEMORY
===================================================== */

app.post(
  "/api/memory",
  (req,res) => {


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


    if(

      typeof image !==
      "string" ||

      !/^data:image\/(?:png|jpeg|jpg|webp);base64,/i
        .test(image)

    ){

      return res
        .status(400)
        .json({
          error:
            "Invalid image."
        });

    }


    if(
      image.length >
      MAX_IMAGE_CHARS
    ){

      return res
        .status(413)
        .json({
          error:
            "Image is too large."
        });

    }


    const id =
      crypto
        .randomBytes(18)
        .toString("hex");


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


    res.json({

      ok:true,

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
  (req,res) => {


    cleanupExpiredMemories();


    const item =
      ephemeralMemories.get(
        req.params.id
      );


    if(!item){

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

</head>


<body style="
margin:0;
background:#0b080d;
color:#fff;
font-family:system-ui;
text-align:center;
padding:15vh 20px;
">

<div style="
font-size:48px
">

♡

</div>


<h1>

This memory has expired.

</h1>


<p style="
color:#aaa
">

Temporary UsBooth memories
are automatically deleted
after 10 minutes.

</p>

</body>

</html>

`);

    }


    const match =
      item.image.match(

        /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i

      );


    if(!match){

      return res
        .status(500)
        .send(
          "Invalid stored image."
        );

    }


    const contentType =
      match[1]
        .toLowerCase() ===
      "image/jpg"

        ? "image/jpeg"

        : match[1].toLowerCase();


    const buffer =
      Buffer.from(
        match[2],
        "base64"
      );


    res.setHeader(
      "Content-Type",
      contentType
    );


    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    );


    res.setHeader(
      "X-UsBooth-Expires-At",
      String(
        item.expiresAt
      )
    );


    res.send(buffer);

  }

);


/* =====================================================
   MEMORY INFORMATION API
===================================================== */

app.get(
  "/api/memory/:id",
  (req,res) => {


    cleanupExpiredMemories();


    const item =
      ephemeralMemories.get(
        req.params.id
      );


    if(!item){

      return res
        .status(404)
        .json({
          error:
            "Memory expired or not found."
        });

    }


    res.json({

      ok:true,

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
   HOME
===================================================== */

app.get(
  "/",
  (req,res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }

);


/* =====================================================
   HEALTH
===================================================== */

app.get(
  "/health",
  (req,res) => {

    res.json({

      ok:true,

      service:
        "usbooth",

      version:
        "4.0.0"

    });

  }

);


/* =====================================================
   SERVER
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

  }

);
