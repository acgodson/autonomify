import net from "net";
import { handleRequest } from "./handler.js";

const NODE_PORT = 5001;

export function startServer() {
  const server = net.createServer((socket) => {
    console.log("Client connected");
    let buffer = "";

    socket.on("data", async (chunk) => {
      buffer += chunk.toString();

      if (buffer.includes("\n")) {
        const messages = buffer.split("\n");
        buffer = messages.pop() || "";

        for (const message of messages) {
          if (!message.trim()) continue;

          try {
            const request = JSON.parse(message);
            console.log("Request:", request.type);
            const response = await handleRequest(request);
            socket.write(JSON.stringify(response) + "\n");
          } catch (error) {
            socket.write(JSON.stringify({
              success: false,
              error: String(error)
            }) + "\n");
          }
        }
      }
    });

    socket.on("error", (err) => console.error("Socket error:", err));
    socket.on("end", () => console.log("Client disconnected"));
  });

  server.listen(NODE_PORT, "0.0.0.0", () => {
    console.log(`🔒 Node.js server listening on 0.0.0.0:${NODE_PORT}`);
  });

  return server;
}
