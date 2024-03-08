const mongoose = require("mongoose")

const Schema = mongoose.Schema

const userSchema = new Schema({
    username: {
        require: true,
        unique: true,
        type: String
    },
    password: {
        require: true,
        type: String
    },
    chats: [String],
})

const User = mongoose.model("user", userSchema)

module.exports = User