"use strict";

const Base = require("./Base");
const Endpoints = require("../rest/Endpoints");
const User = require("./User");

/**
* Represents a message
* @prop {String} id The ID of the message
* @prop {TextChannel | NewsChannel} channel The channel the message is in
* @prop {String} [guildID] The ID of the guild this message is in (undefined if in DMs)
* @prop {Number} timestamp Timestamp of message creation
* @prop {Number} type The type of the message
* @prop {User} author The message author
* @prop {Member?} member The message author with server-specific data
* @prop {User[]} mentions Array of mentioned users
* @prop {String} content Message content
* @prop {String?} cleanContent Message content with mentions replaced by names. Mentions are currently escaped, but this behavior is [DEPRECATED] and will be removed soon. Use allowed mentions, the official way of avoiding unintended mentions, when creating messages.
* @prop {String[]} roleMentions Array of mentioned roles' ids
* @prop {String[]} channelMentions Array of mentions channels' ids
* @prop {String} jumpLink The url used by Discord clients to jump to this message
* @prop {Number?} editedTimestamp Timestamp of latest message edit
* @prop {Boolean} tts Whether to play the message using TTS or not
* @prop {Boolean} mentionEveryone Whether the message mentions everyone/here or not
* @prop {Object?} messageReference An object containing the reference to the original message if it is a crossposted message
* @prop {String} messageReference.messageID The id of the original message this message was crossposted from
* @prop {String} messageReference.channelID The id of the channel this message was crossposted from
* @prop {String} messageReference.guildID The id of the guild this message was crossposted from
* @prop {Number} flags Message flags (see constants)
* @prop {Object[]} attachments Array of attachments
* @prop {Object[]} embeds Array of embeds
* @prop {Object?} activity The activity specified in the message
* @prop {Object?} application The application of the activity in the message
* @prop {Object} reactions An object containing the reactions on the message
* @prop {Number} reactions.count The number of times the reaction was used
* @prop {String?} webhookID ID of the webhook that sent the message
* @prop {Boolean} reactions.me Whether or not the bot user did the reaction
* @prop {Boolean} pinned Whether the message is pinned or not
*/
class Message extends Base {
    constructor(data, client) {
        super(data.id);
        this._client = client;
        this.type = data.type || 0;
        this.timestamp = Date.parse(data.timestamp);
        this.channel = client.getChannel(data.channel_id) || {
            id: data.channel_id
        };
        this.content = "";
        this.hit = !!data.hit;
        this.reactions = {};
        this.guildID = data.guild_id;
        this.webhookID = data.webhook_id;

        if(data.message_reference) {
            this.messageReference = {
                messageID: data.message_reference.message_id,
                channelID: data.message_reference.channel_id,
                guildID: data.message_reference.guild_id
            };
        } else {
            this.messageReference = null;
        }

        this.flags = data.flags || 0;

        if(data.author) {
            if(data.author.discriminator !== "0000") {
                this.author = client.users.update(data.author, client);
            } else {
                this.author = new User(data.author, client);
            }
        } else {
            this._client.emit("error", new Error("MESSAGE_CREATE but no message author:\n" + JSON.stringify(data, null, 2)));
        }
        if(this.channel.guild) {
            if(data.member) {
				// Edit: Addeds a limited member object to the message and removes from guild (ZixeSea)
				data.member.id = this.author.id;
				data.member.permissions = this.channel.guild.permissionsOf(data.member);
				this.member = data.member;
            } else if(this.channel.guild.members.has(this.author.id)) {
                this.member = this.channel.guild.members.get(this.author.id);
            } else {
                this.member = null;
            }

            if(!this.guildID) {
                this.guildID = this.channel.guild.id;
            }
        } else {
            this.member = null;
        }

        this.update(data, client);
    }

    update(data, client) {
        if(this.type === 3) { // (╯°□°）╯︵ ┻━┻
            (this.channel.call || this.channel.lastCall).update(data.call);
        }
        if(data.content !== undefined) {
            this.content = data.content || "";
            this.mentionEveryone = !!data.mention_everyone;
            this.roleMentions = data.mention_roles;
        }
        if(data.embeds !== undefined) {
            this.embeds = data.embeds;
        }
    }

    get channelMentions() {
        if(this._channelMentions) {
            return this._channelMentions;
        }

        return (this._channelMentions = (this.content.match(/<#[0-9]+>/g) || []).map((mention) => mention.substring(2, mention.length - 1)));
    }

    get jumpLink() {
        return `${Endpoints.CLIENT_URL}${Endpoints.MESSAGE_LINK(this.channel.type === 1 ? "@me" : this.channel.guild.id, this.channel.id, this.id)}`;
    }

    /**
    * Edit the message
    * @arg {String | Array | Object} content A string, array of strings, or object. If an object is passed:
    * @arg {String} content.content A content string
    * @arg {Boolean} [content.disableEveryone] Whether to filter @everyone/@here or not (overrides default)
    * @arg {Object} [content.embed] An embed object. See [the official Discord API documentation entry](https://discordapp.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Number} [content.flags] A number representing the flags to apply to the message. See [the official Discord API documentation entry](https://discordapp.com/developers/docs/resources/channel#message-object-message-flags) for flags reference
    * @arg {Object} [content.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [content.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [content.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [content.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @returns {Promise<Message>}
    */
    edit(content) {
        return this._client.editMessage.call(this._client, this.channel.id, this.id, content);
    }

    /**
    * Pin the message
    * @returns {Promise}
    */
    pin() {
        return this._client.pinMessage.call(this._client, this.channel.id, this.id);
    }

    /**
    * Unpin the message
    * @returns {Promise}
    */
    unpin() {
        return this._client.unpinMessage.call(this._client, this.channel.id, this.id);
    }

    /**
    * Get a list of users who reacted with a specific reaction
    * @arg {String} reaction The reaction (Unicode string if Unicode emoji, `emojiName:emojiID` if custom emoji)
    * @arg {Number} [limit=100] The maximum number of users to get
    * @arg {String} [before] Get users before this user ID
    * @arg {String} [after] Get users after this user ID
    * @returns {Promise<User[]>}
    */
    getReaction(reaction, limit, before, after) {
        return this._client.getMessageReaction.call(this._client, this.channel.id, this.id, reaction, limit, before, after);
    }

    /**
    * Add a reaction to a message
    * @arg {String} reaction The reaction (Unicode string if Unicode emoji, `emojiName:emojiID` if custom emoji)
    * @arg {String} [userID="@me"] The ID of the user to react as
    * @returns {Promise}
    */
    addReaction(reaction, userID) {
        return this._client.addMessageReaction.call(this._client, this.channel.id, this.id, reaction, userID);
    }

    /**
    * Remove a reaction from a message
    * @arg {String} reaction The reaction (Unicode string if Unicode emoji, `emojiName:emojiID` if custom emoji)
    * @arg {String} [userID="@me"] The ID of the user to remove the reaction for
    * @returns {Promise}
    */
    removeReaction(reaction, userID) {
        return this._client.removeMessageReaction.call(this._client, this.channel.id, this.id, reaction, userID);
    }

    /**
    * Remove all reactions from a message
    * @returns {Promise}
    */
    removeReactions() {
        return this._client.removeMessageReactions.call(this._client, this.channel.id, this.id);
    }

    /**
    * Remove all reactions from a message for a single emoji
    * @arg {String} reaction The reaction (Unicode string if Unicode emoji, `emojiName:emojiID` if custom emoji)
    * @returns {Promise}
    */
    removeReactionEmoji(reaction) {
        return this._client.removeMessageReactionEmoji.call(this._client, this.channel.id, this.id, reaction);
    }

    /**
    * Delete the message
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    delete(reason) {
        return this._client.deleteMessage.call(this._client, this.channel.id, this.id, reason);
    }

    /**
     * Crosspost (publish) a message to subscribed channels (NewsChannel only)
     * @returns {Promise<Message>}
     */
    crosspost() {
        return this._client.crosspostMessage.call(this._client, this.channel.id, this.id);
    }

    toJSON(props = []) {
        return super.toJSON([
            "attachments",
            "author",
            "content",
            "editedTimestamp",
            "embeds",
            "hit",
            "mentionEveryone",
            "mentions",
            "pinned",
            "reactions",
            "roleMentions",
            "timestamp",
            "tts",
            "type",
            ...props
        ]);
    }
}

module.exports = Message;
