"use strict";

const Base = require("./Base");
const {ChannelTypes} = require("../Constants");

/**
* Represents a channel. You also probably want to look at CategoryChannel, NewsChannel, TextChannel, and VoiceChannel.
* @prop {String} id The ID of the channel
* @prop {String} mention A string that mentions the channel
* @prop {Number} type The type of the channel
* @prop {Client} client The client that initialized the channel
* @prop {Number} createdAt Timestamp of the channel's creation
* Edit: Limited channel cache, some channel aren't used (ZixeSea)
*/
class Channel extends Base {
    constructor(data, client) {
        super(data.id);
        this.type = data.type;
        this.client = client;
    }

    static from(data, client) {
        switch(data.type) {
            case ChannelTypes.GUILD_TEXT: {
                return new TextChannel(data, client);
            }
            case ChannelTypes.GUILD_VOICE: {
                return new VoiceChannel(data, client);
            }
            case ChannelTypes.GUILD_CATEGORY: {
                return new CategoryChannel(data, client);
            }
            case ChannelTypes.GUILD_NEWS: {
                return new NewsChannel(data, client);
            }
            case ChannelTypes.GUILD_STORE: {
                return new StoreChannel(data, client);   
            }
            default: {
                return;
            }
        }
    }

    toJSON(props = []) {
        return super.toJSON([
            "type",
            ...props
        ]);
    }
}

module.exports = Channel;

// Circular import
const CategoryChannel = require("./CategoryChannel");
const NewsChannel = require("./NewsChannel");
const StoreChannel = require("./StoreChannel");
const TextChannel = require("./TextChannel");
const VoiceChannel = require("./VoiceChannel");
