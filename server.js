require("./database")

const userSchema = require("./Schemas/UserSchema")
const chatSchema = require("./Schemas/ChatSchema")

require("dotenv").config()

const jwt = require("jsonwebtoken")
const TOKEN_EXPIRATION = "24h"

const CryptoJS = require("crypto-js")

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors())
app.use(express.json());



io.on('connect', (socket) => {
  console.log('A client has connected:', socket.id);

  socket.on("firstMessage", async (data) => {
    const { message, chatName } = data

    // Obtener al cliente que emite el evento
    const messageFrom = await userSchema.findOne({ username: message.createdBy })

    // Comprobar si ya existe un chat entre ambos usuarios
    const reverseChatMembers = chatName.split("_").reverse()
    const reverseChatName = reverseChatMembers[0] + "_" + reverseChatMembers[1]
    const chat = await chatSchema.findOne({ name: reverseChatName })

    if (chat) {
      socket.join(reverseChatName)

      chat.messages = [...chat.messages, message]
      await chat.save()

      io.to(reverseChatName).emit("message", chat)

      return
    }

    // Crear el chat
    const chatMembers = chatName.split("_")
    const newChat = new chatSchema({ name: chatName, members: chatMembers, messages: [message] })
    await newChat.save()

    // Actualizar usuarios
    const messageTo = await userSchema.findOne({ username: chatMembers[1] }) // [Client1, Client2] => [0] = Chat createdBy, [1] = Another member

    messageFrom.chats = [...messageFrom.chats, chatName]
    messageTo.chats = [...messageTo.chats, chatName]

    await messageFrom.save()
    await messageTo.save()

    socket.join(chatName)
    io.to(chatName).emit("firstMessageResponse", { chatData: newChat, userData: messageFrom })
  })
  socket.on("message", async data => {
    const { message, chatName } = data

    let chat = await chatSchema.findOne({ name: chatName })
    let reverseChatName

    // En caso de que el chat no se encuentre, intentar con el nombre del chat invertido
    if (!chat) {
      const reverseChatMembers = chatName.split("_").reverse()
      reverseChatName = reverseChatMembers[0] + "_" + reverseChatMembers[1]
      chat = await chatSchema.findOne({ name: reverseChatName })
    }

    chat.messages = [...chat.messages, message]
    await chat.save()

    io.to(reverseChatName || chatName).emit("message", chat)
  })
  socket.on("connectToAllRooms", (chats) => {
    chats.forEach(currentChat => {
      socket.join(currentChat)
      console.log("A client has connected on " + currentChat)
    });
  })

  socket.on('disconnect', () => {
    console.log('A client has disconnected:', socket.id);
  });
});


//#region AUTHENTICATION & USER_OPTIONS

app.post("/api/signIn", async (req, res) => {
  console.log(req.body)
  try {
    const userData = req.body

    // Validar userData
    if (!userData.password || !userData.username) return res.send(404).json({ message: "Insufficient data for authentication" })

    // Encriptar contraseña
    const encryptedPassword = CryptoJS.AES.encrypt(userData.password, process.env.SECRET_KEY).toString()

    // Crear y guardar userSchema
    const newUser = new userSchema({
      username: userData.username,
      password: encryptedPassword,
    })

    await newUser.save()

    // Generar un token
    const token = jwt.sign({ username: userData.username }, process.env.SECRET_KEY, { expiresIn: TOKEN_EXPIRATION })

    // Enviar respuesta
    res.status(200).json({ message: "Request received successfully", newUser, token })

  } catch (error) {
    console.log(error)
    res.status(500).send("An internal error has ocurred")
  }
})
app.post("/api/signUp", async (req, res) => {
  try {
    const userData = req.body
    // Validar userData
    if (!userData.password || !userData.username) return res.status(404).json({ message: "Insufficient data for authentication" })

    // Crear un nuevo token
    const newToken = jwt.sign({ username: userData.username }, process.env.SECRET_KEY, { expiresIn: TOKEN_EXPIRATION })

    // Buscar usuario
    const user = await userSchema.findOne({ username: userData.username })
    if (!user) return res.status(404).json({ message: "User not found" })

    // Comparar contraseñas
    const decryptedPassword = CryptoJS.AES.decrypt(user.password, process.env.SECRET_KEY).toString(CryptoJS.enc.Utf8)
    if (userData.password !== decryptedPassword) {
      return res.status(404).json({ message: "Incorrect password" })
    }

    // Enviar respuesta
    res.status(200).json({ message: "Successful authentication", newToken, user })
  } catch (error) {
    console.log(error)
    res.status(500).send("An internal error has ocurred")
  }
})

app.get("/api/verifyToken/:token", async (req, res) => {
  try {
    const token = req.params.token
    let decodedToken

    try {
      decodedToken = jwt.verify(token, process.env.SECRET_KEY)
    } catch (error) {
      return res.status(404).json({ message: "Invalid token" })
    }

    // Crear un nuevo token
    const newToken = jwt.sign({ username: decodedToken.username }, process.env.SECRET_KEY, { expiresIn: TOKEN_EXPIRATION })

    // Buscar usuario
    const user = await userSchema.findOne({ username: decodedToken.username })


    res.status(200).json({ message: "Valid token", user, newToken })

  } catch (error) {
    console.log(error)
    res.status(500).send("An internal error has ocurred")
  }
})

//#endregion

//#region SOCIAL_OPTIONS 

app.get("/api/getUser/:username", async (req, res) => {
  try {
    const username = req.params.username

    const user = await userSchema.findOne({ username })

    if (!user) return res.status(404).json({ message: "User not found" })

    res.status(200).json({ message: "User found successfully", user: user.username })
  } catch (error) {
    console.log(error)
    res.status(500).send("An internal error has ocurred")
  }
})

app.get("/api/getChat/:chatName", async (req, res) => {
  try {
    const chatName = req.params.chatName

    let chat = await chatSchema.findOne({ name: chatName })

    if (!chat) {
      const reverseChatMembers = chatName.split("_").reverse()
      reverseChatName = reverseChatMembers[0] + "_" + reverseChatMembers[1]
      chat = await chatSchema.findOne({ name: reverseChatName })
    }

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    res.status(200).json({ Message: "Request received successfully", chat })

  } catch (error) {
    console.log(error)
    res.status(500).send("An internal error has ocurred")
  }
})

//#endregion




const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server on port ${PORT}...`);
});
