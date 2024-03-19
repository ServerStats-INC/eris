"use strict";

const Base = require("./Base");

/**
* Represents a server member
* @prop {Boolean} bot Whether the user is an OAuth bot or not
* @prop {Number} createdAt Timestamp of user creation
* @prop {Guild} guild The guild the member is in
* @prop {String} id The ID of the member
* @prop {Boolean?} pending Whether the member has passed the guild's Membership Screening requirements
* @prop {Permission} permission [DEPRECATED] The guild-wide permissions of the member. Use Member#permissions instead
* @prop {Permission} permissions The guild-wide permissions of the member
* @prop {Array<String>} roles An array of role IDs this member is a part of
* @prop {User} user The user object of the member
* @prop {String} username The username of the user
*/
class Member extends Base {
    constructor(data, guild) {
        super(data.id || data.user.id);
        if(!data.id && data.user) {
            data.id = data.user.id;
        }

        this.guild = guild;
        if(data.user) {
            this.user = {
                id: data.user.id,
                username: data.user.username,
                bot: !!data.user.bot
            };
        } else {
            this.user = null;
        }

        this.roles = [];
        this.update(data);
    }

    update(data) {
        if(data.joined_at !== undefined) {
            this.joinedAt = data.joined_at;
        }
        if(data.roles !== undefined) {
            this.roles = data.roles;
        }
        if(data.pending !== undefined) {
            this.pending = data.pending;
        }
    }

    get bot() {
        return this.user.bot;
    }

    get permissions() {
        return this.guild.permissionsOf(this);
    }

    get username() {
        return this.user.username;
    }

    toJSON(props = []) {
        return super.toJSON([
            "pending",
            "roles",
            "user",
            ...props
        ]);
    }
}

module.exports = Member;
