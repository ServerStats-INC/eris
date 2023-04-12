"use strict";

const Base = require("./Base");
const Endpoints = require("../rest/Endpoints");
const User = require("./User");

/**
* Represents a server member
* @prop {String?} avatar The hash of the member's guild avatar, or null if no guild avatar
* @prop {String} avatarURL The URL of the user's avatar which can be either a JPG or GIF
* @prop {Boolean} bot Whether the user is an OAuth bot or not
* @prop {Number} createdAt Timestamp of user creation
* @prop {String} defaultAvatar The hash for the default avatar of a user if there is no avatar set
* @prop {String} defaultAvatarURL The URL of the user's default avatar
* @prop {String} discriminator The discriminator of the user
* @prop {Guild} guild The guild the member is in
* @prop {String} id The ID of the member
* @prop {Number?} joinedAt Timestamp of when the member joined the guild
* @prop {String?} nick The server nickname of the member
* @prop {Boolean?} pending Whether the member has passed the guild's Membership Screening requirements
* @prop {Permission} permission [DEPRECATED] The guild-wide permissions of the member. Use Member#permissions instead
* @prop {Permission} permissions The guild-wide permissions of the member
* @prop {Number} premiumSince Timestamp of when the member boosted the guild
* @prop {Array<String>} roles An array of role IDs this member is a part of
* @prop {User} user The user object of the member
* @prop {String} username The username of the user
*/
class Member extends Base {
    constructor(data, guild, client) {
        super(data.id || data.user.id);
        if(!data.id && data.user) {
            data.id = data.user.id;
        }
        if((this.guild = guild)) {
            this.user = guild.shard.client.users.get(data.id);
            if(!this.user && data.user) {
                this.user = guild.shard.client.users.add(data.user, guild.shard.client);
            }
            if(!this.user) {
                throw new Error("User associated with Member not found: " + data.id);
            }
        } else if(data.user) {
            if(!client) {
                this.user = new User(data.user);
            } else {
                this.user = client.users.update(data.user, client);
            }
        } else {
            this.user = null;
        }

        // Ingore bot's so we don't get large sets
        if (this.user && !this.user.bot) {
            this.user.guilds.add(this.guild.id);
        }

        this.nick = null;
        this.roles = [];
        this.update(data);
    }

    update(data) {
        if(data.joined_at !== undefined) {
            this.joinedAt = data.joined_at ?  Date.parse(data.joined_at) : null;
        }
        if(data.premium_since !== undefined) {
            this.premiumSince = data.premium_since;
        }
        if(data.nick !== undefined) {
            this.nick = data.nick;
        }
        if(data.roles !== undefined) {
            this.roles = data.roles;
        }
        if(data.pending !== undefined) {
            this.pending = data.pending;
        }
        if(data.avatar !== undefined) {
            this.avatar = data.avatar;
        }
    }

    get avatarURL() {
        return this.avatar ? this.guild.shard.client._formatImage(Endpoints.GUILD_AVATAR(this.guild.id, this.id, this.avatar)) : this.user.avatarURL;
    }

    get bot() {
        return this.user.bot;
    }

    get createdAt() {
        return this.user.createdAt;
    }

    get discriminator() {
        return this.user.discriminator;
    }

    get permissions() {
        return this.guild.permissionsOf(this);
    }

    get username() {
        return this.user.username;
    }

    toJSON(props = []) {
        return super.toJSON([
            "joinedAt",
            "nick",
            "pending",
            "premiumSince",
            "roles",
            "user",
            ...props
        ]);
    }
}

module.exports = Member;
