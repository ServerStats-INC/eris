"use strict";

const TextChannel = require("./TextChannel");

/**
* Represents a guild news channel. See TextChannel for more properties and methods.
* @extends TextChannel
*/
class NewsChannel extends TextChannel {
    constructor(data, guild) {
        super(data, guild);
        this.update(data);
    }
}

module.exports = NewsChannel;
