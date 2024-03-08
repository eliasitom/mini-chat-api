const mongoose = require("mongoose")

const Schema = mongoose.Schema

const chatSchema = new Schema({
    name: {
        require: true,
        type: String
    },
    messages: [{
        createdBy: String,
        body: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    members: [String]
})

const Chat = mongoose.model("chat", chatSchema)

module.exports = Chat