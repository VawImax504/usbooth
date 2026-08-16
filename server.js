/* =========================================================
   USBOOTH
   Metered WebRTC + Photo Booth
   ========================================================= */


/* =========================================================
   METERED
   ========================================================= */

const METERED_PUBLISHABLE_KEY =
  "pk_live_782e36762825a38641834f99647209f4c8716774";


const { MeteredPeer } =
  window.MeteredPeer;


/* =========================================================
   APP STATE
   ========================================================= */

let peer = null;

let room = "";

let localStream = null;
let remoteStream = null;

let remoteReady = false;

let mirror = true;

let selectedFilm = "classic";
let selectedLayout = "vertical";

let photoCount = 3;

let photos = [];

let countdownTimer = null;

let currentStrip = null;


/* =========================================================
   ELEMENTS
   ========================================================= */

const localVideo =
  document.querySelector("#local");

const remoteVideo =
  document.querySelector("#remote");

const state =
  document.querySelector("#state");

const countDisplay =
  document.querySelector("#count");

const waiting =
  document.querySelector("#waiting");

const permission =
  document.querySelector("#permission");

const result =
  document.querySelector("#result");

const combined =
  document.querySelector("#combined");


/* =========================================================
   STATUS
   ========================================================= */

function status(text, className = "") {

  state.textContent = text;
  state.className = className;

}


/* =========================================================
   ROOM CODE
   ========================================================= */

function generateRoomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {

    code += chars[
      Math.floor(
        Math.random() * chars.length
      )
    ];

  }

  return code;

}


/* =========================================================
   CAMERA
   ========================================================= */

async function startCamera() {

  try {

    localStream =
      await navigator.mediaDevices.getUserMedia({

        video: {
          facingMode: "user",

          width: {
            ideal: 1280
          },

          height: {
            ideal: 960
          }

        },

        audio: false

      });


    localVideo.srcObject =
      localStream;


    await localVideo.play()
      .catch(() => {});


    permission.textContent =
      "Camera ready ✓";

    permission.className =
      "notice ok";


    updateMirror();


    return true;

  } catch (error) {

    console.error(
      "CAMERA ERROR:",
      error
    );


    permission.textContent =
      "Camera blocked. Allow camera access and reload.";

    permission.className =
      "notice bad";


    status(
      "Camera permission needed",
      "bad"
    );


    return false;

  }

}


/* =========================================================
   CREATE METERED PEER
   ========================================================= */

async function setupMetered() {

  if (
    typeof MeteredPeer !==
    "function"
  ) {

    throw new Error(
      "Metered SDK failed to load."
    );

  }


  console.log(
    "Creating MeteredPeer..."
  );


  peer =
    new MeteredPeer({

      apiKey:
        METERED_PUBLISHABLE_KEY

    });


  /* -------------------------------------------------------
     REMOTE PEER JOINED
     ------------------------------------------------------- */

  peer.on(
    "peer-joined",
    ({ peer: remote }) => {

      console.log(
        "REMOTE PEER JOINED:",
        remote.id
      );


      /*
        Metered recommends listening
        for stream-added on the remote peer.
      */

      remote.on(
        "stream-added",
        ({ stream, metadata }) => {

          console.log(
            "REMOTE STREAM ADDED:",
            metadata
          );


          attachRemoteStream(
            stream
          );

        }
      );


      /*
        Also listen for track in case
        the SDK delivers the stream
        through the track event.
      */

      remote.on(
        "track",
        ({ streams }) => {

          if (
            streams &&
            streams.length
          ) {

            attachRemoteStream(
              streams[0]
            );

          }

        }
      );


      remote.on(
        "state-change",
        ({ to }) => {

          console.log(
            "REMOTE STATE:",
            to
          );

        }
      );

    }
  );


  /* -------------------------------------------------------
     REMOTE PEER LEFT
     ------------------------------------------------------- */

  peer.on(
    "peer-left",
    ({ peer: remote }) => {

      console.log(
        "REMOTE PEER LEFT:",
        remote?.id
      );


      remoteReady =
        false;

      remoteStream =
        null;


      remoteVideo.srcObject =
        null;


      remoteVideo.style.display =
        "none";


      waiting.style.display =
        "grid";


      status(
        "Your person left the room",
        "bad"
      );

    }
  );


  /* -------------------------------------------------------
     DATA
     ------------------------------------------------------- */

  peer.on(
    "data",
    ({ senderPeerId, data }) => {

      console.log(
        "DATA:",
        senderPeerId,
        data
      );


      if (
        data?.type ===
        "photo-shoot"
      ) {

        /*
          The other phone pressed
          the shutter.
        */

        startCountdown();

      }


      if (
        data?.type ===
        "reset-photos"
      ) {

        photos = [];

      }

    }
  );


  /* -------------------------------------------------------
     CONNECTION STATE
     ------------------------------------------------------- */

  peer.on(
    "state-change",
    ({ from, to }) => {

      console.log(
        "METERED STATE:",
        from,
        "→",
        to
      );


      if (to === "joining") {

        status(
          "Connecting…"
        );

      }


      if (to === "joined") {

        status(
          "Waiting for your person…"
        );

      }


      if (to === "reconnecting") {

        status(
          "Reconnecting…",
          "bad"
        );

      }


      if (to === "closed") {

        status(
          "Disconnected",
          "bad"
        );

      }

    }
  );


  /* -------------------------------------------------------
     ERRORS
     ------------------------------------------------------- */

  peer.on(
    "error",
    ({ err }) => {

      console.error(
        "METERED ERROR:",
        err
      );


      status(
        "Connection error",
        "bad"
      );

    }
  );


  /*
    IMPORTANT:

    Add the camera BEFORE join().
    Metered recommends this because
    the stream can be included in the
    initial WebRTC negotiation.
  */

  peer.addStream(
    localStream,
    {
      role: "camera",
      label: "front camera"
    }
  );


  console.log(
    "LOCAL STREAM ADDED"
  );

}


/* =========================================================
   ATTACH REMOTE STREAM
   ========================================================= */

function attachRemoteStream(stream) {

  if (!stream) {
    return;
  }


  console.log(
    "ATTACHING REMOTE CAMERA"
  );


  remoteStream =
    stream;


  remoteVideo.srcObject =
    stream;


  remoteVideo.style.display =
    "block";


  waiting.style.display =
    "none";


  remoteReady =
    true;


  remoteVideo.play()
    .catch(() => {});


  status(
    "Both cameras connected ✓",
    "ok"
  );

}


/* =========================================================
   CREATE ROOM
   ========================================================= */

async function createBooth() {

  try {

    room =
      generateRoomCode();


    document.querySelector(
      "#code"
    ).textContent =
      room;


    document.querySelector(
      "#roomUI"
    ).style.display =
      "block";


    document.querySelector(
      "#home"
    ).style.display =
      "none";


    document.querySelector(
      "#joinBox"
    ).style.display =
      "none";


    document.querySelector(
      "#roomUI"
    ).scrollIntoView({
      behavior: "smooth"
    });


    status(
      "Starting camera…"
    );


    const cameraOK =
      await startCamera();


    if (!cameraOK) {
      return;
    }


    await setupMetered();


    status(
      "Joining booth…"
    );


    await peer.join(
      "usbooth-" + room
    );


    status(
      "Waiting for your person…"
    );


    console.log(
      "JOINED ROOM:",
      room
    );

  } catch (error) {

    console.error(
      "CREATE ERROR:",
      error
    );


    status(
      "Unable to create booth",
      "bad"
    );


    alert(
      "Could not start booth:\n\n" +
      error.message
    );

  }

}


/* =========================================================
   JOIN ROOM
   ========================================================= */

async function joinBooth() {

  try {

    room =
      document.querySelector(
        "#roomInput"
      ).value
        .trim()
        .toUpperCase();


    if (!room) {

      alert(
        "Enter the room code."
      );

      return;

    }


    document.querySelector(
      "#code"
    ).textContent =
      room;


    document.querySelector(
      "#roomUI"
    ).style.display =
      "block";


    document.querySelector(
      "#home"
    ).style.display =
      "none";


    document.querySelector(
      "#joinBox"
    ).style.display =
      "none";


    document.querySelector(
      "#roomUI"
    ).scrollIntoView({
      behavior: "smooth"
    });


    status(
      "Starting camera…"
    );


    const cameraOK =
      await startCamera();


    if (!cameraOK) {
      return;
    }


    await setupMetered();


    status(
      "Joining booth…"
    );


    await peer.join(
      "usbooth-" + room
    );


    status(
      "Connecting to your person…"
    );


    console.log(
      "JOINED ROOM:",
      room
    );

  } catch (error) {

    console.error(
      "JOIN ERROR:",
      error
    );


    status(
      "Unable to join booth",
      "bad"
    );


    alert(
      "Could not join booth:\n\n" +
      error.message
    );

  }

}


/* =========================================================
   MIRROR
   ========================================================= */

function updateMirror() {

  if (!localVideo) {
    return;
  }


  if (mirror) {

    localVideo.classList.add(
      "mirrored"
    );

  } else {

    localVideo.classList.remove(
      "mirrored"
    );

  }

}


const mirrorButton =
  document.querySelector(
    "#mirrorBtn"
  );


if (mirrorButton) {

  mirrorButton.onclick =
    () => {

      mirror =
        !mirror;


      updateMirror();


      mirrorButton.classList.toggle(
        "active",
        mirror
      );

    };

}


/* =========================================================
   FILM STYLE
   ========================================================= */

document.querySelectorAll(
  "[data-film]"
).forEach(
  button => {

    button.onclick =
      () => {

        selectedFilm =
          button.dataset.film;


        document.querySelectorAll(
          "[data-film]"
        ).forEach(
          b =>
            b.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );

      };

  }
);


/* =========================================================
   LAYOUT
   ========================================================= */

document.querySelectorAll(
  "[data-layout]"
).forEach(
  button => {

    button.onclick =
      () => {

        selectedLayout =
          button.dataset.layout;


        document.querySelectorAll(
          "[data-layout]"
        ).forEach(
          b =>
            b.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );

      };

  }
);


/* =========================================================
   PHOTO COUNT
   ========================================================= */

document.querySelectorAll(
  "[data-count]"
).forEach(
  button => {

    button.onclick =
      () => {

        photoCount =
          Number(
            button.dataset.count
          );


        photos = [];


        document.querySelectorAll(
          "[data-count]"
        ).forEach(
          b =>
            b.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );

      };

  }
);


/* =========================================================
   CAPTURE VIDEO
   ========================================================= */

function captureVideo(
  video
) {

  const canvas =
    document.createElement(
      "canvas"
    );


  const width =
    video.videoWidth ||
    900;


  const height =
    video.videoHeight ||
    675;


  canvas.width =
    width;

  canvas.height =
    height;


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.drawImage(
    video,
    0,
    0,
    width,
    height
  );


  return canvas;

}


/* =========================================================
   CREATE ONE COMBINED PHOTO
   ========================================================= */

function createCombinedPhoto() {

  const local =
    captureVideo(
      localVideo
    );


  const remote =
    captureVideo(
      remoteVideo
    );


  const width = 1000;
  const height = 650;


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    width;

  canvas.height =
    height;


  const ctx =
    canvas.getContext(
      "2d"
    );


  /*
    Background
  */

  ctx.fillStyle =
    "#ffffff";


  ctx.fillRect(
    0,
    0,
    width,
    height
  );


  /*
    LEFT = YOU
    RIGHT = THEM
  */

  ctx.drawImage(
    local,
    0,
    0,
    width / 2,
    height
  );


  ctx.drawImage(
    remote,
    width / 2,
    0,
    width / 2,
    height
  );


  return canvas;

}


/* =========================================================
   COUNTDOWN
   ========================================================= */

function startCountdown() {

  clearInterval(
    countdownTimer
  );


  let number = 3;


  countDisplay.textContent =
    number;


  countdownTimer =
    setInterval(
      () => {

        number--;


        if (number > 0) {

          countDisplay.textContent =
            number;

          return;

        }


        clearInterval(
          countdownTimer
        );


        countDisplay.textContent =
          "📸";


        capturePhoto();


        setTimeout(
          () => {

            countDisplay.textContent =
              "";

          },
          500
        );

      },
      800
    );

}


/* =========================================================
   CAPTURE PHOTO
   ========================================================= */

function capturePhoto() {

  if (!remoteReady) {

    alert(
      "Wait until both cameras are connected."
    );

    return;

  }


  if (
    localVideo.readyState < 2 ||
    remoteVideo.readyState < 2
  ) {

    alert(
      "Both cameras are not ready yet."
    );

    return;

  }


  const photo =
    createCombinedPhoto();


  photos.push(
    photo
  );


  console.log(
    `Photo ${photos.length}/${photoCount}`
  );


  if (
    photos.length >=
    photoCount
  ) {

    buildFilm();

  }

}


/* =========================================================
   SHUTTER
   ========================================================= */

const shutter =
  document.querySelector(
    "#shoot"
  );


if (shutter) {

  shutter.onclick =
    async () => {

      if (!remoteReady) {

        alert(
          "Wait until both cameras are connected."
        );

        return;

      }


      shutter.disabled =
        true;


      try {

        /*
          Broadcast shutter command.
          Metered's send() is server-routed
          and reaches the other peer.
        */

        await peer.send({
          type: "photo-shoot"
        });


        /*
          Capture locally too.
        */

        startCountdown();

      } catch (error) {

        console.error(
          "SHUTTER ERROR:",
          error
        );


        alert(
          "Couldn't synchronize shutter."
        );

      }


      setTimeout(
        () => {

          shutter.disabled =
            false;

        },
        3000
      );

    };

}


/* =========================================================
   BUILD FILM
   ========================================================= */

function buildFilm() {

  if (!photos.length) {
    return;
  }


  const photoWidth =
    480;


  const photoHeight =
    320;


  const margin =
    30;


  const gap =
    16;


  let columns = 1;
  let rows = photos.length;


  if (
    selectedLayout ===
    "grid"
  ) {

    columns =
      Math.min(
        2,
        photos.length
      );


    rows =
      Math.ceil(
        photos.length /
        columns
      );

  }


  if (
    selectedLayout ===
    "horizontal"
  ) {

    columns =
      Math.min(
        2,
        photos.length
      );


    rows =
      Math.ceil(
        photos.length /
        columns
      );

  }


  const width =
    columns *
      photoWidth +
    (columns + 1) *
      margin;


  const height =
    rows *
      photoHeight +
    (rows + 1) *
      margin +
    100;


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    width;

  canvas.height =
    height;


  const ctx =
    canvas.getContext(
      "2d"
    );


  /* -------------------------------------------------------
     FILM BACKGROUND
     ------------------------------------------------------- */

  if (
    selectedFilm ===
    "pink"
  ) {

    ctx.fillStyle =
      "#ffd6e4";

  } else if (
    selectedFilm ===
    "dark"
  ) {

    ctx.fillStyle =
      "#151520";

  } else if (
    selectedFilm ===
    "polaroid"
  ) {

    ctx.fillStyle =
      "#f4efe6";

  } else {

    ctx.fillStyle =
      "#ffffff";

  }


  ctx.fillRect(
    0,
    0,
    width,
    height
  );


  /* -------------------------------------------------------
     PHOTOS
     ------------------------------------------------------- */

  photos.forEach(
    (photo, index) => {

      const column =
        index % columns;


      const row =
        Math.floor(
          index / columns
        );


      const x =
        margin +
        column *
        (photoWidth + margin);


      const y =
        margin +
        row *
        (photoHeight + margin);


      ctx.drawImage(
        photo,
        x,
        y,
        photoWidth,
        photoHeight
      );

    }
  );


  /* -------------------------------------------------------
     CAPTION
     ------------------------------------------------------- */

  ctx.textAlign =
    "center";


  if (
    selectedFilm ===
    "dark"
  ) {

    ctx.fillStyle =
      "#ffffff";

  } else {

    ctx.fillStyle =
      "#151520";

  }


  ctx.font =
    "900 27px system-ui";


  ctx.fillText(
    "miles apart ♡ still together",
    width / 2,
    height - 48
  );


  ctx.font =
    "13px system-ui";


  ctx.fillStyle =
    selectedFilm ===
      "dark"
      ? "#aaa"
      : "#666";


  ctx.fillText(
    new Date().toLocaleString(),
    width / 2,
    height - 22
  );


  currentStrip =
    canvas.toDataURL(
      "image/png"
    );


  combined.src =
    currentStrip;


  document.querySelector(
    "#stamp"
  ).textContent =
    new Date().toLocaleString();


  result.style.display =
    "block";


  result.scrollIntoView({
    behavior: "smooth"
  });

}


/* =========================================================
   SAVE
   ========================================================= */

const saveButton =
  document.querySelector(
    "#save"
  );


if (saveButton) {

  saveButton.onclick =
    () => {

      if (!currentStrip) {

        alert(
          "No photo to save."
        );

        return;

      }


      const link =
        document.createElement(
          "a"
        );


      link.download =
        "our-photobooth.png";


      link.href =
        currentStrip;


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();

    };

}


/* =========================================================
   AGAIN
   ========================================================= */

const againButton =
  document.querySelector(
    "#again"
  );


if (againButton) {

  againButton.onclick =
    async () => {

      photos = [];

      currentStrip =
        null;


      combined.src =
        "";


      result.style.display =
        "none";


      if (peer) {

        try {

          await peer.send({
            type:
              "reset-photos"
          });

        } catch (error) {

          console.warn(
            "RESET SYNC ERROR:",
            error
          );

        }

      }

    };

}


/* =========================================================
   CREATE BUTTON
   ========================================================= */

document.querySelector(
  "#create"
).onclick =
  createBooth;


/* =========================================================
   SHOW JOIN
   ========================================================= */

document.querySelector(
  "#showJoin"
).onclick =
  () => {

    document.querySelector(
      "#joinBox"
    ).style.display =
      "flex";

  };


/* =========================================================
   JOIN BUTTON
   ========================================================= */

document.querySelector(
  "#join"
).onclick =
  joinBooth;


/* =========================================================
   ENTER KEY
   ========================================================= */

const roomInput =
  document.querySelector(
    "#roomInput"
  );


if (roomInput) {

  roomInput.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        joinBooth();

      }

    }
  );

}


/* =========================================================
   INITIAL
   ========================================================= */

updateMirror();


console.log(
  "UsBooth JavaScript loaded."
);


console.log(
  "Metered SDK:",
  typeof MeteredPeer
);


console.log(
  "Publishable key detected:",
  METERED_PUBLISHABLE_KEY.startsWith(
    "pk_live_"
  )
);
