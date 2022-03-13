"use strict";

const Base = require("./Base");
const Endpoints = require("../rest/Endpoints");
const Permission = require("./Permission");

/**
* Represents a role
* @prop {Number} color The hex color of the role in base 10
* @prop {Number} createdAt Timestamp of the role's creation
* @prop {String?} icon The hash of the role's icon, or null if no icon
* @prop {String?} iconURL The URL of the role's icon
* @prop {String} id The ID of the role
* @prop {Object} json Generates a JSON representation of the role permissions
* @prop {Guild} guild The guild that owns the role
* @prop {Boolean} managed Whether a guild integration manages this role or not
* @prop {String} name The name of the role
* @prop {Permission} permissions The permissions representation of the role
* @prop {Number} position The position of the role
* @prop {String?} unicodeEmoji Unicode emoji for the role
*/
class Role extends Base {
    constructor(data, guild) {
        super(data.id);
        this.guild = guild;
        this.update(data);
    }

    update(data) {
        if(data.name !== undefined) {
            this.name = data.name;
        }
        if(data.managed !== undefined) {
            this.managed = data.managed;
        }
        if(data.color !== undefined) {
            this.color = data.color;
        }
        if(data.position !== undefined) {
            this.position = data.position;
        }
        if(data.permissions !== undefined) {
            this.permissions = new Permission(data.permissions);
        }
        if(data.icon !== undefined) {
            this.icon = data.icon;
        }
        if(data.unicode_emoji !== undefined) {
            this.unicodeEmoji = data.unicode_emoji;
        }
    }

    get iconURL() {
        return this.icon ? this.guild.shard.client._formatImage(Endpoints.ROLE_ICON(this.id, this.icon)) : null;
    }

    get json() {
        return this.permissions.json;
    }

    toJSON(props = []) {
        return super.toJSON([
            "color",
            "icon",
            "managed",
            "name",
            "permissions",
            "position",
            "unicodeEmoji",
            ...props
        ]);
    }
}

module.exports = Role;
