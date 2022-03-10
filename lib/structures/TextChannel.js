"use strict";

const Collection = require("../util/Collection");
const GuildChannel = require("./GuildChannel");
const Message = require("./Message");

/**
* Represents a guild text channel. See GuildChannel for more properties and methods.
* @extends GuildChannel
* @prop {Collection<Message>} messages Collection of Messages in this channel
* @prop {String?} topic The topic of the channel
*/
class TextChannel extends GuildChannel {
    constructor(data, client, messageLimit) {
        super(data, client);
        this.messages = new Collection(Message, messageLimit == null ? client.options.messageLimit : messageLimit);
        this.update(data);
    }

    update(data) {
        super.update(data);
        if(data.topic !== undefined) {
            this.topic = data.topic;
        }
    }

    /**
    * Create a message in the channel
    * @arg {String | Object} content A string or object. If an object is passed:
    * @arg {Object} [content.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [content.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [content.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [content.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Boolean} [content.allowedMentions.repliedUser] Whether or not to mention the author of the message being replied to.
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
    * @arg {Array<String>} [content.stickerIDs] An array of IDs corresponding to stickers to send
    * @arg {Object | Array<Object>} [file] A file object (or an Array of them)
    * @arg {Buffer} file.file A buffer containing file data
    * @arg {String} file.name What to name the file
    * @returns {Promise<Message>}
    */
    createMessage(content, file) {
        return this.client.createMessage.call(this.client, this.id, content, file);
    }

    /**
    * Create a channel webhook
    * @arg {Object} options Webhook options
    * @arg {String} [options.avatar] The default avatar as a base64 data URI. Note: base64 strings alone are not base64 data URI strings
    * @arg {String} options.name The default name
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<Object>} Resolves with a webhook object
    */
    createWebhook(options, reason) {
        return this.client.createChannelWebhook.call(this.client, this.id, options, reason);
    }

    /**
    * Delete a message
    * @arg {String} messageID The ID of the message
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    deleteMessage(messageID, reason) {
        return this.client.deleteMessage.call(this.client, this.id, messageID, reason);
    }

    /**
    * Edit a message
    * @arg {String} messageID The ID of the message
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
    editMessage(messageID, content) {
        return this.client.editMessage.call(this.client, this.id, messageID, content);
    }

    /**
    * Get all invites in the channel
    * @returns {Promise<Array<Invite>>}
    */
    getInvites() {
        return this.client.getChannelInvites.call(this.client, this.id);
    }

    /**
    * Get a previous message in the channel
    * @arg {String} messageID The ID of the message
    * @returns {Promise<Message>}
    */
    getMessage(messageID) {
        return this.client.getMessage.call(this.client, this.id, messageID);
    }

    /**
    * Get previous messages in the channel
    * @arg {Object} [options] Options for the request. If this is a number ([DEPRECATED] behavior), it is treated as `options.limit`
    * @arg {String} [options.after] Get messages after this message ID
    * @arg {String} [options.around] Get messages around this message ID (does not work with limit > 100)
    * @arg {String} [options.before] Get messages before this message ID
    * @arg {Number} [options.limit=50] The max number of messages to get
    * @arg {String} [before] [DEPRECATED] Get messages before this message ID
    * @arg {String} [after] [DEPRECATED] Get messages after this message ID
    * @arg {String} [around] [DEPRECATED] Get messages around this message ID (does not work with limit > 100)
    * @returns {Promise<Array<Message>>}
    */
    getMessages(options, before, after, around) {
        return this.client.getMessages.call(this.client, this.id, options, before, after, around);
    }

    /**
    * Get all the webhooks in the channel
    * @returns {Promise<Array<Object>>} Resolves with an array of webhook objects
    */
    getWebhooks() {
        return this.client.getChannelWebhooks.call(this.client, this.id);
    }

    toJSON(props = []) {
        return super.toJSON([
            "messages",
            "topic",
            ...props
        ]);
    }
}

module.exports = TextChannel;
