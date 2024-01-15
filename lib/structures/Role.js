"use strict";

const Base = require("./Base");
const Permission = require("./Permission");

/**
* Represents a role
* @prop {String} id The ID of the role
* @prop {String} name The name of the role
* @prop {Guild} guild The guild that owns the role
* @prop {Boolean} managed Whether a guild integration manages this role or not
* @prop {Permission} permissions The permissions representation of the role
* @prop {Object} json Generates a JSON representation of the role permissions
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
        if(data.permissions !== undefined) {
            this.permissions = new Permission(data.permissions);
        }
    }

    toJSON(props = []) {
        return super.toJSON([
            "name",
            "managed",
            "permissions",
            ...props
        ]);
    }
}

module.exports = Role;
