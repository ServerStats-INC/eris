"use strict";

const Base = require("./Base");
const {MessageFlags} = require("../Constants");
const User = require("./User");

/**
* Represents a message
* @prop {Object?} activity The activity specified in the message
* @prop {Object?} application The application of the activity in the message
* @prop {String?} applicationID The ID of the interaction's application
* @prop {Array<Object>} attachments Array of attachments
* @prop {User} author The message author
* @prop {TextChannel | NewsChannel} channel The channel the message is in. Can be partial with only the id if the channel is not cached.
* @prop {Command?} command The Command used in the Message, if any (CommandClient only)
* @prop {Array<Object>} components An array of component objects
* @prop {String} content Message content
* @prop {Number} createdAt Timestamp of message creation
* @prop {Array<Object>} embeds Array of embeds
* @prop {Number} flags Message flags (see constants)
* @prop {String} [guildID] The ID of the guild this message is in (undefined if in DMs)
* @prop {String} id The ID of the message
* @prop {String} jumpLink The url used by Discord clients to jump to this message
* @prop {Member?} member The message author with server-specific data
* @prop {Object?} interaction An object containing info about the interaction the message is responding to, if applicable
* @prop {String} interaction.id The id of the interaction
* @prop {Number} interaction.type The type of interaction
* @prop {String} interaction.name The name of the command
* @prop {User} interaction.user The user who invoked the interaction
* @prop {Member?} interaction.member The member who invoked the interaction
* @prop {String?} prefix The prefix used in the Message, if any (CommandClient only)
* @prop {Number} timestamp Timestamp of message creation
* @prop {Number} type The type of the message
* @prop {String?} webhookID ID of the webhook that sent the message
*/
class Message extends Base {
    constructor(data, client) {
        super(data.id);
        this._client = client;
        this.type = data.type || 0;
        this.timestamp = Date.parse(data.timestamp);
        this.guildID = data.guild_id;
        this.channel = this._client.getChannel(data.channel_id, data.guild_id) || {
            id: data.channel_id
        };
        this.content = "";
        this.webhookID = data.webhook_id;

        this.flags = data.flags || 0;

        if(data.author) {
            if(data.author.discriminator !== "0000") {
                this.author = this._client.users.update(data.author, client);
            } else {
                this.author = new User(data.author, client);
            }
        } else {
            this._client.emit("error", new Error("MESSAGE_CREATE but no message author:\n" + JSON.stringify(data, null, 2)));
        }

        if(this.channel.guild) {
            if(data.member) {
                data.member.id = this.author.id;
                if(data.author) {
                    data.member.user = data.author;
                }
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
        if(data.content !== undefined) {
            this.content = data.content || "";
        }

        if(data.attachments !== undefined) {
            this.attachments = data.attachments;
        }
        if(data.embeds !== undefined) {
            this.embeds = data.embeds;
        }
        if(data.flags !== undefined) {
            this.flags = data.flags;
        }
        if(data.activity !== undefined) {
            this.activity = data.activity;
        }
        if(data.application !== undefined) {
            this.application = data.application;
        }
        if(data.application_id !== undefined) {
            this.applicationID = data.application_id;
        }
        
        if(data.components !== undefined) {
            this.components = data.components;
        }
    }

    /**
    * Delete the message
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    delete(reason) {
        if(this.flags & MessageFlags.EPHEMERAL) {
            throw new Error("Ephemeral messages cannot be deleted");
        }
        return this._client.deleteMessage.call(this._client, this.channel.id, this.id, reason);
    }

    /**
    * Delete the message as a webhook
    * @arg {String} token The token of the webhook
    * @returns {Promise}
    */
    deleteWebhook(token) {
        if(!this.webhookID) {
            throw new Error("Message is not a webhook");
        }
        if(this.flags & MessageFlags.EPHEMERAL) {
            throw new Error("Ephemeral messages cannot be deleted");
        }
        return this._client.deleteWebhookMessage.call(this._client, this.webhookID, token, this.id);
    }

    /**
    * Edit the message
    * @arg {String | Array | Object} content A string, array of strings, or object. If an object is passed:
    * @arg {Object} [content.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [content.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [content.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [content.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Array<Object>} [content.components] An array of component objects
    * @arg {String} [content.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [content.components[].disabled] Whether the component is disabled (type 2 and 3 only)
    * @arg {Object} [content.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [content.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [content.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [content.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
    * @arg {Array<Object>} [content.components[].options] The options for this component (type 3 only)
    * @arg {Boolean} [content.components[].options[].default] Whether this option should be the default value selected
    * @arg {String} [content.components[].options[].description] The description for this option
    * @arg {Object} [content.components[].options[].emoji] The emoji to be displayed in this option
    * @arg {String} content.components[].options[].label The label for this option
    * @arg {Number | String} content.components[].options[].value The value for this option
    * @arg {String} [content.components[].placeholder] The placeholder text for the component when no option is selected (type 3 only)
    * @arg {Number} [content.components[].style] The style of the component (type 2 only) - If 0-4, `custom_id` is required; if 5, `url` is required
    * @arg {Number} content.components[].type The type of component - If 1, it is a collection and a `components` array (nested) is required; if 2, it is a button; if 3, it is a select menu
    * @arg {String} [content.components[].url] The URL that the component should open for users (type 2 style 5 only)
    * @arg {String} [content.content] A content string
    * @arg {Object} [content.embed] An embed object. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Array<Object>} [content.embeds] An array of embed objects. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Object | Array<Object>} [content.file] A file object (or an Array of them)
    * @arg {Buffer} content.file[].file A buffer containing file data
    * @arg {String} content.file[].name What to name the file
    * @arg {Number} [content.flags] A number representing the flags to apply to the message. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#message-object-message-flags) for flags reference
    * @returns {Promise<Message>}
    */
    edit(content) {
        if(this.flags & MessageFlags.EPHEMERAL) {
            throw new Error("Ephemeral messages cannot be edited via this method");
        }
        return this._client.editMessage.call(this._client, this.channel.id, this.id, content);
    }

    /**
    * Edit the message as a webhook
    * @arg {String} token The token of the webhook
    * @arg {Object} options Webhook message edit options
    * @arg {Object} [options.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [options.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean} [options.allowedMentions.repliedUser] Whether or not to mention the author of the message being replied to.
    * @arg {Boolean | Array<String>} [options.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [options.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Array<Object>} [options.components] An array of component objects
    * @arg {String} [options.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [options.components[].disabled] Whether the component is disabled (type 2 only)
    * @arg {Object} [options.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [options.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [options.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [options.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
    * @arg {Array<Object>} [options.components[].options] The options for this component (type 3 only)
    * @arg {Boolean} [options.components[].options[].default] Whether this option should be the default value selected
    * @arg {String} [options.components[].options[].description] The description for this option
    * @arg {Object} [options.components[].options[].emoji] The emoji to be displayed in this option
    * @arg {String} options.components[].options[].label The label for this option
    * @arg {Number | String} options.components[].options[].value The value for this option
    * @arg {String} [options.components[].placeholder] The placeholder text for the component when no option is selected (type 3 only)
    * @arg {Number} [options.components[].style] The style of the component (type 2 only) - If 0-4, `custom_id` is required; if 5, `url` is required
    * @arg {Number} options.components[].type The type of component - If 1, it is a collection and a `components` array (nested) is required; if 2, it is a button; if 3, it is a select menu
    * @arg {String} [options.components[].url] The URL that the component should open for users (type 2 style 5 only)
    * @arg {String} [options.content] A content string
    * @arg {Object} [options.embed] An embed object. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Array<Object>} [options.embeds] An array of embed objects. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Object | Array<Object>} [options.file] A file object (or an Array of them)
    * @arg {Buffer} options.file.file A buffer containing file data
    * @arg {String} options.file.name What to name the file
    * @returns {Promise<Message>}
    */
    editWebhook(token, options) {
        if(!this.webhookID) {
            throw new Error("Message is not a webhook");
        }
        return this._client.editWebhookMessage.call(this._client, this.webhookID, token, this.id, options);
    }

    toJSON(props = []) {
        return super.toJSON([
            "activity",
            "application",
            "attachments",
            "author",
            "content",
            "embeds",
            "flags",
            "guildID",
            "member",
            "timestamp",
            "type",
            "webhookID",
            ...props
        ]);
    }
}

module.exports = Message;
