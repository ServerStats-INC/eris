"use strict";

const util = require("util");
const Base = require("../structures/Base");
const Bucket = require("../util/Bucket");
const Channel = require("../structures/Channel");
const GuildChannel = require("../structures/GuildChannel");
const {GATEWAY_VERSION, GatewayOPCodes} = require("../Constants");
const ExtendedUser = require("../structures/ExtendedUser");
const User = require("../structures/User");
const Invite = require("../structures/Invite");
const Interaction = require("../structures/Interaction");
const Constants = require("../Constants");

const WebSocket = require("ws");

let EventEmitter;
try {
    EventEmitter = require("eventemitter3");
} catch(err) {
    EventEmitter = require("events").EventEmitter;
}

/**
* Represents a shard
* @extends EventEmitter
* @prop {Number} id The ID of the shard
* @prop {Boolean} connecting Whether the shard is connecting
* @prop {Array<String>?} discordServerTrace Debug trace of Discord servers
* @prop {Number} lastHeartbeatReceived Last time Discord acknowledged a heartbeat, null if shard has not sent heartbeat yet
* @prop {Number} lastHeartbeatSent Last time shard sent a heartbeat, null if shard has not sent heartbeat yet
* @prop {Number} latency The current latency between the shard and Discord, in milliseconds
* @prop {Boolean} ready Whether the shard is ready
* @prop {String} status The status of the shard. "disconnected"/"connecting"/"handshaking"/"ready"/"identifying"/"resuming"
*/
class Shard extends EventEmitter {
    constructor(id, client) {
        super();

        this.id = id;
        this.client = client;

        this.onPacket = this.onPacket.bind(this);
        this._onWSOpen = this._onWSOpen.bind(this);
        this._onWSMessage = this._onWSMessage.bind(this);
        this._onWSError = this._onWSError.bind(this);
        this._onWSClose = this._onWSClose.bind(this);

        this.hardReset();
    }

    get commandTokens() {
        let remaining = this.globalBucket.tokenLimit - this.globalBucket.reservedTokens - this.globalBucket.tokens;
        let queued = remaining == 0 ? this.globalBucket.queue.length : 0;

        return {remaining, queued};
    }

    checkReady() {
        if(!this.ready) {
            if(this.guildSyncQueue.length > 0) {
                this.requestGuildSync(this.guildSyncQueue);
                this.guildSyncQueue = [];
                this.guildSyncQueueLength = 1;
                return;
            }
            if(this.unsyncedGuilds > 0) {
                return;
            }
            if(this.getAllUsersQueue.length > 0) {
                this.requestGuildMembers(this.getAllUsersQueue);
                this.getAllUsersQueue = [];
                this.getAllUsersLength = 1;
                return;
            }
            if(Object.keys(this.getAllUsersCount).length === 0) {
                this.ready = true;
                /**
                * Fired when the shard turns ready
                * @event Shard#ready
                */
                super.emit("ready");
            }
        }
    }

    /**
    * Tells the shard to connect
    */
    connect() {
        if(this.ws && this.ws.readyState != WebSocket.CLOSED) {
            this.emit("error", new Error("Existing connection detected"), this.id);
            return;
        }
        ++this.connectAttempts;
        this.connecting = true;
        return this.initializeWS();
    }

    createGuild(_guild) {
        const guild = this.client.guilds.add(_guild, {client: this.client, shardId: this.id}, true);
        if(this.client.bot === false) {
            ++this.unsyncedGuilds;
            this.syncGuild(guild.id);
        }
        return guild;
    }

    /**
    * Disconnects the shard
    * @arg {Object?} [options] Shard disconnect options
    * @arg {String | Boolean} [options.reconnect] false means destroy everything, true means you want to reconnect in the future, "auto" will autoreconnect
    * @arg {Error} [error] The error that causes the disconnect
    */
    disconnect(options = {}, error) {
        if(!this.ws) {
            return;
        }

        if(this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if(this.ws.readyState !== WebSocket.CLOSED) {
            this.ws.removeListener("close", this._onWSClose);
            try {
                if(options.reconnect && this.sessionID) {
                    if(this.ws.readyState === WebSocket.OPEN) {
                        this.ws.close(4901, "Eris: reconnect");
                    } else {
                        this.emit("debug", `Terminating websocket (state: ${this.ws.readyState})`, this.id);
                        this.ws.terminate();
                    }
                } else {
                    this.ws.close(1000, "Eris: normal");
                }
            } catch(err) {
                this.emit("error", err, this.id);
            }
        }
        this.ws = null;
        this.reset();

        if(error) {
            if(error.code !== 1006) {
                this.emit("error", error, this.id);
            }
        }

        /**
        * Fired when the shard disconnects
        * @event Shard#disconnect
        * @prop {Error?} err The error, if any
        */
        super.emit("disconnect", error);

        if(this.sessionID && this.connectAttempts >= this.client.options.maxResumeAttempts) {
            this.emit("debug", `Automatically invalidating session due to excessive resume attempts | Attempt ${this.connectAttempts}`, this.id);
            this.sessionID = null;
            this.resumeURL = null;
        }

        if(options.reconnect === "auto" && this.client.options.autoreconnect) {
            /**
            * Fired when stuff happens and gives more info
            * @event Client#debug
            * @prop {String} message The debug message
            * @prop {Number} id The ID of the shard
            */
            if(this.sessionID) {
                this.emit("debug", `Immediately reconnecting for potential resume | Attempt ${this.connectAttempts}`, this.id);
                this.client.shards.connect(this);
            } else {
                this.emit("debug", `Queueing reconnect in ${this.reconnectInterval}ms | Attempt ${this.connectAttempts}`, this.id);
                setTimeout(() => {
                    this.client.shards.connect(this);
                }, this.reconnectInterval);
                this.reconnectInterval = Math.min(Math.round(this.reconnectInterval * (Math.random() * 2 + 1)), 30000);
            }
        } else if(!options.reconnect) {
            this.hardReset();
        }
    }

    /**
    * Update the bot's AFK status.
    * @arg {Boolean} afk Whether the bot user is AFK or not
    */
    editAFK(afk) {
        this.presence.afk = !!afk;

        this.sendStatusUpdate();
    }

    /**
    * Updates the bot's status on all guilds the shard is in
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
            if(activities.length > 0 && !activities[0].hasOwnProperty("type")) {
                activities[0].type = activities[0].url ? 1 : 0;
            }
            this.presence.activities = activities;
        }

        this.sendStatusUpdate();
    }

    emit(event, ...args) {
        this.client.emit.call(this.client, event, ...args);
        if(event !== "error" || this.listeners("error").length > 0) {
            super.emit.call(this, event, ...args);
        }
    }

    hardReset() {
        this.reset();
        this.seq = 0;
        this.sessionID = null;
        this.resumeURL = null;
        this.reconnectInterval = 1000;
        this.connectAttempts = 0;
        this.ws = null;
        this.heartbeatInterval = null;
        this.guildCreateTimeout = null;
        this.globalBucket = new Bucket(120, 60000, {reservedTokens: 5});
        this.presenceUpdateBucket = new Bucket(5, 60000);
        this.presence = JSON.parse(JSON.stringify(this.client.presence)); // Fast copy
        Object.defineProperty(this, "_token", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: this.client._token
        });
    }

    heartbeat(normal) {
        // Can only heartbeat after identify/resume succeeds, session will be killed otherwise, discord/discord-api-docs#1619
        if(this.status === "resuming" || this.status === "identifying") {
            return;
        }
        if(normal) {
            if(!this.lastHeartbeatAck) {
                this.emit("debug", "Heartbeat timeout; " + JSON.stringify({
                    lastReceived: this.lastHeartbeatReceived,
                    lastSent: this.lastHeartbeatSent,
                    interval: this.heartbeatInterval,
                    status: this.status,
                    timestamp: Date.now()
                }));
                return this.disconnect({
                    reconnect: "auto"
                }, new Error("Server didn't acknowledge previous heartbeat, possible lost connection"));
            }
            this.lastHeartbeatAck = false;
        }
        this.lastHeartbeatSent = Date.now();
        this.sendWS(GatewayOPCodes.HEARTBEAT, this.seq, true);
    }

    async identify() {
        this.status = "identifying";
        await this.client.shards.redis.lock(this.id, 5000).catch((e) => console.error(`[Shard ${this.id}] Failed to acquire lock: ${e.message}`));
        const identify = {
            token: this._token,
            v: GATEWAY_VERSION,
            compress: false,
            large_threshold: this.client.options.largeThreshold,
            intents: this.client.options.intents,
            properties: {
                "os": process.platform,
                "browser": "Eris",
                "device": "Eris"
            }
        };
        if(this.client.options.maxShards > 1) {
            identify.shard = [this.id, this.client.options.maxShards];
        }
        if(this.presence.status) {
            identify.presence = this.presence;
        }
        this.sendWS(GatewayOPCodes.IDENTIFY, identify);
    }

    initializeWS() {
        if(!this._token) {
            return this.disconnect(null, new Error("Token not specified"));
        }

        this.status = "connecting";
        if(this.sessionID) {
            if(!this.resumeURL) {
                this.emit("warn", "Resume url is not currently present. Discord may disconnect you quicker.");
            }
            this.ws = new WebSocket(this.resumeURL || this.client.gatewayURL, this.client.options.ws);
        } else {
            this.ws = new WebSocket(this.client.gatewayURL, this.client.options.ws);
        }
        this.ws.on("open", this._onWSOpen);
        this.ws.on("message", this._onWSMessage);
        this.ws.on("error", this._onWSError);
        this.ws.on("close", this._onWSClose);

        this.connectTimeout = setTimeout(() => {
            if(this.connecting) {
                this.disconnect({
                    reconnect: "auto"
                }, new Error("Connection timeout"));
            }
        }, this.client.options.connectionTimeout);
    }

    onPacket(packet) {
        if(packet.s) {
            if(packet.s > this.seq + 1 && this.ws && this.status !== "resuming") {
                /**
                * Fired to warn of something weird but non-breaking happening
                * @event Client#warn
                * @prop {String} message The warning message
                * @prop {Number} id The ID of the shard
                */
                if(this.client.stats) {
                    this.client.stats.eventMisses += Math.max(0, packet.s - this.seq);
                }

                this.emit("warn", `Non-consecutive sequence (${this.seq} -> ${packet.s})`, this.id);
            }
            this.seq = packet.s;
        }

        switch(packet.op) {
            case GatewayOPCodes.DISPATCH: {
                if(!this.client.options.enabledEvents.includes(packet.t)) {
                    break;
                }

                if(this.client.stats) {
                    if(!this.client.stats.dispatchs[packet.t]) {
                        this.client.stats.dispatchs[packet.t] = 1;
                    } else {
                        this.client.stats.dispatchs[packet.t]++;
                    }
                }
                
                this.wsEvent(packet);
                break;
            }
            case GatewayOPCodes.HEARTBEAT: {
                this.heartbeat();
                break;
            }
            case GatewayOPCodes.INVALID_SESSION: {
                this.emit("warn", "Invalid session, reidentifying!", this.id);

                if(packet.d === true && this.sessionID) {
                    return this.resume();
                }

                this.seq = 0;
                this.sessionID = null;
                this.resumeURL = null;
                this.disconnect({
                    reconnect: "auto"
                });
                break;
            }
            case GatewayOPCodes.RECONNECT: {
                this.emit("debug", "Reconnecting due to server request", this.id);
                this.disconnect({
                    reconnect: "auto"
                });
                break;
            }
            case GatewayOPCodes.HELLO: {
                if(packet.d.heartbeat_interval > 0) {
                    if(this.heartbeatInterval) {
                        clearInterval(this.heartbeatInterval);
                    }
                    setTimeout(() => {
                        this.heartbeat(true);
                        if(this.heartbeatInterval == null) {
                            this.heartbeatInterval = setInterval(() => {
                                this.heartbeat(true);
                            }, packet.d.heartbeat_interval);
                        }
                    }, packet.d.heartbeat_interval * Math.random());
                }

                this.discordServerTrace = packet.d._trace;
                this.connecting = false;
                if(this.connectTimeout) {
                    clearTimeout(this.connectTimeout);
                }
                this.connectTimeout = null;

                if(this.sessionID) {
                    this.resume();
                } else {
                    this.identify();
                    // Cannot heartbeat when resuming, discord/discord-api-docs#1619
                    this.heartbeat();
                }
                /**
                * Fired when a shard receives an OP:10/HELLO packet
                * @event Client#hello
                * @prop {Array<String>} trace The Discord server trace of the gateway and session servers
                * @prop {Number} id The ID of the shard
                */
                this.emit("hello", packet.d._trace, this.id);
                break; /* eslint-enable no-unreachable */
            }
            case GatewayOPCodes.HEARTBEAT_ACK: {
                this.lastHeartbeatAck = true;
                this.lastHeartbeatReceived = Date.now();
                this.latency = this.lastHeartbeatReceived - this.lastHeartbeatSent;
                break;
            }
            default: {
                this.emit("unknown", packet, this.id);
                break;
            }
        }
    }

    requestGuildMembers(guildID, options) {
        const opts = {
            guild_id: guildID,
            limit: (options && options.limit) || 0,
            user_ids: options && options.userIDs,
            query: options && options.query,
            nonce: Date.now().toString() + Math.random().toString(36),
            presences: false
        };
        if(!opts.user_ids && !opts.query) {
            opts.query = "";
        }
        if(!opts.query && !opts.user_ids && (this.client.options.intents && !(this.client.options.intents & Constants.Intents.guildMembers))) {
            throw new Error("Cannot request all members without guildMembers intent");
        }
        if(opts.user_ids && opts.user_ids.length > 100) {
            throw new Error("Cannot request more than 100 users by their ID");
        }
        this.sendWS(GatewayOPCodes.REQUEST_GUILD_MEMBERS, opts);
        return new Promise((res) => this.requestMembersPromise[opts.nonce] = {
            res: res,
            received: 0,
            members: [],
            timeout: setTimeout(() => {
                res(this.requestMembersPromise[opts.nonce].members);
                delete this.requestMembersPromise[opts.nonce];
            }, (options && options.timeout) || this.client.options.requestTimeout)
        });
    }

    requestGuildSync(guildID) {
        this.sendWS(GatewayOPCodes.SYNC_GUILD, guildID);
    }

    reset() {
        this.connecting = false;
        this.ready = false;
        this.preReady = false;
        if(this.requestMembersPromise !== undefined) {
            for(const guildID in this.requestMembersPromise) {
                if(!this.requestMembersPromise.hasOwnProperty(guildID)) {
                    continue;
                }
                clearTimeout(this.requestMembersPromise[guildID].timeout);
                this.requestMembersPromise[guildID].res(this.requestMembersPromise[guildID].received);
            }
        }
        this.requestMembersPromise = {};
        this.getAllUsersCount = {};
        this.getAllUsersQueue = [];
        this.getAllUsersLength = 1;
        this.guildSyncQueue = [];
        this.guildSyncQueueLength = 1;
        this.unsyncedGuilds = 0;
        this.latency = Infinity;
        this.lastHeartbeatAck = true;
        this.lastHeartbeatReceived = null;
        this.lastHeartbeatSent = null;
        this.status = "disconnected";
        if(this.connectTimeout) {
            clearTimeout(this.connectTimeout);
        }
        this.connectTimeout = null;
    }

    restartGuildCreateTimeout() {
        if(this.guildCreateTimeout) {
            clearTimeout(this.guildCreateTimeout);
            this.guildCreateTimeout = null;
        }
        if(!this.ready) {
            if(this.client.unavailableGuilds.size === 0 && this.unsyncedGuilds === 0) {
                return this.checkReady();
            }
            this.guildCreateTimeout = setTimeout(() => {
                this.checkReady();
            }, this.client.options.guildCreateTimeout);
        }
    }

    resume() {
        this.status = "resuming";
        this.sendWS(GatewayOPCodes.RESUME, {
            token: this._token,
            session_id: this.sessionID,
            seq: this.seq
        });
    }

    sendStatusUpdate() {
        this.sendWS(GatewayOPCodes.PRESENCE_UPDATE, {
            activities: this.presence.activities,
            afk: !!this.presence.afk, // For push notifications
            since: this.presence.status === "idle" ? Date.now() : 0,
            status: this.presence.status
        });
    }

    sendWS(op, _data, priority = false) {
        if(this.ws && this.ws.readyState === WebSocket.OPEN) {
            let i = 0;
            let waitFor = 1;
            const func = () => {
                if(++i >= waitFor && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    const data = JSON.stringify({op: op, d: _data});
                    this.ws.send(data);
                    if(_data.token) {
                        delete _data.token;
                    }
                    this.emit("debug", JSON.stringify({op: op, d: _data}), this.id);
                }
            };
            if(op === GatewayOPCodes.PRESENCE_UPDATE) {
                ++waitFor;
                this.presenceUpdateBucket.queue(func, priority);
            }
            this.globalBucket.queue(func, priority);
        }
    }

    syncGuild(guildID) {
        if(this.guildSyncQueueLength + 3 + guildID.length > 4081) { // 4096 - "{\"op\":12,\"d\":[]}".length + 1 for lazy comma offset
            this.requestGuildSync(this.guildSyncQueue);
            this.guildSyncQueue = [guildID];
            this.guildSyncQueueLength = 1 + guildID.length + 3;
        } else if(this.ready) {
            this.requestGuildSync([guildID]);
        } else {
            this.guildSyncQueue.push(guildID);
            this.guildSyncQueueLength += guildID.length + 3;
        }
    }

    wsEvent(packet) {
        switch(packet.t) { /* eslint-disable no-redeclare */ // (╯°□°）╯︵ ┻━┻
            case "GUILD_MEMBER_ADD": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) { // Eventual Consistency™ (╯°□°）╯︵ ┻━┻
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in GUILD_MEMBER_ADD`);
                    break;
                }
                packet.d.id = packet.d.user.id;
                ++guild.memberCount;
                ++guild.savedCount.original;
                /**
                * Fired when a member joins a server
                * @event Client#guildMemberAdd
                * @prop {Guild} guild The guild
                * @prop {Member} member The member
                */
                if(guild.hasCachedMembers || packet.d.user.id === this.client.user.id) {
                    this.emit("guildMemberAdd", guild, guild.members.add(packet.d, guild));
                } else {
                    this.emit("guildMemberAdd", guild, packet.d);
                }
                break;
            }
            case "GUILD_MEMBER_UPDATE": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in GUILD_MEMBER_UPDATE`);
                    break;
                }
                let member = guild.members.get(packet.d.id = packet.d.user.id);
                let oldMember = null;
                if(member) {
                    oldMember = {
                        avatar: member.avatar,
                        roles: member.roles,
                        nick: member.nick,
                        premiumSince: member.premiumSince,
                        pending: member.pending
                    };
                }

                if(guild.hasCachedMembers || packet.d.user.id === this.client.user.id) {
                    member = guild.members.update(packet.d, guild);
                } else {
                    packet.d.id = packet.d.user.id;
                    member = packet.d;
                }                
                /**
                * Fired when a member's guild avatar, roles or nickname are updated or they start boosting a server
                * @event Client#guildMemberUpdate
                * @prop {Guild} guild The guild
                * @prop {Member} member The updated member
                * @prop {Object?} oldMember The old member data, or null if the member wasn't cached
                * @prop {String?} oldMember.avatar The hash of the member's guild avatar, or null if no guild avatar
                * @prop {Array<String>} oldMember.roles An array of role IDs this member is a part of
                * @prop {String?} oldMember.nick The server nickname of the member
                * @prop {Number} oldMember.premiumSince Timestamp of when the member boosted the guild
                * @prop {Boolean?} oldMember.pending Whether the member has passed the guild's Membership Screening requirements
                */
                this.emit("guildMemberUpdate", guild, member, oldMember);
                break;
            }
            case "GUILD_MEMBER_REMOVE": {
                if(packet.d.user.id === this.client.user.id) { // The bot is probably leaving
                    break;
                }
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    break;
                }
                --guild.memberCount;
                --guild.savedCount.original;
                packet.d.id = packet.d.user.id;

                const user = this.client.users.get(packet.d.id);
                if(user) {
                    user.removeGuild(packet.d.guild_id);
                }

                /**
                * Fired when a member leaves a server
                * @event Client#guildMemberRemove
                * @prop {Guild} guild The guild
                * @prop {Member | Object} member The member. If the member is not cached, this will be an object with `id` and `user` key
                */

                this.emit("guildMemberRemove", guild, guild.members.remove(packet.d) || packet.d);
                break;
            }
            case "GUILD_CREATE": {
                if(!packet.d.unavailable) {
                    const guild = this.createGuild(packet.d);
                    if(this.ready) {
                        if(this.client.unavailableGuilds.remove(packet.d)) {
                            /**
                            * Fired when a guild becomes available
                            * @event Client#guildAvailable
                            * @prop {Guild} guild The guild
                            */
                            this.emit("guildAvailable", guild);
                        } else {
                            /**
                            * Fired when a guild is created. This happens when:
                            * - the client creates a guild
                            * - the client joins a guild
                            * @event Client#guildCreate
                            * @prop {Guild} guild The guild
                            */
                            this.emit("guildCreate", guild);
                        }
                    } else {
                        this.client.unavailableGuilds.remove(packet.d);
                        this.restartGuildCreateTimeout();
                    }
                } else {
                    this.client.guilds.remove(packet.d);
                    /**
                    * Fired when an unavailable guild is created
                    * @event Client#unavailableGuildCreate
                    * @prop {UnavailableGuild} guild The unavailable guild
                    */
                    this.emit("unavailableGuildCreate", this.client.unavailableGuilds.add(packet.d, {client: this.client, shardId: this.id}));
                }
                break;
            }
            case "GUILD_UPDATE": {
                const guild = this.client.guilds.get(packet.d.id);
                if(!guild) {
                    this.emit("debug", `Guild ${packet.d.id} undefined in GUILD_UPDATE`);
                    break;
                }
                const oldGuild = {
                    emojis: guild.emojis,
                    features: guild.features,
                    icon: guild.icon,
                    large: guild.large,
                    name: guild.name,
                    ownerID: guild.ownerID,
                    premiumSubscriptionCount: guild.premiumSubscriptionCount,
                    premiumTier: guild.premiumTier,
                    stickers: guild.stickers,
                };
                /**
                * Fired when a guild is updated
                * @event Client#guildUpdate
                * @prop {Guild} guild The guild
                * @prop {Object} oldGuild The old guild data
                * @prop {Array<Object>} oldGuild.emojis An array of guild emojis
                * @prop {Array<String>} oldGuild.features An array of guild features
                * @prop {String?} oldGuild.icon The hash of the guild icon, or null if no icon
                * @prop {Boolean} oldGuild.large Whether the guild is "large" by "some Discord standard"
                * @prop {String} oldGuild.name The name of the guild
                * @prop {String} oldGuild.ownerID The ID of the user that is the guild owner
                * @prop {Number?} oldGuild.premiumSubscriptionCount The total number of users currently boosting this guild
                * @prop {Number} oldGuild.premiumTier Nitro boost level of the guild
                * @prop {Array<Object>?} stickers An array of guild sticker objects
                */
                this.emit("guildUpdate", this.client.guilds.update(packet.d, this.client), oldGuild);
                break;
            }
            case "GUILD_DELETE": {
                const guild = this.client.guilds.get(packet.d.id);
                if(guild) {
                    guild.clearAllMembers();
                    this.client.guilds.remove(packet.d);
                }

                if(packet.d.unavailable) {
                    /**
                    * Fired when a guild becomes unavailable
                    * @event Client#guildUnavailable
                    * @prop {Guild} guild The guild
                    */
                    this.emit("guildUnavailable", this.client.unavailableGuilds.add(packet.d, {client: this.client, shardId: this.id}));
                } else {
                    /**
                    * Fired when a guild is deleted. This happens when:
                    * - the client left the guild
                    * - the client was kicked/banned from the guild
                    * - the guild was literally deleted
                    * @event Client#guildDelete
                    * @prop {Guild | Object} guild The guild. If the guild was not cached, it will be an object with an `id` key. No other property is guaranteed
                    */
                    this.emit("guildDelete", guild || {
                        id: packet.d.id
                    });
                }
                break;
            }
            case "GUILD_ROLE_CREATE": {
                /**
                * Fired when a guild role is created
                * @event Client#guildRoleCreate
                * @prop {Guild} guild The guild
                * @prop {Role} role The role
                */
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in GUILD_ROLE_CREATE`);
                    break;
                }
                this.emit("guildRoleCreate", guild, guild.roles.add(packet.d.role, guild));
                break;
            }
            case "GUILD_ROLE_UPDATE": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Guild ${packet.d.guild_id} undefined in GUILD_ROLE_UPDATE`);
                    break;
                }
                const role = guild.roles.add(packet.d.role, guild);
                if(!role) {
                    this.emit("debug", `Role ${packet.d.role} in guild ${packet.d.guild_id} undefined in GUILD_ROLE_UPDATE`);
                    break;
                }
                const oldRole = {
                    color: role.color,
                    icon: role.icon,
                    managed: role.managed,
                    name: role.name,
                    permissions: role.permissions,
                    position: role.position
                };
                /**
                * Fired when a guild role is updated
                * @event Client#guildRoleUpdate
                * @prop {Guild} guild The guild
                * @prop {Role} role The updated role
                * @prop {Object} oldRole The old role data
                * @prop {Number} oldRole.color The hex color of the role in base 10
                * @prop {String?} oldRole.icon The hash of the role's icon, or null if no icon
                * @prop {Boolean} oldRole.managed Whether a guild integration manages this role or not
                * @prop {String} oldRole.name The name of the role
                * @prop {Permission} oldRole.permissions The permissions number of the role
                * @prop {Number} oldRole.position The position of the role
                */
                this.emit("guildRoleUpdate", guild, guild.roles.update(packet.d.role, guild), oldRole);
                break;
            }
            case "GUILD_ROLE_DELETE": {
                /**
                * Fired when a guild role is deleted
                * @event Client#guildRoleDelete
                * @prop {Guild} guild The guild
                * @prop {Role} role The role
                */
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in GUILD_ROLE_DELETE`);
                    break;
                }
                if(!guild.roles.has(packet.d.role_id)) {
                    this.emit("debug", `Missing role ${packet.d.role_id} in GUILD_ROLE_DELETE`);
                    break;
                }
                this.emit("guildRoleDelete", guild, guild.roles.remove({id: packet.d.role_id}));
                break;
            }
            case "INVITE_CREATE": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in INVITE_CREATE`);
                    break;
                }
                const channel = this.client.getChannel(packet.d.channel_id, packet.d.guild_id);
                if(!channel) {
                    this.emit("debug", `Missing channel ${packet.d.channel_id} in INVITE_CREATE`);
                    break;
                }
                /**
                * Fired when a guild invite is created
                * @event Client#inviteCreate
                * @prop {Guild} guild The guild this invite was created in.
                * @prop {Invite} invite The invite that was created
                */
                this.emit("inviteCreate", guild, new Invite({
                    ...packet.d,
                    guild,
                    channel
                }, this.client));
                break;
            }
            case "INVITE_DELETE": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in INVITE_DELETE`);
                    break;
                }
                const channel = this.client.getChannel(packet.d.channel_id, packet.d.guild_id);
                if(!channel) {
                    this.emit("debug", `Missing channel ${packet.d.channel_id} in INVITE_DELETE`);
                    break;
                }
                /**
                * Fired when a guild invite is deleted
                * @event Client#inviteDelete
                * @prop {Guild} guild The guild this invite was created in.
                * @prop {Invite} invite The invite that was deleted
                */
                this.emit("inviteDelete", guild, new Invite({
                    ...packet.d,
                    guild,
                    channel
                }, this.client));
                break;
            }
            case "CHANNEL_CREATE": {
                if (![
                    Constants.ChannelTypes.GUILD_TEXT,
                    Constants.ChannelTypes.GUILD_VOICE,
                    Constants.ChannelTypes.GUILD_CATEGORY,
                    Constants.ChannelTypes.GUILD_NEWS,
                    Constants.ChannelTypes.GUILD_STAGE_VOICE
                ].includes(packet.d.type)) {
                    return;
                }

                const channel = Channel.from(packet.d, this.client);
                if(packet.d.guild_id) {
                    if(!channel) {
                        this.emit("debug", `Received CHANNEL_CREATE without channel for guild ${packet.d.guild_id}`);
                        break;
                    }

                    if(!channel.guild) {
                        channel.guild = this.client.guilds.get(packet.d.guild_id);
                        if(!channel.guild) {
                            this.emit("debug", `Received CHANNEL_CREATE for channel in missing guild ${packet.d.guild_id}`);
                            break;
                        }
                    }
                    channel.guild.channels.add(channel, this.client);
                    /**
                    * Fired when a channel is created
                    * @event Client#channelCreate
                    * @prop {TextChannel | VoiceChannel | CategoryChannel | StoreChannel | NewsChannel | GuildChannel} channel The channel
                    */
                    this.emit("channelCreate", channel);
                } else {
                    this.emit("warn", new Error("Unhandled CHANNEL_CREATE type: " + JSON.stringify(packet, null, 2)));
                    break;
                }
                break;
            }
            case "CHANNEL_UPDATE": {
                if (![
                    Constants.ChannelTypes.GUILD_TEXT,
                    Constants.ChannelTypes.GUILD_VOICE,
                    Constants.ChannelTypes.GUILD_CATEGORY,
                    Constants.ChannelTypes.GUILD_NEWS,
                    Constants.ChannelTypes.GUILD_STAGE_VOICE
                ].includes(packet.d.type)) {
                    return;
                }

                let channel = this.client.getChannel(packet.d.id, packet.d.guild_id);
                if(!channel) {
                    break;
                }
                let oldChannel;
                if(channel instanceof GuildChannel) {
                    oldChannel = {
                        name: channel.name,
                        parentID: channel.parentID,
                        permissionOverwrites: channel.permissionOverwrites,
                        position: channel.position,
                        topic: channel.topic,
                        type: channel.type,
                    };
                } else {
                    this.emit("warn", `Unexpected CHANNEL_UPDATE for channel ${packet.d.id} with type ${oldType}`);
                }
                const oldType = channel.type;
                if(oldType === packet.d.type) {
                    channel.update(packet.d);
                } else {
                    this.emit("debug", `Channel ${packet.d.id} changed from type ${oldType} to ${packet.d.type}`);
                    const newChannel = Channel.from(packet.d, this.client);
                    if(packet.d.guild_id) {
                        const guild = this.client.guilds.get(packet.d.guild_id);
                        if(!guild) {
                            this.emit("debug", `Received CHANNEL_UPDATE for channel in missing guild ${packet.d.guild_id}`);
                            break;
                        }
                        guild.channels.remove(channel);
                        guild.channels.add(newChannel, this.client);
                    } else {
                        this.emit("warn", new Error("Unhandled CHANNEL_UPDATE type: " + JSON.stringify(packet, null, 2)));
                        break;
                    }
                    channel = newChannel;
                }

                /**
                * Fired when a channel is updated
                * @event Client#channelUpdate
                * @prop {TextChannel | VoiceChannel | CategoryChannel | StoreChannel | NewsChannel | GuildChannel} channel The updated channel
                * @prop {Object} oldChannel The old channel data
                * @prop {String} oldChannel.name The name of the channel
                * @prop {String?} oldChannel.parentID The ID of the category this channel belongs to (guild channels only)
                * @prop {Collection} oldChannel.permissionOverwrites Collection of PermissionOverwrites in this channel (guild channels only)
                * @prop {Number} oldChannel.position The position of the channel (guild channels only)
                * @prop {String?} oldChannel.topic The topic of the channel (text channels only)
                * @prop {Number} oldChannel.type The type of the old channel (text/news channels only)
                */
                this.emit("channelUpdate", channel, oldChannel);
                break;
            }
            case "CHANNEL_DELETE": {
                if (![
                    Constants.ChannelTypes.GUILD_TEXT,
                    Constants.ChannelTypes.GUILD_VOICE,
                    Constants.ChannelTypes.GUILD_CATEGORY,
                    Constants.ChannelTypes.GUILD_NEWS,
                    Constants.ChannelTypes.GUILD_STAGE_VOICE
                ].includes(packet.d.type)) {
                    return;
                }

                if(packet.d.guild_id) {
                    const guild = this.client.guilds.get(packet.d.guild_id);
                    if(!guild) {
                        this.emit("debug", `Missing guild ${packet.d.guild_id} in CHANNEL_DELETE`);
                        break;
                    }
                    const channel = guild.channels.remove(packet.d);
                    if(!channel) {
                        break;
                    }
                    this.emit("channelDelete", channel);
                } else {
                    this.emit("warn", new Error("Unhandled CHANNEL_DELETE type: " + JSON.stringify(packet, null, 2)));
                }
                break;
            }
            case "GUILD_MEMBERS_CHUNK": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Received GUILD_MEMBERS_CHUNK, but guild ${packet.d.guild_id} is ` + (this.client.unavailableGuilds.has(packet.d.guild_id) ? "unavailable" : "missing"), this.id);
                    break;
                }

                const members = packet.d.members.map((member) => {
                    member.id = member.user.id;
                    return guild.members.add(member, guild);
                });

                if(this.requestMembersPromise.hasOwnProperty(packet.d.nonce)) {
                    this.requestMembersPromise[packet.d.nonce].members.push(...members);
                }

                if(packet.d.chunk_index >= packet.d.chunk_count - 1) {
                    if(this.requestMembersPromise.hasOwnProperty(packet.d.nonce)) {
                        // Keep track of that shit to maybe find weird behavior
                        guild.savedCount.cache = guild.members.size;
                        guild.savedCount.chunk = (packet.d.chunk_index * 1000) + packet.d.members.length;
                        
                        if(packet.d.members.length >= 2) {
                            const newCount = guild.savedCount.chunk > 2 ? guild.savedCount.chunk : guild.members.size;
                            if(Math.abs(guild.memberCount - newCount) <= 50 && newCount >= 2) {
                                guild.memberCount = newCount;
                            }
                        }
                        
                        clearTimeout(this.requestMembersPromise[packet.d.nonce].timeout);
                        this.requestMembersPromise[packet.d.nonce].res(this.requestMembersPromise[packet.d.nonce].members);
                        delete this.requestMembersPromise[packet.d.nonce];
                    }
                    if(this.getAllUsersCount.hasOwnProperty(guild.id)) {
                        delete this.getAllUsersCount[guild.id];
                        this.checkReady();
                    }
                }

                /**
                * Fired when Discord sends member chunks
                * @event Client#guildMemberChunk
                * @prop {Guild} guild The guild the chunked members are in
                * @prop {Array<Member>} members The members in the chunk
                */
                this.emit("guildMemberChunk", guild, members);

                this.lastHeartbeatAck = true;

                break;
            }
            case "GUILD_SYNC": {// (╯°□°）╯︵ ┻━┻ thx Discord devs
                // Bot account should always be cache!!!
                const guild = this.client.guilds.get(packet.d.id);
                const botObject = packet.d.members.find(m => m.user.id === this.client.user.id);
        
                if(typeof botObject === "undefined") {
                    throw new Error("botObject not found in data from guild");
                }
        
                botObject.id = botObject.user.id;
                guild.members.add(botObject, guild);

                --this.unsyncedGuilds;
                this.checkReady();
                break;
            }
            case "RESUMED":
            case "READY": {
                this.connectAttempts = 0;
                this.reconnectInterval = 1000;

                this.connecting = false;
                if(this.connectTimeout) {
                    clearTimeout(this.connectTimeout);
                }
                this.connectTimeout = null;
                this.status = "ready";
                this.presence.status = "online";

                if(packet.t === "RESUMED") {
                    // Can only heartbeat after resume succeeds, discord/discord-api-docs#1619
                    this.heartbeat();

                    this.preReady = true;
                    this.ready = true;

                    /**
                    * Fired when a shard finishes resuming
                    * @event Shard#resume
                    */
                    super.emit("resume");
                    break;
                } else {
                    this.resumeURL = `${packet.d.resume_gateway_url}?v=${Constants.GATEWAY_VERSION}&encoding=json`;
                }

                this.client.user = this.client.users.update(new ExtendedUser(packet.d.user, this.client), this.client);
                this.client.bot = true;
                if(!this.client._token.startsWith("Bot ")) {
                    this.client._token = "Bot " + this.client._token;
                }


                if(packet.d._trace) {
                    this.discordServerTrace = packet.d._trace;
                }

                this.sessionID = packet.d.session_id;

                packet.d.guilds.forEach((guild) => {
                    if(guild.unavailable) {
                        this.client.guilds.remove(guild);
                        this.client.unavailableGuilds.add(guild, {client: this.client, shardId: this.id}, true);
                    } else {
                        this.client.unavailableGuilds.remove(this.createGuild(guild));
                    }
                });

                this.client.application = packet.d.application;

                this.preReady = true;
                /**
                * Fired when a shard finishes processing the ready packet
                * @event Client#shardPreReady
                * @prop {Number} id The ID of the shard
                */
                this.emit("shardPreReady", this.id);

                if(this.client.unavailableGuilds.size > 0 && packet.d.guilds.length > 0) {
                    this.restartGuildCreateTimeout();
                } else {
                    this.checkReady();
                }

                break;
            }
            case "USER_UPDATE": {
                const user = this.client.users.get(packet.d.id);
                const oldUser = {
                    username: user.username,
                    discriminator: user.discriminator,
                    avatar: user.avatar
                };
                this.emit("userUpdate", user.update(packet.d), oldUser);
                break;
            }
            case "GUILD_EMOJIS_UPDATE": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                let oldEmojis = null;
                let emojis = null;
                if(guild) {
                    oldEmojis = guild.emojis;
                    guild.update(packet.d);
                    emojis = guild.emojis;
                }
                /**
                * Fired when a guild's emojis are updated
                * @event Client#guildEmojisUpdate
                * @prop {Guild} guild The guild. If the guild is uncached, this is an object with an ID key. No other property is guaranteed
                * @prop {Array} emojis The updated emojis of the guild
                * @prop {Array?} oldEmojis The old emojis of the guild. If the guild is uncached, this will be null
                */
                this.emit("guildEmojisUpdate", guild || {id: packet.d.guild_id}, emojis, oldEmojis);
                break;
            }
            case "GUILD_STICKERS_UPDATE": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                let oldStickers = null;
                let stickers = null;
                if(guild) {
                    oldStickers = guild.stickers;
                    guild.update(packet.d);
                    stickers = guild.stickers;
                }
                /**
                * Fired when a guild's stickers are updated
                * @event Client#guildStickersUpdate
                * @prop {Guild} guild The guild. If the guild is uncached, this is an object with an ID key. No other property is guaranteed
                * @prop {Array} stickers The updated stickers of the guild
                * @prop {Array?} oldStickers The old stickers of the guild. If the guild is uncached, this will be null
                */
                this.emit("guildStickersUpdate", guild || {id: packet.d.guild_id}, stickers, oldStickers);
                break;
            }
            case "WEBHOOKS_UPDATE": {
                /**
                * Fired when a channel's webhooks are updated
                * @event Client#webhooksUpdate
                * @prop {Object} data The update data
                * @prop {String} data.channelID The ID of the channel that webhooks were updated in
                * @prop {String} data.guildID The ID of the guild that webhooks were updated in
                */
                this.emit("webhooksUpdate", {
                    channelID: packet.d.channel_id,
                    guildID: packet.d.guild_id
                });
                break;
            }
            case "INTERACTION_CREATE": {
                /**
                * Fired when an interaction is created
                * @event Client#interactionCreate
                * @prop {PingInteraction | CommandInteraction | ComponentInteraction | AutocompleteInteraction} Interaction The Interaction that was created
                */
                this.emit("interactionCreate", Interaction.from(packet.d, this.client));
                break;
            }
            default: {
                break;
            }
        } /* eslint-enable no-redeclare */
    }

    _onWSClose(code, reason) {
        reason = reason.toString();
        this.emit("debug", "WS disconnected: " + JSON.stringify({
            code: code,
            reason: reason,
            status: this.status
        }));
        let err = !code || code === 1000 ? null : new Error(code + ": " + reason);
        let reconnect = "auto";
        if(code) {
            this.emit("debug", `${code === 1000 ? "Clean" : "Unclean"} WS close: ${code}: ${reason}`, this.id);
            if(code === 4001) {
                err = new Error("Gateway received invalid OP code");
            } else if(code === 4002) {
                err = new Error("Gateway received invalid message");
            } else if(code === 4003) {
                err = new Error("Not authenticated");
                this.sessionID = null;
                this.resumeURL = null;
            } else if(code === 4004) {
                err = new Error("Authentication failed");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
                this.emit("error", new Error(`Invalid token: ${this._token}`));
            } else if(code === 4005) {
                err = new Error("Already authenticated");
            } else if(code === 4006 || code === 4009) {
                err = new Error("Invalid session");
                this.sessionID = null;
                this.resumeURL = null;
            } else if(code === 4007) {
                err = new Error("Invalid sequence number: " + this.seq);
                this.seq = 0;
            } else if(code === 4008) {
                err = new Error("Gateway connection was ratelimited");
            } else if(code === 4010) {
                err = new Error("Invalid shard key");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
            } else if(code === 4011) {
                err = new Error("Shard has too many guilds (>2500)");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
            } else if(code === 4013) {
                err = new Error("Invalid intents specified");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
            } else if(code === 4014) {
                err = new Error("Disallowed intents specified");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
            } else if(code === 1006) {
                err = new Error("Connection reset by peer");
            } else if(code !== 1000 && reason) {
                err = new Error(code + ": " + reason);
            }
            if(err) {
                err.code = code;
            }
        } else {
            this.emit("debug", "WS close: unknown code: " + reason, this.id);
        }
        this.disconnect({
            reconnect
        }, err);
    }

    _onWSError(err) {
        this.emit("error", err, this.id);
    }

    _onWSMessage(data) {
        try {
            if(Array.isArray(data)) { // Fragmented messages
                data = Buffer.concat(data); // Copyfull concat is slow, but no alternative
            }
            return this.onPacket(JSON.parse(data.toString()));
        } catch(err) {
            this.emit("error", err, this.id);
        }
    }

    _onWSOpen() {
        this.status = "handshaking";
        /**
        * Fired when the shard establishes a connection
        * @event Client#connect
        * @prop {Number} id The ID of the shard
        */
        this.emit("connect", this.id);
        this.lastHeartbeatAck = true;
    }

    [util.inspect.custom]() {
        return Base.prototype[util.inspect.custom].call(this);
    }

    toString() {
        return Base.prototype.toString.call(this);
    }

    toJSON(props = []) {
        return Base.prototype.toJSON.call(this, [
            "connecting",
            "ready",
            "discordServerTrace",
            "status",
            "lastHeartbeatReceived",
            "lastHeartbeatSent",
            "latency",
            "preReady",
            "getAllUsersCount",
            "getAllUsersQueue",
            "getAllUsersLength",
            "guildSyncQueue",
            "guildSyncQueueLength",
            "unsyncedGuilds",
            "lastHeartbeatAck",
            "seq",
            "sessionID",
            "reconnectInterval",
            "connectAttempts",
            ...props
        ]);
    }
}

module.exports = Shard;
