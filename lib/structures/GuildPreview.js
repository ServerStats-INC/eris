"use strict";

const Base = require("./Base");
const Endpoints = require("../rest/Endpoints.js");

/**
* Represents a GuildPreview structure
* @prop {String} id The ID of the guild
* @prop {String} name The name of the guild
* @prop {String?} icon The hash of the guild icon, or null if no icon
* @prop {Object[]} emojis An array of guild emoji objects
* @prop {String?} iconURL The URL of the guild's icon
*/
class GuildPreview extends Base {
    constructor(data, client) {
        super(data.id);
        this._client = client;

        this.name = data.name;
        this.icon = data.icon;
        this.emojis = data.emojis;
    }

    get iconURL() {
        return this.icon ? this._client._formatImage(Endpoints.GUILD_ICON(this.id, this.icon)) : null;
    }

    /**
    * Get the guild's icon with the given format and size
    * @arg {String} [format] The filetype of the icon ("jpg", "jpeg", "png", "gif", or "webp")
    * @arg {Number} [size] The size of the icon (any power of two between 16 and 4096)
    */
    dynamicIconURL(format, size) {
        return this.icon ? this._client._formatImage(Endpoints.GUILD_ICON(this.id, this.icon), format, size) : null;
    }

    toJSON(props = []) {
        return super.toJSON([
            "id",
            "name",
            "icon",
            "emojis",
            ...props
        ]);
    }
}

module.exports = GuildPreview;
