import "dotenv/config";
import { app } from "./app.js";
import http from "http";
import connectDB from "./src/db/index.js";
import { Server } from "socket.io";
import cookie from "cookie";
import { getUserId } from "./src/utils/userUtils.js";
import { User } from "./src/models/user.model.js";
import jwt from "jsonwebtoken";
import { Conversation } from "./src/models/conversation.model.js";
import { Message } from "./src/models/message.model.js";

const PORT = process.env.PORT;
connectDB()
  .then(() => {
    //create server
    const server = http.createServer(app);

    //
    const allowedOrigins =
      process.env.CORS_ORIGIN === "*"
        ? true
        : (process.env.CORS_ORIGIN || "http://localhost:5173")
            .split(",")
            .map((o) => o.trim());

    const io = new Server(server, {
      cors: {
        credentials: true,
        origin: allowedOrigins,
      },
    });

    const connectedUsers = new Map();
    //middlewares
    io.use(async (socket, next) => {
      const cookieString = socket.handshake.headers.cookie;
      const cookies = cookie.parse(cookieString || "");

      //get user details
      try {
        const verifiedUser = jwt.verify(
          cookies.accessToken,
          process.env.ACCESS_TOKEN_SECRET,
        );

        //find user
        const user = await User.findById(verifiedUser._id);

        socket.user = user;

        next();
      } catch (error) {
        //if token not exest or expired
        next(new Error("Unauthorized"));
      }
    });
    //add userName when client is connected using websocket
    io.on("connection", async (socket) => {
      connectedUsers.set(socket.user._id.toString(), socket.id);
      console.log(connectedUsers);

      //send msg
      socket.on("send-message", async (data) => {
        try {
          const conversation = await Conversation.findById(
            data?.currConversation._id,
          );
          //check if conversation found or not
          if (!conversation) {
            return socket.emit("message-error", {
              type: "not-found",
              message: "Conversation not found",
            });
          }

          //check if user is participant of the conversation or not
          const isParticipant = conversation?.participants.some((id) =>
            id.equals(socket.user._id),
          );

          if (!isParticipant) {
            return socket.emit("message-error", {
              type: "parmission-error",
              message:
                "You don't have permission to message in the conversation.",
            });
          }
          //create or save message
          const message = await Message.create({
            conversationId: conversation,
            sender: socket.user._id,
            content: data?.text,
            messageType: "text",
          });
          //update last message of conversation
          await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: message._id,
          });

          //send message to other participants
          conversation?.participants.forEach((participant) => {
            if (participant.toString() != socket.user._id.toString()) {
              const recUser = connectedUsers.get(participant.toString());
              //if user is not connected in the browser
              if (!recUser) {
                return;
              } else {
                io.to(recUser).emit("new-message", {
                  message: {
                    _id: message._id,
                    content: message.content,
                    conversation: {
                      __v: conversation.__v,
                      _id: conversation._id,
                      createdAt: conversation.createdAt,
                      groupName: conversation.groupName,
                      isGroup: conversation.isGroup,
                      updatedAt: conversation.updatedAt,
                    },
                    createdAt: message.createdAt,
                    messageType: message.messageType,
                    updatedAt: message.updatedAt,
                    sender: {
                      _id: socket.user._id,
                      email: socket.user.email,
                      fullName: socket.user.fullName,
                      username: socket.user.username,
                    },
                  },
                  sender: {
                    username: socket.user.username,
                    email: socket.user.email,
                  },
                });
              }
            }
          });
        } catch (error) {
          socket.emit("message-error", {
            type: "internal-server-error",
            message: "Failed to save messages",
          });
        }
      });

      socket.on("disconnect", () => {
        connectedUsers.delete(socket.user._id);
        console.log(connectedUsers);
      });
    });

    server.listen(PORT, () => {
      console.log(`connected on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
    throw new Error("app crashed at app");
  });
