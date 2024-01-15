"use strict";

const Base = require("./Base");

/**
* Represents a user
* @prop {String?} avatar The hash of the user's avatar, or null if no avatar
* @prop {Boolean} bot Whether the user is an OAuth bot or not
* @prop {Number} createdAt Timestamp of the user's creation
* @prop {String} id The ID of the user
* @prop {String} username The username of the user
*/
class User extends Base {
    constructor(data, client) {
        super(data.id);
        if(!client) {
            this._missingClientError = new Error("Missing client in constructor"); // Preserve constructor callstack
        }

        this._client = client;
        this.bot = !!data.bot;
        this.guilds = new Set();

        this.update(data);
    }

    removeGuild(guildId) {
        this.guilds.delete(guildId);

        if(this.guilds.size === 0 && this.id !== this._client.id) {
            this._client.users.remove(this);
        }
    }

    update(data) {
        if(data.avatar !== undefined) {
            this.avatar = data.avatar;
        }
        if(data.username !== undefined) {
            this.username = data.username;
        }
    }

    toJSON(props = []) {
        return super.toJSON([
            "avatar",
            "bot",
            "username",
            ...props
        ]);
    }
}

module.exports = User;
