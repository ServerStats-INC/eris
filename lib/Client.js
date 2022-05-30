"use strict";

const Base = require("./structures/Base");
const Channel = require("./structures/Channel");
const Collection = require("./util/Collection");
const Constants = require("./Constants");
const Endpoints = require("./rest/Endpoints");
const ExtendedUser = require("./structures/ExtendedUser");
const Guild = require("./structures/Guild");
const Invite = require("./structures/Invite");
const RequestHandler = require("./rest/RequestHandler");
const ShardManager = require("./gateway/ShardManager");
const UnavailableGuild = require("./structures/UnavailableGuild");
const User = require("./structures/User");

let EventEmitter;
try {
    EventEmitter = require("eventemitter3");
} catch(err) {
    EventEmitter = require("events");
}
let Erlpack;
try {
    Erlpack = require("erlpack");
} catch(err) { // eslint-disable no-empty
}
let ZlibSync;
try {
    ZlibSync = require("zlib-sync");
} catch(err) {
    try {
        ZlibSync = require("pako");
    } catch(err) { // eslint-disable no-empty
    }
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
* Represents the main Eris client
* @extends EventEmitter
* @prop {Object?} application Object containing the bot application's ID and its public flags
* @prop {Boolean} bot Whether the bot user belongs to an OAuth2 application
* @prop {Object} channelGuildMap Object mapping channel IDs to guild IDs
* @prop {String} gatewayURL The URL for the discord gateway
* @prop {Collection<Guild>} guilds Collection of guilds the bot is in
* @prop {Object} guildShardMap Object mapping guild IDs to shard IDs
* @prop {Object} options Eris options
* @prop {RequestHandler} requestHandler The request handler the client will use
* @prop {Collection<Shard>} shards Collection of shards Eris is using
* @prop {Number} startTime Timestamp of bot ready event
* @prop {Collection<UnavailableGuild>} unavailableGuilds Collection of unavailable guilds the bot is in
* @prop {Number} uptime How long in milliseconds the bot has been up for
* @prop {ExtendedUser} user The bot user
* @prop {Collection<User>} users Collection of users the bot sees
*/
class Client extends EventEmitter {
    /**
    * Create a Client
    * @arg {String} token The auth token to use. Bot tokens should be prefixed with `Bot` (e.g. `Bot MTExIHlvdSAgdHJpZWQgMTEx.O5rKAA.dQw4w9WgXcQ_wpV-gGA4PSk_bm8`). Prefix-less bot tokens are [DEPRECATED]
    * @arg {Object} options Eris client options
    * @arg {Object} [options.agent] [DEPRECATED] A HTTPS Agent used to proxy requests. This option has been moved under `options.rest`
    * @arg {Object} [options.allowedMentions] A list of mentions to allow by default in createMessage/editMessage
    * @arg {Boolean} [options.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [options.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [options.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Boolean} [options.allowedMentions.repliedUser] Whether or not to mention the author of the message being replied to
    * @arg {Boolean} [options.autoreconnect=true] Have Eris autoreconnect when connection is lost
    * @arg {Boolean} [options.compress=false] Whether to request WebSocket data to be compressed or not
    * @arg {Number} [options.connectionTimeout=30000] How long in milliseconds to wait for the connection to handshake with the server
    * @arg {String} [options.defaultImageFormat="jpg"] The default format to provide user avatars, guild icons, and group icons in. Can be "jpg", "png", "gif", or "webp"
    * @arg {Number} [options.defaultImageSize=128] The default size to return user avatars, guild icons, banners, splashes, and group icons. Can be any power of two between 16 and 2048. If the height and width are different, the width will be the value specified, and the height relative to that
    * @arg {Object} [options.disableEvents] If disableEvents[eventName] is true, the WS event will not be processed. This can cause significant performance increase on large bots. [A full list of the WS event names can be found on the docs reference page](/Eris/docs/reference#ws-event-names)
    * @arg {Number} [options.firstShardID=0] The ID of the first shard to run for this client
    * @arg {Boolean} [options.getAllUsers=false] Get all the users in every guild. Ready time will be severely delayed
    * @arg {Number} [options.guildCreateTimeout=2000] How long in milliseconds to wait for a GUILD_CREATE before "ready" is fired. Increase this value if you notice missing guilds
    * @arg {Number | Array<String>} [options.intents] A list of intents, or raw bitmask value describing the intents to subscribe to. Some intents, like `guildPresences` and `guildMembers`, must be enabled on your application's page to be used. By default, all non-privileged intents are enabled.
    * @arg {Number} [options.largeThreshold=250] The maximum number of offline users per guild during initial guild data transmission
    * @arg {Number} [options.lastShardID=options.maxShards - 1] The ID of the last shard to run for this client
    * @arg {Number} [options.latencyThreshold=30000] [DEPRECATED] The average request latency at which Eris will start emitting latency errors. This option has been moved under `options.rest`
    * @arg {Number} [options.maxReconnectAttempts=Infinity] The maximum amount of times that the client is allowed to try to reconnect to Discord.
    * @arg {Number} [options.maxResumeAttempts=10] The maximum amount of times a shard can attempt to resume a session before considering that session invalid.
    * @arg {Number | String} [options.maxShards=1] The total number of shards you want to run. If "auto" Eris will use Discord's recommended shard count.
    * @arg {Number} [options.messageLimit=100] The maximum size of a channel message cache
    * @arg {Number} [options.ratelimiterOffset=0] [DEPRECATED] A number of milliseconds to offset the ratelimit timing calculations by. This option has been moved under `options.rest`
    * @arg {Function} [options.reconnectDelay] A function which returns how long the bot should wait until reconnecting to Discord.
    * @arg {Number} [options.requestTimeout=15000] A number of milliseconds before requests are considered timed out. This option will stop affecting REST in a future release; that behavior is [DEPRECATED] and replaced by `options.rest.requestTimeout`
    * @arg {Object} [options.rest] Options for the REST request handler
    * @arg {Object} [options.rest.agent] A HTTPS Agent used to proxy requests
    * @arg {String} [options.rest.baseURL] The base URL to use for API requests. Defaults to `/api/v${REST_VERSION}`
    * @arg {Boolean} [options.rest.decodeReasons=true] [DEPRECATED] Whether reasons should be decoded with `decodeURIComponent()` when making REST requests. This is true by default to mirror pre-0.15.0 behavior (where reasons were expected to be URI-encoded), and should be set to false once your bot code stops. Reasons will no longer be decoded in the future
    * @arg {Boolean} [options.rest.disableLatencyCompensation=false] Whether to disable the built-in latency compensator or not
    * @arg {String} [options.rest.domain="discord.com"] The domain to use for API requests
    * @arg {Number} [options.rest.latencyThreshold=30000] The average request latency at which Eris will start emitting latency errors
    * @arg {Number} [options.rest.ratelimiterOffset=0] A number of milliseconds to offset the ratelimit timing calculations by
    * @arg {Number} [options.rest.requestTimeout=15000] A number of milliseconds before REST requests are considered timed out
    * @arg {Boolean} [options.restMode=false] Whether to enable getting objects over REST. Even with this option enabled, it is recommended that you check the cache first before using REST
    * @arg {Object} [options.ws] An object of WebSocket options to pass to the shard WebSocket constructors
    */
    constructor(token, options) {
        super();

        this.options = Object.assign({
            allowedMentions: {
                users: true,
                roles: true
            },
            autoreconnect: true,
            compress: false,
            connectionTimeout: 30000,
            defaultImageFormat: "jpg",
            defaultImageSize: 128,
            disableEvents: {},
            firstShardID: 0,
            getAllUsers: false,
            guildCreateTimeout: 2000,
            intents: Constants.Intents.allNonPrivileged,
            largeThreshold: 250,
            maxReconnectAttempts: Infinity,
            maxResumeAttempts: 10,
            maxShards: 1,
            opusOnly: false,
            requestTimeout: 15000,
            rest: {},
            restMode: false,
            seedVoiceConnections: false,
            ws: {},
            reconnectDelay: (lastDelay, attempts) => Math.pow(attempts + 1, 0.7) * 20000
        }, options);
        this.options.allowedMentions = this._formatAllowedMentions(this.options.allowedMentions);
        if(this.options.lastShardID === undefined && this.options.maxShards !== "auto") {
            this.options.lastShardID = this.options.maxShards - 1;
        }
        if(typeof window !== "undefined" || !ZlibSync) {
            this.options.compress = false; // zlib does not like Blobs, Pako is not here
        }
        if(!Constants.ImageFormats.includes(this.options.defaultImageFormat.toLowerCase())) {
            throw new TypeError(`Invalid default image format: ${this.options.defaultImageFormat}`);
        }
        const defaultImageSize = this.options.defaultImageSize;
        if(defaultImageSize < Constants.ImageSizeBoundaries.MINIMUM || defaultImageSize > Constants.ImageSizeBoundaries.MAXIMUM || (defaultImageSize & (defaultImageSize - 1))) {
            throw new TypeError(`Invalid default image size: ${defaultImageSize}`);
        }
        // Set HTTP Agent on Websockets if not already set
        if(this.options.agent && !(this.options.ws && this.options.ws.agent)) {
            this.options.ws = this.options.ws || {};
            this.options.ws.agent = this.options.agent;
        }

        if(this.options.hasOwnProperty("intents")) {
            // Resolve intents option to the proper integer
            if(Array.isArray(this.options.intents)) {
                let bitmask = 0;
                for(const intent of this.options.intents) {
                    if(Constants.Intents[intent]) {
                        bitmask |= Constants.Intents[intent];
                    } else {
                        this.emit("warn", `Unknown intent: ${intent}`);
                    }
                }
                this.options.intents = bitmask;
            }

            // Ensure requesting all guild members isn't destined to fail
            if(this.options.getAllUsers && !(this.options.intents & Constants.Intents.guildMembers)) {
                throw new Error("Cannot request all members without guildMembers intent");
            }
        }

        Object.defineProperty(this, "_token", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: token
        });

        this.requestHandler = new RequestHandler(this, this.options.rest);
        delete this.options.rest;

        this.ready = false;
        this.bot = this._token.startsWith("Bot ");
        this.startTime = 0;
        this.lastConnect = 0;
        this.channelGuildMap = {};
        this.shards = new ShardManager(this);
        this.guilds = new Collection(Guild);
        this.guildShardMap = {};
        this.unavailableGuilds = new Collection(UnavailableGuild);
        this.users = new Collection(User);
        this.presence = {
            activities: null,
            afk: false,
            since: null,
            status: "offline"
        };

        this.connect = this.connect.bind(this);
        this.lastReconnectDelay = 0;
        this.reconnectAttempts = 0;
    }

    get uptime() {
        return this.startTime ? Date.now() - this.startTime : 0;
    }

    /**
    * Edits command permissions for a multiple commands in a guild.
    * Note: You can only add up to 10 permission overwrites for a command.
    * @arg {String} guildID The guild id
    * @arg {Array<Object>} permissions An array of [partial guild command permissions](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure)
    * @returns {Promise<Array<Object>>} Returns an array of [GuildApplicationCommandPermissions](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure) objects.
    */
    bulkEditCommandPermissions(guildID, permissions) {
        if(!guildID) {
            throw new Error("You must provide an id of the guild whose permissions you want to edit.");
        }

        return this.requestHandler.request("PUT", Endpoints.GUILD_COMMAND_PERMISSIONS(this.application.id, guildID), true, permissions);
    }

    /**
    * Bulk create/edit global application commands
    * @arg {Array<Object>} commands An array of [Command objects](https://discord.com/developers/docs/interactions/application-commands#application-command-object)
    * @returns {Promise<Array>} Resolves with an array of commands objects
    */
    bulkEditCommands(commands) {
        for(const command of commands) {
            if(command.name !== undefined){
                if(command.type === 1 || command.type === undefined) {
                    command.name = command.name.toLowerCase();
                    if(!command.name.match(/^[\w-]{1,32}$/)) {
                        throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                    }
                }
            }
        }
        return this.requestHandler.request("PUT", Endpoints.COMMANDS(this.application.id), true, commands);
    }

    /**
    * Bulk create/edit guild application commands
    * @arg {String} guildID Guild id to create the commands in
    * @arg {Array<Object>} commands An array of [Command objects](https://discord.com/developers/docs/interactions/application-commands#application-command-object)
    * @returns {Promise<Object>} Resolves with an array of commands objects
    */
    bulkEditGuildCommands(guildID, commands) {
        for(const command of commands) {
            if(command.name !== undefined){
                if(command.type === 1 || command.type === undefined) {
                    command.name = command.name.toLowerCase();
                    if(!command.name.match(/^[\w-]{1,32}$/)) {
                        throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                    }
                }
            }
        }
        return this.requestHandler.request("PUT", Endpoints.GUILD_COMMANDS(this.application.id, guildID), true, commands);
    }

    /**
    * Tells all shards to connect.
    * @returns {Promise} Resolves when all shards are initialized
    */
    async connect() {
        try {
            const data = await (this.options.maxShards === "auto" ? this.getBotGateway() : this.getGateway());
            if(!data.url || (this.options.maxShards === "auto" && !data.shards)) {
                throw new Error("Invalid response from gateway REST call");
            }
            if(data.url.includes("?")) {
                data.url = data.url.substring(0, data.url.indexOf("?"));
            }
            if(!data.url.endsWith("/")) {
                data.url += "/";
            }
            this.gatewayURL = `${data.url}?v=${Constants.GATEWAY_VERSION}&encoding=${Erlpack ? "etf" : "json"}`;

            if(this.options.compress) {
                this.gatewayURL += "&compress=zlib-stream";
            }

            if(this.options.maxShards === "auto") {
                if(!data.shards) {
                    throw new Error("Failed to autoshard due to lack of data from Discord.");
                }
                this.options.maxShards = data.shards;
                if(this.options.lastShardID === undefined) {
                    this.options.lastShardID = data.shards - 1;
                }
            }

            for(let i = this.options.firstShardID; i <= this.options.lastShardID; ++i) {
                this.shards.spawn(i);
            }
        } catch(err) {
            if(!this.options.autoreconnect) {
                throw err;
            }
            const reconnectDelay = this.options.reconnectDelay(this.lastReconnectDelay, this.reconnectAttempts);
            await sleep(reconnectDelay);
            this.lastReconnectDelay = reconnectDelay;
            this.reconnectAttempts = this.reconnectAttempts + 1;
            return this.connect();
        }
    }

    /**
    * Create a channel in a guild
    * @arg {String} guildID The ID of the guild to create the channel in
    * @arg {String} name The name of the channel
    * @arg {String} [type=0] The type of the channel, either 0 (text), 2 (voice), 4 (category), 5 (news), 6 (store), or 13 (stage)
    * @arg {Object | String} [options] The properties the channel should have. If `options` is a string, it will be treated as `options.parentID` (see below). Passing a string is deprecated and will not be supported in future versions.
    * @arg {String?} [options.parentID] The ID of the parent category channel for this channel
    * @arg {Array} [options.permissionOverwrites] An array containing permission overwrite objects
    * @arg {String} [options.reason] The reason to be displayed in audit logs
    * @arg {String} [options.topic] The topic of the channel (text channels only)
    * @returns {Promise<CategoryChannel | TextChannel | VoiceChannel>}
    */
    createChannel(guildID, name, type, reason, options = {}) {
        if(typeof options === "string") { // This used to be parentID, back-compat
            this.emit("warn", "[DEPRECATED] createChannel() was called with a string `options` argument");
            options = {
                parentID: options
            };
        }
        if(typeof reason === "string") { // Reason is deprecated, will be folded into options
            this.emit("warn", "[DEPRECATED] createChannel() was called with a string `reason` argument");
            options.reason = reason;
            reason = undefined;
        } else if(typeof reason === "object" && reason !== null) {
            options = reason;
            reason = undefined;
        }
        return this.requestHandler.request("POST", Endpoints.GUILD_CHANNELS(guildID), true, {
            name: name,
            type: type,
            parent_id: options.parentID,
            permission_overwrites: options.permissionOverwrites,
            reason: options.reason,
            topic: options.topic,
        }).then((channel) => Channel.from(channel, this));
    }

    /**
    * Create a channel webhook
    * @arg {String} channelID The ID of the channel to create the webhook in
    * @arg {Object} options Webhook options
    * @arg {String} options.name The default name
    * @arg {String} [options.avatar] The default avatar as a base64 data URI. Note: base64 strings alone are not base64 data URI strings
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<Object>} Resolves with a webhook object
    */
    createChannelWebhook(channelID, options, reason) {
        options.reason = reason;
        return this.requestHandler.request("POST", Endpoints.CHANNEL_WEBHOOKS(channelID), true, options);
    }

    /**
    * Create a global application command
    * @arg {Object} command A command object
    * @arg {String} command.name The command name
    * @arg {String} [command.description] The command description (Slash Commands Only)
    * @arg {Array<Object>} [command.options] An array of [command options](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)
    * @arg {Number} [type=1] The type of application command, 1 for slash command, 2 for user, and 3 for message
    * @arg {Boolean} [command.defaultPermission=true] Whether the command is enabled by default when the app is added to a guild
    * @returns {Promise<Object>} Resolves with a commands object
    */
    createCommand(command) {
        if(command.name !== undefined){
            if(command.type === 1 || command.type === undefined) {
                command.name = command.name.toLowerCase();
                if(!command.name.match(/^[\w-]{1,32}$/)) {
                    throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                }
            }
        }
        command.default_permission = command.defaultPermission;
        return this.requestHandler.request("POST", Endpoints.COMMANDS(this.application.id), true, command);
    }

    /**
    * Create a guild application command
    * @arg {String} guildID The ID of the guild to create the command in
    * @arg {Object} command A command object
    * @arg {String} command.name The command name
    * @arg {String} [command.description] The command description (Slash Commands Only)
    * @arg {Array<Object>} [command.options] An array of [command options](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)
    * @arg {Number} [type=1] The type of application command, 1 for slash command, 2 for user, and 3 for message
    * @arg {Boolean} [command.defaultPermission] Whether the command is enabled by default when the app is added to a guild
    * @returns {Promise<Object>} Resolves with a commands object
    */
    createGuildCommand(guildID, command) {
        if(command.name !== undefined){
            if(command.type === 1 || command.type === undefined) {
                command.name = command.name.toLowerCase();
                if(!command.name.match(/^[\w-]{1,32}$/)) {
                    throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                }
            }
        }
        command.default_permission = command.defaultPermission;
        return this.requestHandler.request("POST", Endpoints.GUILD_COMMANDS(this.application.id, guildID), true, command);
    }

    /**
    * Respond to the interaction with a message
    * Note: Use webhooks if you have already responded with an interaction response.
    * @arg {String} interactionID The interaction ID.
    * @arg {String} interactionToken The interaction Token.
    * @arg {Object} options The options object.
    * @arg {Object} [options.data] The data to send with the response.
    * @arg {Object} [options.data.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [options.data.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean} [options.data.allowedMentions.repliedUser] Whether or not to mention the author of the message being replied to.
    * @arg {Boolean | Array<String>} [options.data.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [options.data.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Array<Object>} [options.data.components] An array of component objects
    * @arg {String} [options.data.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [options.data.components[].disabled] Whether the component is disabled (type 2 and 3 only)
    * @arg {Object} [options.data.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [options.data.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [options.data.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [options.data.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
    * @arg {Array<Object>} [options.data.components[].options] The options for this component (type 3 only)
    * @arg {Boolean} [options.data.components[].options[].default] Whether this option should be the default value selected
    * @arg {String} [options.data.components[].options[].description] The description for this option
    * @arg {Object} [options.data.components[].options[].emoji] The emoji to be displayed in this option
    * @arg {String} options.data.components[].options[].label The label for this option
    * @arg {Number | String} options.data.components[].options[].value The value for this option
    * @arg {String} [options.data.components[].placeholder] The placeholder text for the component when no option is selected (type 3 only)
    * @arg {Number} [options.data.components[].style] The style of the component (type 2 only) - If 0-4, `custom_id` is required; if 5, `url` is required
    * @arg {Number} options.data.components[].type The type of component - If 1, it is a collection and a `components` array (nested) is required; if 2, it is a button; if 3, it is a select menu
    * @arg {String} [options.data.components[].url] The URL that the component should open for users (type 2 style 5 only)
    * @arg {String} [options.data.content] A content string
    * @arg {Object} [options.data.embed] An embed object. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Array<Object>} [options.data.embeds] An array of embed objects. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Boolean} [options.data.flags] 64 for Ephemeral (applies to Application Commands and Message Components)
    * @arg {Boolean} [options.data.tts] Set the message TTS flag
    * @arg {Number} options.type The response type to send [Check Discord docs for valid responses](https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type).
    * @arg {Object | Array<Object>} [file] A file object (or an Array of them)
    * @arg {Buffer} file.file A buffer containing file data
    * @arg {String} file.name What to name the file
    * @returns {Promise}
    */
    createInteractionResponse(interactionID, interactionToken, options, file) {
        if(options.data && options.data.embed) {
            if(!options.data.embeds) {
                options.data.embeds = [];
            }
            options.data.embeds.push(options.data.embed);
        }
        return this.requestHandler.request("POST", Endpoints.INTERACTION_RESPOND(interactionID, interactionToken), true, options, file, "/interactions/:id/:token/callback");
    }

    /**
    * Create a message in a channel
    * Note: If you want to DM someone, the user ID is **not** the DM channel ID. use Client.getDMChannel() to get the DM channel for a user
    * @arg {String} channelID The ID of the channel
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
    createMessage(channelID, content, file) {
        if(content !== undefined) {
            if(typeof content !== "object" || content === null) {
                content = {
                    content: "" + content
                };
            } else if(content.content !== undefined && typeof content.content !== "string") {
                content.content = "" + content.content;
            } else if(content.embed) {
                if(!content.embeds) {
                    content.embeds = [];
                }
                content.embeds.push(content.embed);
            }
            content.allowed_mentions = this._formatAllowedMentions(content.allowedMentions);
            content.sticker_ids = content.stickerIDs;
        }
        return this.requestHandler.request("POST", Endpoints.CHANNEL_MESSAGES(channelID), true, content, file).then((message) => new Message(message, this));
    }

    /**
    * Delete a guild channel, or leave a private or group channel
    * @arg {String} channelID The ID of the channel
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    deleteChannel(channelID, reason) {
        return this.requestHandler.request("DELETE", Endpoints.CHANNEL(channelID), true, {
            reason
        });
    }

    /**
    * Delete a channel permission overwrite
    * @arg {String} channelID The ID of the channel
    * @arg {String} overwriteID The ID of the overwritten user or role
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    deleteChannelPermission(channelID, overwriteID, reason) {
        return this.requestHandler.request("DELETE", Endpoints.CHANNEL_PERMISSION(channelID, overwriteID), true, {
            reason
        });
    }

    /**
    * Delete a global application command
    * @arg {String} commandID The command id
    * @returns {Promise}
    */
    deleteCommand(commandID) {
        if(!commandID) {
            throw new Error("You must provide an id of the command to delete.");
        }
        return this.requestHandler.request("DELETE", Endpoints.COMMAND(this.application.id, commandID), true);
    }

    /**
    * Delete a guild application command
    * @arg {String} guildID The guild id
    * @arg {String} commandID The command id
    * @returns {Promise}
    */
    deleteGuildCommand(guildID, commandID) {
        if(!guildID) {
            throw new Error("You must provide an id of the guild which the command is in.");
        }
        if(!commandID) {
            throw new Error("You must provide an id of the command to delete.");
        }
        return this.requestHandler.request("DELETE", Endpoints.GUILD_COMMAND(this.application.id, guildID, commandID), true);
    }

    /**
    * Delete a message
    * @arg {String} channelID The ID of the channel
    * @arg {String} messageID The ID of the message
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    deleteMessage(channelID, messageID, reason) {
        return this.requestHandler.request("DELETE", Endpoints.CHANNEL_MESSAGE(channelID, messageID), true, {
            reason
        });
    }

    /**
    * Delete a webhook
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} [token] The token of the webhook, used instead of the Bot Authorization token
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    deleteWebhook(webhookID, token, reason) {
        return this.requestHandler.request("DELETE", token ? Endpoints.WEBHOOK_TOKEN(webhookID, token) : Endpoints.WEBHOOK(webhookID), !token, {
            reason
        });
    }

    /**
    * Delete a webhook message
    * @arg {String} webhookID
    * @arg {String} token
    * @arg {String} messageID
    * @returns {Promise}
    */
    deleteWebhookMessage(webhookID, token, messageID) {
        return this.requestHandler.request("DELETE", Endpoints.WEBHOOK_MESSAGE(webhookID, token, messageID), false);
    }

    /**
    * Disconnects all shards
    * @arg {Object?} [options] Shard disconnect options
    * @arg {String | Boolean} [options.reconnect] false means destroy everything, true means you want to reconnect in the future, "auto" will autoreconnect
    */
    disconnect(options) {
        this.ready = false;
        this.shards.forEach((shard) => {
            shard.disconnect(options);
        });
        this.shards.connectQueue = [];
    }

    /**
    * Edit a channel's properties
    * @arg {String} channelID The ID of the channel
    * @arg {Object} options The properties to edit
    * @arg {String} [options.icon] The icon of the channel as a base64 data URI (group channels only). Note: base64 strings alone are not base64 data URI strings
    * @arg {String} [options.name] The name of the channel
    * @arg {String} [options.ownerID] The ID of the channel owner (group channels only)
    * @arg {String?} [options.parentID] The ID of the parent channel category for this channel (guild text/voice channels only)
    * @arg {String} [options.topic] The topic of the channel (guild text channels only)
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<CategoryChannel | TextChannel | VoiceChannel | NewsChannel>}
    */
    editChannel(channelID, options, reason) {
        return this.requestHandler.request("PATCH", Endpoints.CHANNEL(channelID), true, {
            icon: options.icon,
            name: options.name,
            owner_id: options.ownerID,
            parent_id: options.parentID,
            topic: options.topic,
            reason: reason
        }).then((channel) => Channel.from(channel, this));
    }

    /**
    * Create a channel permission overwrite
    * @arg {String} channelID The ID of channel
    * @arg {String} overwriteID The ID of the overwritten user or role (everyone role ID = guild ID)
    * @arg {BigInt} allow The permissions number for allowed permissions
    * @arg {BigInt} deny The permissions number for denied permissions
    * @arg {Number} type The object type of the overwrite, either 1 for "member" or 0 for "role"
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    editChannelPermission(channelID, overwriteID, allow, deny, type, reason) {
        if(typeof type === "string") { // backward compatibility
            type = type === "member" ? 1 : 0;
        }
        return this.requestHandler.request("PUT", Endpoints.CHANNEL_PERMISSION(channelID, overwriteID), true, {
            allow,
            deny,
            type,
            reason
        });
    }

    /**
    * Edit a guild channel's position. Note that channel position numbers are lowest on top and highest at the bottom.
    * @arg {String} channelID The ID of the channel
    * @arg {Number} position The new position of the channel
    * @arg {Object} [options] Additional options when editing position
    * @arg {Boolean} [options.lockPermissions] Whether to sync the permissions with the new parent if moving to a new category
    * @arg {String} [options.parentID] The new parent ID (category channel) for the channel that is moved
    * @returns {Promise}
    */
    editChannelPosition(channelID, position, options = {}) {
        let guildData = this.guilds.get(this.channelGuildMap[channelID]);
		if (!guildData) {
			return Promise.reject(new Error(`Guild with channel ${channelID} not found`));
		}
		let channels = guildData.channels;
        const channel = channels.get(channelID);
        if(!channel) {
            return Promise.reject(new Error(`Channel ${channelID} not found`));
        }
        if(channel.position === position) {
            return Promise.resolve();
        }
        const min = Math.min(position, channel.position);
        const max = Math.max(position, channel.position);
        channels = channels.filter((chan) => {
            return chan.type === channel.type
                && min <= chan.position
                && chan.position <= max
                && chan.id !== channelID;
        }).sort((a, b) => a.position - b.position);
        if(position > channel.position) {
            channels.push(channel);
        } else {
            channels.unshift(channel);
        }
        return this.requestHandler.request("PATCH", Endpoints.GUILD_CHANNELS(this.channelGuildMap[channelID]), true, channels.map((channel, index) => ({
            id: channel.id,
            position: index + min,
            lock_permissions: options.lockPermissions,
            parent_id: options.parentID
        })));
    }

    /**
    * Edit a global application command
    * @arg {String} commandID The command id
    * @arg {Object} command A command object
    * @arg {String} command.name The command name
    * @arg {String} [command.description] The command description (Slash Commands Only)
    * @arg {Array<Object>} [command.options] An array of [command options](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)
    * @arg {Boolean} [command.defaultPermission] Whether the command is enabled by default when the app is added to a guild
    * @returns {Promise<Object>} Resolves with a commands object
    */
    editCommand(commandID, command) {
        if(!commandID) {
            throw new Error("You must provide an id of the command to edit.");
        }
        if(command.name !== undefined){
            if(command.type === 1 || command.type === undefined) {
                command.name = command.name.toLowerCase();
                if(!command.name.match(/^[\w-]{1,32}$/)) {
                    throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                }
            }
        }
        command.default_permission = command.defaultPermission;
        return this.requestHandler.request("PATCH", Endpoints.COMMAND(this.application.id, commandID), true, command);
    }

    /**
    * Edits command permissions for a specific command in a guild.
    * Note: You can only add up to 10 permission overwrites for a command.
    * @arg {String} guildID The guild id
    * @arg {String} commandID The command id
    * @arg {Array<Object>} permissions An array of [permissions objects](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-application-command-permissions-structure)
    * @returns {Promise<Object>} Resolves with a [GuildApplicationCommandPermissions](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure) object.
    */
    editCommandPermissions(guildID, commandID, permissions) {
        if(!guildID) {
            throw new Error("You must provide an id of the guild whose permissions you want to edit.");
        }
        if(!commandID) {
            throw new Error("You must provide an id of the command whose permissions you want to edit.");
        }
        return this.requestHandler.request("PUT", Endpoints.COMMAND_PERMISSIONS(this.application.id, guildID, commandID), true, {permissions});
    }

    /**
    * Edit a guild application command
    * @arg {String} guildID The guild id
    * @arg {Object} command A command object
    * @arg {String} command.name The command name
    * @arg {String} [command.description] The command description (Slash Commands Only)
    * @arg {Array<Object>} [command.options] An array of [command options](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)
    * @arg {Boolean} [command.defaultPermission] Whether the command is enabled by default when the app is added to a guild
    * @returns {Promise<Object>} Resolves with a commands object
    */
    editGuildCommand(guildID, commandID, command) {
        if(!commandID) {
            throw new Error("You must provide an id of the command to edit.");
        }
        if(command.name !== undefined){
            if(command.type === 1 || command.type === undefined) {
                command.name = command.name.toLowerCase();
                if(!command.name.match(/^[\w-]{1,32}$/)) {
                    throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                }
            }
        }
        command.default_permission = command.defaultPermission;
        return this.requestHandler.request("PATCH", Endpoints.GUILD_COMMAND(this.application.id, guildID, commandID), true, command);
    }

    /**
    * Edit a message
    * @arg {String} channelID The ID of the channel
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
    editMessage(channelID, messageID, content) {
        if(content !== undefined) {
            if(typeof content !== "object" || content === null) {
                content = {
                    content: "" + content
                };
            } else if(content.content !== undefined && typeof content.content !== "string") {
                content.content = "" + content.content;
            } else if(content.embed) {
                if(!content.embeds) {
                    content.embeds = [];
                }
                content.embeds.push(content.embed);
            }
            if(content.content !== undefined || content.embeds || content.allowedMentions) {
                content.allowed_mentions = this._formatAllowedMentions(content.allowedMentions);
            }
        }
        return this.requestHandler.request("PATCH", Endpoints.CHANNEL_MESSAGE(channelID, messageID), true, content, content.file).then((message) => new Message(message, this));
    }

    /**
    * Update the bot's status on all guilds
    * @arg {String} [status] Sets the bot's status, either "online", "idle", "dnd", or "invisible"
    * @arg {Array | Object} [activities] Sets the bot's activities. A single activity object is also accepted for backwards compatibility
    * @arg {String} activities[].name The name of the activity
    * @arg {Number} activities[].type The type of the activity. 0 is playing, 1 is streaming (Twitch only), 2 is listening, 3 is watching, 5 is competing in
    * @arg {String} [activities[].url] The URL of the activity
    */
    editStatus(status, activities) {
        if(activities === undefined && typeof status === "object") {
            activities = status;
            status = undefined;
        }
        if(status) {
            this.presence.status = status;
        }
        if(activities === null) {
            activities = [];
        } else if(activities && !Array.isArray(activities)) {
            activities = [activities];
        }
        if(activities !== undefined) {
            this.presence.activities = activities;
        }

        this.shards.forEach((shard) => {
            shard.editStatus(status, activities);
        });
    }

    /**
    * Edit a webhook
    * @arg {String} webhookID The ID of the webhook
    * @arg {Object} options Webhook options
    * @arg {String} [options.name] The new default name
    * @arg {String} [options.avatar] The new default avatar as a base64 data URI. Note: base64 strings alone are not base64 data URI strings
    * @arg {String} [options.channelID] The new channel ID where webhooks should be sent to
    * @arg {String} [token] The token of the webhook, used instead of the Bot Authorization token
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<Object>} Resolves with a webhook object
    */
    editWebhook(webhookID, options, token, reason) {
        return this.requestHandler.request("PATCH", token ? Endpoints.WEBHOOK_TOKEN(webhookID, token) : Endpoints.WEBHOOK(webhookID), !token, {
            name: options.name,
            avatar: options.avatar,
            channel_id: options.channelID,
            reason: reason
        });
    }

    /**
    * Edit a webhook message
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} token The token of the webhook
    * @arg {String} messageID The ID of the message
    * @arg {Object} options Webhook message edit options
    * @arg {Object} [options.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [options.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean} [options.allowedMentions.repliedUser] Whether or not to mention the author of the message being replied to.
    * @arg {Boolean | Array<String>} [options.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [options.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Array<Object>} [options.components] An array of component objects
    * @arg {String} [options.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [options.components[].disabled] Whether the component is disabled (type 2 and 3 only)
    * @arg {Object} [options.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [options.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [content.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [content.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
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
    * @arg {Buffer} options.file[].file A buffer containing file data
    * @arg {String} options.file[].name What to name the file
    * @returns {Promise<Message>}
    */
    editWebhookMessage(webhookID, token, messageID, options) {
        if(options.allowedMentions) {
            options.allowed_mentions = this._formatAllowedMentions(options.allowedMentions);
        }
        if(options.embed) {
            if(!options.embeds) {
                options.embeds = [];
            }
            options.embeds.push(options.embed);
        }
        return this.requestHandler.request("PATCH", Endpoints.WEBHOOK_MESSAGE(webhookID, token, messageID), false, options, options.file).then((response) => new Message(response, this));
    }

    /**
    * Execute a slack-style webhook
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} token The token of the webhook
    * @arg {Object} options Slack webhook options
    * @arg {Boolean} [options.auth=false] Whether or not to authenticate with the bot token.
    * @arg {Boolean} [options.wait=false] Whether to wait for the server to confirm the message create or not
    * @returns {Promise}
    */
    executeSlackWebhook(webhookID, token, options) {
        const wait = !!options.wait;
        options.wait = undefined;
        const auth = !!options.auth;
        options.auth = undefined;
        let qs = "";
        if(wait) {
            qs += "&wait=true";
        }
        return this.requestHandler.request("POST", Endpoints.WEBHOOK_TOKEN_SLACK(webhookID, token) + (qs ? "?" + qs : ""), auth, options);
    }

    /**
    * Execute a webhook
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} token The token of the webhook
    * @arg {Object} options Webhook execution options
    * @arg {Object} [options.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [options.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [options.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [options.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Boolean} [options.auth=false] Whether or not to authenticate with the bot token.
    * @arg {String} [options.avatarURL] A URL for a custom avatar, defaults to webhook default avatar if not specified
    * @arg {Array<Object>} [options.components] An array of component objects
    * @arg {String} [options.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [options.components[].disabled] Whether the component is disabled (type 2 and 3 only)
    * @arg {Object} [options.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [options.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [content.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [content.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
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
    * @arg {Number} [options.flags] Flags to execute the webhook with, 64 for ephemeral (Interaction webhooks only)
    * @arg {Boolean} [options.tts=false] Whether the message should be a TTS message or not
    * @arg {String} [options.username] A custom username, defaults to webhook default username if not specified
    * @arg {Boolean} [options.wait=false] Whether to wait for the server to confirm the message create or not
    * @returns {Promise<Message?>}
    */
    executeWebhook(webhookID, token, options) {
        let qs = "";
        if(options.wait) {
            qs += "&wait=true";
        }
        if(options.embed) {
            if(!options.embeds) {
                options.embeds = [];
            }
            options.embeds.push(options.embed);
        }
        return this.requestHandler.request("POST", Endpoints.WEBHOOK_TOKEN(webhookID, token) + (qs ? "?" + qs : ""), !!options.auth, {
            content: options.content,
            embeds: options.embeds,
            username: options.username,
            avatar_url: options.avatarURL,
            tts: options.tts,
            flags: options.flags,
            allowed_mentions: this._formatAllowedMentions(options.allowedMentions),
            components: options.components
        }, options.file).then((response) => options.wait ? new Message(response, this) : undefined);
    }

    /**
    * Get general and bot-specific info on connecting to the Discord gateway (e.g. connection ratelimit)
    * @returns {Promise<Object>} Resolves with an object containing gateway connection info
    */
    getBotGateway() {
        if(!this._token.startsWith("Bot ")) {
            this._token = "Bot " + this._token;
        }
        return this.requestHandler.request("GET", Endpoints.GATEWAY_BOT, true);
    }

    /**
    * Get a Channel object from a channel ID
    * @arg {String} channelID The ID of the channel
    * @returns {CategoryChannel | TextChannel | VoiceChannel | NewsChannel}
    */
    getChannel(channelID) {
        if(!channelID) {
            throw new Error(`Invalid channel ID: ${channelID}`);
        }

        if(this.channelGuildMap[channelID] && this.guilds.get(this.channelGuildMap[channelID])) {
            return this.guilds.get(this.channelGuildMap[channelID]).channels.get(channelID);
        }
    }

    /**
    * Get a global application command
    * @arg {String} commandID The command id
    * @returns {Promise<Object>} Resolves with an application command object.
    */
    getCommand(commandID) {
        if(!commandID) {
            throw new Error("You must provide an id of the command to get.");
        }
        return this.requestHandler.request("GET", Endpoints.COMMAND(this.application.id, commandID), true);
    }

    /**
    * Get the a guild's application command permissions
    * @arg {String} guildID The guild id
    * @arg {String} commandID The command id
    * @returns {Promise<Object>} Resolves with a guild application command permissions object.
    */
    getCommandPermissions(guildID, commandID) {
        if(!guildID) {
            throw new Error("You must provide an id of the guild whose permissions you want to get.");
        }
        if(!commandID) {
            throw new Error("You must provide an id of the command whose permissions you want to get.");
        }
        return this.requestHandler.request("GET", Endpoints.COMMAND_PERMISSIONS(this.application.id, guildID, commandID), true);
    }

    /**
    * Get the global application commands
    * @returns {Promise<Array<Object>>} Resolves with an array of application command objects.
    */
    getCommands() {
        return this.requestHandler.request("GET", Endpoints.COMMANDS(this.application.id), true);
    }

    /**
    * Get a guild from the guild's emoji ID
    * @arg {String} emojiID The ID of the emoji
    * @returns {Promise<Guild>}
    */
    getEmojiGuild(emojiID) {
        return this.requestHandler.request("GET", Endpoints.CUSTOM_EMOJI_GUILD(emojiID), true).then((result) => new Guild(result, this));
    }

    /**
    * Get info on connecting to the Discord gateway
    * @returns {Promise<Object>} Resolves with an object containing gateway connection info
    */
    getGateway() {
        return this.requestHandler.request("GET", Endpoints.GATEWAY);
    }

    /**
    * Get a guild application command
    * @arg {String} guildID The guild id
    * @arg {String} commandID The command id
    * @returns {Promise<Object>} Resolves with an command object.
    */
    getGuildCommand(guildID, commandID) {
        if(!commandID) {
            throw new Error("You must provide an id of the command to get.");
        }
        return this.requestHandler.request("GET", Endpoints.GUILD_COMMAND(this.application.id, guildID, commandID), true);
    }

    /**
    * Get the all of a guild's application command permissions
    * @arg {String} guildID The guild id
    * @returns {Promise<Array<Object>>} Resolves with an array of guild application command permissions objects.
    */
    getGuildCommandPermissions(guildID) {
        if(!guildID) {
            throw new Error("You must provide an id of the guild whose permissions you want to get.");
        }
        return this.requestHandler.request("GET", Endpoints.GUILD_COMMAND_PERMISSIONS(this.application.id, guildID), true);
    }

    /**
    * Get a guild's application commands
    * @arg {String} guildID The guild id
    * @returns {Promise<Array<Object>>} Resolves with an array of command objects.
    */
    getGuildCommands(guildID) {
        return this.requestHandler.request("GET", Endpoints.GUILD_COMMANDS(this.application.id, guildID), true);
    }

    /**
    * Get all invites in a guild
    * @arg {String} guildID The ID of the guild
    * @returns {Promise<Array<Invite>>}
    */
    getGuildInvites(guildID) {
        return this.requestHandler.request("GET", Endpoints.GUILD_INVITES(guildID), true).then((invites) => invites.map((invite) => new Invite(invite, this)));
    }

    /**
    * Get all the webhooks in a guild
    * @arg {String} guildID The ID of the guild to get webhooks for
    * @returns {Promise<Array<Object>>} Resolves with an array of webhook objects
    */
    getGuildWebhooks(guildID) {
        return this.requestHandler.request("GET", Endpoints.GUILD_WEBHOOKS(guildID), true);
    }

    /**
    * Get info on an invite
    * @arg {String} inviteID The ID of the invite
    * @arg {Boolean} [withCounts] Whether to fetch additional invite info or not (approximate member counts, approximate presences, channel counts, etc.)
    * @returns {Promise<Invite>}
    */
    getInvite(inviteID, withCounts) {
        return this.requestHandler.request("GET", Endpoints.INVITE(inviteID), true, {
            with_counts: withCounts
        }).then((invite) => new Invite(invite, this));
    }

    /**
    * Get a previous message in a channel
    * @arg {String} channelID The ID of the channel
    * @arg {String} messageID The ID of the message
    * @returns {Promise<Message>}
    */
    getMessage(channelID, messageID) {
        return this.requestHandler.request("GET", Endpoints.CHANNEL_MESSAGE(channelID, messageID), true).then((message) => new Message(message, this));
    }

    /**
    * Get properties of the bot user
    * @returns {Promise<ExtendedUser>}
    */
    getSelf() {
        return this.requestHandler.request("GET", Endpoints.USER("@me"), true).then((data) => new ExtendedUser(data, this));
    }

    /**
    * Get a list of general/guild-specific voice regions
    * @arg {String} [guildID] The ID of the guild
    * @returns {Promise<Array<Object>>} Resolves with an array of voice region objects
    */
    getVoiceRegions(guildID) {
        return guildID ? this.requestHandler.request("GET", Endpoints.GUILD_VOICE_REGIONS(guildID), true) : this.requestHandler.request("GET", Endpoints.VOICE_REGIONS, true);
    }

    /**
    * Get a webhook
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} [token] The token of the webhook, used instead of the Bot Authorization token
    * @returns {Promise<Object>} Resolves with a webhook object
    */
    getWebhook(webhookID, token) {
        return this.requestHandler.request("GET", token ? Endpoints.WEBHOOK_TOKEN(webhookID, token) : Endpoints.WEBHOOK(webhookID), !token);
    }

    /**
    * Get a webhook message
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} token The token of the webhook
    * @arg {String} messageID The message ID of a message sent by this webhook
    * @returns {Promise<Message>} Resolves with a webhook message
    */
    getWebhookMessage(webhookID, token, messageID) {
        return this.requestHandler.request("GET", Endpoints.WEBHOOK_MESSAGE(webhookID, token, messageID)).then((message) => new Message(message, this));
    }

    /**
    * Leave a guild
    * @arg {String} guildID The ID of the guild
    * @returns {Promise}
    */
    leaveGuild(guildID) {
        return this.requestHandler.request("DELETE", Endpoints.USER_GUILD("@me", guildID), true);
    }

    _formatAllowedMentions(allowed) {
        if(!allowed) {
            return this.options.allowedMentions;
        }
        const result = {
            parse: []
        };
        if(allowed.everyone) {
            result.parse.push("everyone");
        }
        if(allowed.roles === true) {
            result.parse.push("roles");
        } else if(Array.isArray(allowed.roles)) {
            if(allowed.roles.length > 100) {
                throw new Error("Allowed role mentions cannot exceed 100.");
            }
            result.roles = allowed.roles;
        }
        if(allowed.users === true) {
            result.parse.push("users");
        } else if(Array.isArray(allowed.users)) {
            if(allowed.users.length > 100) {
                throw new Error("Allowed user mentions cannot exceed 100.");
            }
            result.users = allowed.users;
        }
        if(allowed.repliedUser !== undefined) {
            result.replied_user = allowed.repliedUser;
        }
        return result;
    }

    _formatImage(url, format, size) {
        if(!format || !Constants.ImageFormats.includes(format.toLowerCase())) {
            format = url.includes("/a_") ? "gif" : this.options.defaultImageFormat;
        }
        if(!size || size < Constants.ImageSizeBoundaries.MINIMUM || size > Constants.ImageSizeBoundaries.MAXIMUM || (size & (size - 1))) {
            size = this.options.defaultImageSize;
        }
        return `${Endpoints.CDN_URL}${url}.${format}?size=${size}`;
    }

    toString() {
        return `[Client ${this.user.id}]`;
    }

    toJSON(props = []) {
        return Base.prototype.toJSON.call(this, [
            "application",
            "bot",
            "channelGuildMap",
            "gatewayURL",
            "guilds",
            "guildShardMap",
            "lastConnect",
            "lastReconnectDelay",
            "options",
            "presence",
            "ready",
            "reconnectAttempts",
            "requestHandler",
            "shards",
            "startTime",
            "unavailableGuilds",
            "users",
            ...props
        ]);
    }
}

module.exports = Client;
