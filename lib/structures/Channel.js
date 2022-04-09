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
            case ChannelTypes.GUILD_STORE: {
                return new StoreChannel(data, client);
            }
            case ChannelTypes.GUILD_STAGE_VOICE: {
                return new StageChannel(data, client);
            }
            case ChannelTypes.GUILD_DIRECTORY: {
                // Can only be used in school Discord servers
                return;
            }
            case ChannelTypes.GUILD_FORUM: {
                // Forum channels is still in closed beta
                return;
            }
        }
        if(data.guild_id) {
            if(data.last_message_id !== undefined) {
                client.emit("warn", new Error(`Unknown guild text channel type: ${data.type}\n${JSON.stringify(data)}`));
                return new TextChannel(data, client);
            }
            client.emit("warn", new Error(`Unknown guild channel type: ${data.type}\n${JSON.stringify(data)}`));
            return new GuildChannel(data, client);
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
const GuildChannel = require("./GuildChannel");
const NewsChannel = require("./NewsChannel");
const StageChannel = require("./StageChannel");
const StoreChannel = require("./StoreChannel");
const TextChannel = require("./TextChannel");
const VoiceChannel = require("./VoiceChannel");
