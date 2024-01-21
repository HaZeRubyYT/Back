import { Server } from "socket.io";
import express from "express";
import { createServer } from "http";
import { generateUsername } from "unique-username-generator";

const port = 3001;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: "https://legendary-sundae-dc58ea.netlify.app/",
		credentials: true,
	},
});
let usernames = [];
let allMessages = [];

// const userData = io.of("/data");

io.on("connection", (socket) => {
	console.log(`A new user has connected: ${socket.id}`);
	socket.on("login", () => {
		// console.log("revieved");
		usernames.push({ id: socket.id, user: generateUsername("-", 2) });
		console.log(usernames);
		// console.log(io.getMaxListeners())
		io.emit("get username", usernames);
		io.emit("get messages", allMessages);
	});

	socket.on("sent message", (message, name) => {
		console.log(socket.id);
		io.emit("chat message", message);
		const timeValue = new Date();
		allMessages = [
			...allMessages,
			{
				messageID: allMessages?.length > 0 ? allMessages.length : 0,
				id: socket.id,
				message: message,
				time:
					timeValue.getHours() +
					":" +
					(timeValue.getMinutes() < 10 ? `0${timeValue.getMinutes()}` : timeValue.getMinutes()),
				milliseconds : timeValue.getTime()
			},
		];
		io.emit("get username", usernames);
		io.emit("get messages", allMessages);
		// console.log(allMessages);
	});

	socket.on("disconnect", () => {
		// console.log(socket.id, " lol");
		usernames = usernames.filter((userObj) => userObj.id != socket.id);
		allMessages = allMessages.filter((messageObj) => messageObj.id != socket.id);
		io.emit("get messages", allMessages);
		console.log(`User disconnected: ${socket.id}`);
	});
});

httpServer.listen(port, () => {
	console.log(`Listening on http://localhost:${port}`);
});
