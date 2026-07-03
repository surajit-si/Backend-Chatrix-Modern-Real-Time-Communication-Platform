import "dotenv/config";
import { app } from "./app.js";
import http from "http";
import connectDB from "./src/db/index.js";
import { Server } from "socket.io";
import { getUserId } from "./src/utils/userUtils.js";

const PORT = process.env.PORT;
connectDB()
  .then(() => {
    //create server
    const server = http.createServer(app);

    //
    const io = new Server(server, {
      cors: {
        credentials: true,
        origin:
          process.env.CORS_ORIGIN === "*"
            ? true
            : process.env.CORS_ORIGIN || true,
      },
    });

    const connectedUsers = new Map();
    //add userName when client is connected using websocket
    io.on("connection", (socket) => {
      console.log("connected :", socket);
      connectedUsers.set(socket.id, socket.id);
      console.log(connectedUsers);

      socket.emit("rec", { name: "Baruwah Sala" });
    });

    server.listen(PORT, () => {
      console.log(`connected on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
    throw new Error("app crashed at app");
  });
