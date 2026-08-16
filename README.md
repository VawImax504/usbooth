# UsBooth — Two Phone Edition

A real two-phone photobooth using WebRTC for camera-to-camera video and Socket.IO for room/signaling.

## Run locally
1. Install Node.js 18+.
2. Run `npm install`.
3. Run `npm start`.
4. Open the site over HTTPS when testing camera access on phones. `localhost` is okay for local desktop development.
5. For two phones on the same network, use an HTTPS tunnel such as Cloudflare Tunnel or deploy the app to an HTTPS host.

## Production
Deploy this Node app to a host that supports WebSockets. Set the `PORT` environment variable if required.

## Notes
- Camera permissions require HTTPS (or localhost).
- WebRTC may need a TURN server on restrictive mobile networks. The demo uses public STUN servers and will work on many networks, but a production app should add TURN.
- No photos are uploaded by this app; each phone captures locally and the remote preview is sent peer-to-peer.
