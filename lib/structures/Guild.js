"use strict";

const Base = require("./Base");
const Channel = require("./Channel");
const Endpoints = require("../rest/Endpoints");
const Collection = require("../util/Collection");
const GuildChannel = require("./GuildChannel");
const Member = require("./Member");
const Role = require("./Role");
const Permission = require("./Permission");
const {Permissions, ChannelTypes} = require("../Constants");

/**
* Represents a guild
* @prop {Array<Object>?} categories The guild's discovery categories
* @prop {Collection<GuildChannel>} channels Collection of Channels in the guild
* @prop {Number} createdAt Timestamp of the guild's creation
* @prop {Array<Object>} emojis An array of guild emoji objects
* @prop {String?} icon The hash of the guild icon, or null if no icon
* @prop {String?} iconURL The URL of the guild's icon
* @prop {String} id The ID of the guild
* @prop {Number} memberCount Number of members in the guild
* @prop {Collection<Member>} members Collection of Members in the guild
* @prop {String} name The name of the guild
* @prop {String} ownerID The ID of the user that is the guild owner
* @prop {Number?} premiumSubscriptionCount The total number of users currently boosting this guild
* @prop {Number} premiumTier Nitro boost level of the guild
* @prop {Collection<Role>} roles Collection of Roles in the guild
* @prop {Shard} shard The Shard that owns the guild
* @prop {Array<Object>?} stickers An array of guild sticker objects
* @prop {Boolean} unavailable Whether the guild is unavailable or not
*/
class Guild extends Base {
    constructor(data, {client, shardId}) {
        super(data.id);
        this._client = client;
        this.shard = client.shards.get(shardId || (Base.getDiscordEpoch(data.id) % client.options.maxShards));
        this.unavailable = !!data.unavailable;
        this.channels = new Collection(GuildChannel);
        this.members = new Collection(Member);
        this.memberCount = data.member_count;
        this.roles = new Collection(Role);
        this.hasCachedMembers = false;

        if(data.categories !== undefined) {
            this.categories = data.categories;
        }
        if(data.roles) {
            for(const role of data.roles) {
                this.roles.add(role, this);
            }
        }
        if(data.channels) {
            for(const channelData of data.channels) {
                if (![
                    ChannelTypes.GUILD_TEXT,
                    ChannelTypes.GUILD_VOICE,
                    ChannelTypes.GUILD_CATEGORY,
                    ChannelTypes.GUILD_NEWS,
                    ChannelTypes.GUILD_STAGE_VOICE
                ].includes(channelData.type)) continue;

                channelData.guild_id = this.id;
                const channel = Channel.from(channelData, client);
                if(channel) {
                    channel.guild = this;
                    this.channels.add(channel, client);
                }
            }
        }
        if(data.members) {
            // Bot account should always be cache!!!
            const botObject = data.members.find(m => m.user.id === this._client.user.id);

            if(typeof botObject === "undefined") {
                throw new Error("botObject not found in data from guild");
            }

            botObject.id = botObject.user.id;
            this.members.add(botObject, this);
        }

        // Backup count save for cache check
        this.savedCount = {
            original: this.memberCount,
            cache: this.members.size,
            chunk: 0
        }

        this.update(data);
    }

    update(data) {
        if(data.name !== undefined) {
            this.name = data.name;
        }
        if(data.owner_id !== undefined) {
            this.ownerID = data.owner_id;
        }
        if(data.icon !== undefined) {
            this.icon = data.icon;
        }
        if(data.features !== undefined) {
            this.isCommunity = data.features.includes("COMMUNITY");
        }
        if(data.emojis !== undefined) {
            const animated = data.emojis.filter((e) => e.animated).length;
            this.emojis = {
                static: data.emojis.length - animated,
                animated: animated
            }
        }
        if(data.stickers !== undefined) {
            this.stickers = data.stickers.length;
        }
        if(data.premium_tier !== undefined) {
            this.premiumTier = data.premium_tier;
        }
        if(data.premium_subscription_count !== undefined) {
            this.premiumSubscriptionCount = data.premium_subscription_count;
        }
    }

    get iconURL() {
        return this.icon ? this._client._formatImage(Endpoints.GUILD_ICON(this.id, this.icon)) : null;
    }

    /**
    * Edits command permissions for a multiple commands in a guild.
    * Note: You can only add up to 10 permission overwrites for a command.
    * @arg {Array<Object>} permissions An array of [partial guild command permissions](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure)
    * @returns {Promise<Array<Object>>} Returns an array of [GuildApplicationCommandPermissions](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure) objects.
    */
    bulkEditCommandPermissions(permissions) {
        return this._client.bulkEditCommandPermissions.call(this._client, this.id, permissions);
    }

    /**
    * Bulk create/edit guild application commands
    * @arg {Array<Object>} commands An array of [Command objects](https://discord.com/developers/docs/interactions/application-commands#application-command-object)
    * @returns {Promise<Object>} Resolves with a commands object
    */
    bulkEditCommands(commands) {
        return this._client.bulkEditGuildCommands.call(this._client, this.id, commands);
    }

    /**
    * Create a channel in the guild
    * @arg {String} name The name of the channel
    * @arg {Number} [type=0] The type of the channel, either 0 (text), 2 (voice), 4 (category), 5 (news) or 13 (stage)
    * @arg {Object | String} [options] The properties the channel should have. If `options` is a string, it will be treated as `options.parentID` (see below). Passing a string is deprecated and will not be supported in future versions.
    * @arg {String?} [options.parentID] The ID of the parent category channel for this channel
    * @arg {Array} [options.permissionOverwrites] An array containing permission overwrite objects
    * @arg {String} [options.reason] The reason to be displayed in audit logs
    * @returns {Promise<CategoryChannel | TextChannel | VoiceChannel>}
    */
    createChannel(name, type, reason, options) {
        return this._client.createChannel.call(this._client, this.id, name, type, reason, options);
    }

    /**
    * Create a guild application command
    * @arg {Object} command A command object
    * @arg {String} command.name The command name
    * @arg {String} [command.description] The command description (Slash Commands Only)
    * @arg {Array<Object>} [command.options] An array of [command options](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)
    * @arg {Number} [type=1] The type of application command, 1 for slash command, 2 for user, and 3 for message
    * @arg {Boolean} [command.defaultPermission] Whether the command is enabled by default when the app is added to a guild
    * @returns {Promise<Object>} Resolves with a command object
    */
    createCommand(command) {
        return this._client.createGuildCommand.call(this._client, this.id, command);
    }

    /**
    * Delete a guild application command
    * @arg {String} commandID The command id
    * @returns {Promise} Resolves with a promise object
    */
    deleteCommand(commandID) {
        return this._client.deleteGuildCommand.call(this._client, this.id, commandID);
    }

    /**
    * Edit a guild application command
    * @arg {String} commandID The command id
    * @arg {Object} command A command object
    * @arg {String} command.name The command name
    * @arg {String} [command.description] The command description (Slash Commands Only)
    * @arg {Array<Object>} [command.options] An array of [command options](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)
    * @arg {Boolean} [command.defaultPermission] Whether the command is enabled by default when the app is added to a guild
    * @returns {Promise<Object>} Resolves with a command object
    */
    editCommand(commandID, commands) {
        return this._client.editGuildCommand.call(this._client, this.id, commandID, commands);
    }

    /**
    * Edits command permissions for a specific command in a guild.
    * Note: You can only add up to 10 permission overwrites for a command.
    * @arg {String} commandID The command id
    * @arg {Array<Object>} permissions An array of [permissions objects](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-application-command-permissions-structure)
    * @returns {Promise<Object>} Resolves with a [GuildApplicationCommandPermissions](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure) object.
    */
    editCommandPermissions(commandID, permissions) {
        return this._client.getCommandPermissions.call(this._client, this.id, commandID, permissions);
    }

    /**
    * Request all guild members from Discord
    * @arg {Number} [timeout] The number of milliseconds to wait before resolving early. Defaults to the `requestTimeout` client option
    * @returns {Promise<Number>} Resolves with the total number of fetched members.
    */
    fetchAllMembers(timeout, reason) {
        return this.fetchMembers({
            timeout: timeout || 18000
        }, reason).then((m) => {
            this.hasCachedMembers = true;
            return m.length;
        });
    }

    /**
    * Clear all guild members currently in cache
    * @returns {Promise<Number>} Total number of members in the new cache.
    */
    clearAllMembers() {
        // Bot account should always be cache!!!
        const botObject = this.members.get(this._client.user.id);
        this.members.forEach((m) => {
            if(m.user && !m.user.bot) {
                m.user.removeGuild(this.id);
            }
        });

        const newCount = this.members.wipe(botObject);
        if (newCount <= 1) {
            this.savedCount.cache = newCount;
            this.savedCount.chunk = newCount;
            this.hasCachedMembers = false;
        }

        return newCount;
    }

    /**
    * Request specific guild members through the gateway connection
    * @arg {Object} [options] Options for fetching the members
    * @arg {Number} [options.limit] The maximum number of members to fetch
    * @arg {String} [options.query] The query used for looking up the members. When using intents, `GUILD_MEMBERS` is required to fetch all members.
    * @arg {Number} [options.timeout] The number of milliseconds to wait before resolving early. Defaults to the `requestTimeout` client option
    * @arg {Array<String>} [options.userIDs] The IDs of members to fetch
    * @returns {Promise<Array<Member>>} Resolves with the fetched members.
    */
    fetchMembers(options, reason) {
        if(!reason) {
            reason = "Unknown";
        }

        if(this._client.stats) {
            if(!this._client.stats.fetchReason) this._client.stats.fetchReason = {};

            if(!this._client.stats.fetchReason[reason]) {
                this._client.stats.fetchReason[reason] = 1;
            } else {
                this._client.stats.fetchReason[reason]++;
            }
        }

        return this.shard.requestGuildMembers(this.id, options);
    }

    /**
    * Get a guild application command
    * @arg {String} commandID The command id
    * @returns {Promise<Object>} Resolves with a command object
    */
    getCommand(commandID) {
        return this._client.getGuildCommand.call(this._client, this.id, commandID);
    }

    /**
    * Get the a guild's application command permissions
    * @arg {String} commandID The command id
    * @returns {Promise<Object>} Resolves with a guild application command permissions object.
    */
    getCommandPermissions(commandID) {
        return this._client.getCommandPermissions.call(this._client, this.id, commandID);
    }

    /**
    * Get the guild's application commands
    * @returns {Promise<Array<Object>>} Resolves with an array of command objects
    */
    getCommands() {
        return this._client.getGuildCommands.call(this._client, this.id);
    }

    /**
    * Get the all of a guild's application command permissions
    * @returns {Promise<Array<Object>>} Resolves with an array of guild application command permissions objects.
    */
    getGuildCommandPermissions() {
        return this._client.getGuildCommandPermissions.call(this._client, this.id);
    }

    /**
    * Leave the guild
    * @returns {Promise}
    */
    leave() {
        return this._client.leaveGuild.call(this._client, this.id);
    }

    /**
    * Get the guild permissions of a member
    * @arg {String | Member | Object} memberID The ID of the member or a Member object
    * @returns {Permission}
    */
    permissionsOf(memberID) {
        const member = memberID instanceof Object ? memberID : this.members.get(memberID);
        if(member.id === this.ownerID) {
            return new Permission(Permissions.all);
        } else {
            let permissions = this.roles.get(this.id).permissions.allow;
            if(permissions & Permissions.administrator) {
                return new Permission(Permissions.all);
            }
            for(let role of member.roles) {
                role = this.roles.get(role);
                if(!role) {
                    continue;
                }

                const {allow: perm} = role.permissions;
                if(perm & Permissions.administrator) {
                    permissions = Permissions.all;
                    break;
                } else {
                    permissions |= perm;
                }
            }
            return new Permission(permissions);
        }
    }

    toJSON(props = []) {
        return super.toJSON([
            "categories",
            "channels",
            "emojis",
            "icon",
            "memberCount",
            "members",
            "name",
            "ownerID",
            "premiumSubscriptionCount",
            "premiumTier",
            "roles",
            "stickers",
            "unavailable",
            ...props
        ]);
    }
}

module.exports = Guild;
