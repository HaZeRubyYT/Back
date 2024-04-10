import { Server } from "socket.io";
import express from "express";
import { createServer } from "http";
import { MongoClient, ServerApiVersion } from "mongodb";
import cors from "cors";
import generator from "generate-password";

const port = 3001;

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(httpServer, {
	connectionStateRecovery: {
		// the backup duration of the sessions and the packets
		maxDisconnectionDuration: 2 * 60 * 1000,
		// whether to skip middlewares upon successful recovery
		skipMiddlewares: true
	},
	cors: {
		origin: "*",
	},
});

const uri =
	"mongodb+srv://shivamkumar:kumar820@cluster820.ltuebcp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster820";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});
client.connect();

const db = client.db("quick-chat");
const userData = db.collection("userData");
const textSpace = db.collection("textSpace");

let usernames = [];
let allMessages = [];

io.on("connection", (socket) => {
	console.log(`A new user has connected: ${socket.id}`);
	socket.on("init", () => {
		// // console.log(usernames);
		io.emit("get username", usernames);
		io.emit("get messages", allMessages);
	});

	socket.on("join room", async (email, toJoin, callback) => {
		let roomsToJoin = [];
		if (toJoin && toJoin !== -1) {
			const check = await textSpace.find({ pin: toJoin }).toArray();
			// console.log(check, "check");
			if (check !== undefined && check.length !== 0) {
				if (check[0].pin == toJoin) {
					roomsToJoin.push(toJoin);
					await textSpace.updateOne({ pin: toJoin }, { $push: { participants: email } });
					await userData.updateOne(
						{ email: email },
						{ $push: { textspaces: { pin: toJoin, isHost: false } } },
					);
				}
			}
		}
		const result = await userData.findOne({ email: email });
		const textspaceResult = await textSpace.find({ participants: { $all: [email] } }).toArray();

		console.log(textspaceResult, "textspaceResult");
		console.log(result, "first result");

		if (result != [] && result.textspaces) {
			for (let obj of result.textspaces) {
				roomsToJoin.push(obj.pin);
			}
		}

		if (roomsToJoin.length > 0) {
			socket.join(roomsToJoin);
			socket.emit("example", "hello");
			socket.emit("get user textspace", textspaceResult, socket.rooms, () => {
				console.log("I have been emitted");
			});
			callback(result);
			console.log("joined!", roomsToJoin);
			socket.emit("prevent");
		}
	});

	socket.on("add new user", async (userLoginData) => {
		// console.log(userLoginData, "login data");
		if (userLoginData != undefined) {
			await userData.insertOne(userLoginData);
			usernames.push({ id: socket.id, user: userLoginData.username });
		}
	});
	socket.on("check login", async (loginData) => {
		socket.emit("prevent");
		if (loginData != undefined) {
			const data = await userData.findOne({ email: loginData.email, password: loginData.password });
			// // console.log(data, "check login");
			if (data != null) {
				// console.log(loginData.email);
				socket.emit("login", loginData.email, data.username);
			} else {
				socket.emit("login error");
			}
		}
	});

	socket.on("check sign up", async (username, email, callback) => {
		const resultUsername = await userData.find({ username: username }).toArray();
		const resultEmail = await userData.find({ email: email }).toArray();
		switch (true) {
			case resultUsername.length == 0 && resultEmail.length == 0:
				callback({ status: "ok" });
				break;
			case resultUsername.length > 0 && resultEmail.length > 0:
				callback({
					status: "error",
					email: true,
					username: "true",
				});
				break;
			case resultEmail.length > 0 && resultUsername.length == 0:
				callback({
					status: "error",
					email: true,
					username: false,
				});
				break;
			case resultUsername.length > 0 && resultEmail.length == 0:
				callback({
					status: "error",
					email: false,
					username: true,
				});
			default:
				break;
		}
	});

	socket.on("sent message", async (message, name) => {
		// console.log(socket.id);
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
				milliseconds: timeValue.getTime(),
			},
		];
		io.emit("get username", usernames);
		io.emit("get messages", allMessages);
		// // console.log(allMessages);
	});
	socket.on("new textspace", async (title, username, email) => {
		const pin = generator.generate({ length: 6, uppercase: false, numbers: false, lowercase: true });
		const result = await userData.updateOne(
			{ email: email, username: username, textspaces: { $exists: true } },
			{ $push: { textspaces: { pin: pin, isHost: true } } },
		);
		if (result.modifiedCount == 0) {
			await userData.updateOne(
				{ email: email, username: username },
				{ $set: { textspaces: [{ pin: pin, isHost: true }] } },
			);
		}
		await textSpace.insertOne({
			pin: pin,
			title: title,
			host: email,
			participants: [email],
			messages: [],
		});
		socket.emit("login", email, username);
	});

	socket.on("check room pin", async (pin, callback) => {
		const result = await textSpace.find({ pin: pin }).toArray();
		// // console.log(result.length);
		if (result.length == 0) {
			callback({
				status: "Textspace Pin Does Not Exist",
			});
		} else if (result[0].pin === pin) {
			callback({
				status: "ok",
			});
		}
	});

	socket.on("disconnect", () => {
		// // console.log(socket.id, " lol");
		usernames = usernames.filter((userObj) => userObj.id != socket.id);
		allMessages = allMessages.filter((messageObj) => messageObj.id != socket.id);
		io.emit("get messages", allMessages);
		console.log(`User disconnected: ${socket.id}`);
	});
});
client.close();
httpServer.listen(port, async () => {
	console.log(`Listening on http://localhost:${port}`);
});
