"use strict";

const GuildChannel = require("./GuildChannel");

/**
* Represents a guild voice channel. See GuildChannel for more properties and methods.
* @extends GuildChannel
* @prop {Number?} bitrate The bitrate of the channel
* @prop {String?} rtcRegion The RTC region ID of the channel (automatic when `null`)
* @prop {Number} type The type of the channel
* @prop {Number?} userLimit The max number of users that can join the channel
* @prop {Number?} videoQualityMode The camera video quality mode of the voice channel. `1` is auto, `2` is 720p
*/
class VoiceChannel extends GuildChannel {
    constructor(data, client) {
        super(data, client);
        this.update(data);
        this.voiceMembers = new Set();
    }

    update(data) {
        super.update(data);
    }

    toJSON(props = []) {
        return super.toJSON([
            ...props
        ]);
    }
}

module.exports = VoiceChannel;
