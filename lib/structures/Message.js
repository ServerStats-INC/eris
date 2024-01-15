"use strict";

const Base = require("./Base");

/**
* Represents a message
* @prop {TextChannel | NewsChannel} channel The channel the message is in. Can be partial with only the id if the channel is not cached.
* @prop {Command?} command The Command used in the Message, if any (CommandClient only)
* @prop {Array<Object>} components An array of component objects
* @prop {String} content Message content
* @prop {Number} createdAt Timestamp of message creation
* @prop {Array<Object>} embeds Array of embeds
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
* @prop {Number} type The type of the message
*/
class Message extends Base {
    constructor(data, client) {
        super(data.id);
        this._client = client;
        this.type = data.type || 0;
        this.guildID = data.guild_id;
        this.channel = this._client.getChannel(data.channel_id, data.guild_id) || {
            id: data.channel_id
        };
        this.content = "";

        if(this.channel.guild) {
            if(data.member) {
                if(data.author) {
                    data.member.id = data.author.id;
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
        if(data.components !== undefined) {
            this.components = data.components;
        }
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
        return this._client.editMessage.call(this._client, this.channel.id, this.id, content);
    }

    toJSON(props = []) {
        return super.toJSON([
            "content",
            "guildID",
            "member",
            "type",
            "channel",
            ...props
        ]);
    }
}

module.exports = Message;
