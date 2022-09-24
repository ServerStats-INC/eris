"use strict";

const Base = require("./Base");
const {ChannelTypes} = require("../Constants");

/**
* Represents a channel. You also probably want to look at CategoryChannel, NewsChannel, TextChannel, and VoiceChannel.
* @prop {Client} client The client that initialized the channel
* @prop {Number} createdAt Timestamp of the channel's creation
* @prop {String} id The ID of the channel
* @prop {Number} type The type of the channel
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
            case ChannelTypes.GUILD_STAGE_VOICE: {
                return new StageChannel(data, client);
            }
            case ChannelTypes.GUILD_NEWS_THREAD:
            case ChannelTypes.GUILD_PUBLIC_THREAD:
            case ChannelTypes.GUILD_PRIVATE_THREAD:
            case ChannelTypes.GUILD_DIRECTORY:
            case ChannelTypes.GUILD_FORUM: {
                return;
            }
        }
        
        return;
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
const StageChannel = require("./StageChannel");
const TextChannel = require("./TextChannel");
const VoiceChannel = require("./VoiceChannel");
