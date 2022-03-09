"use strict";

const Collection = require("../util/Collection");
const GuildChannel = require("./GuildChannel");
const Member = require("./Member");

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
    }

    update(data) {
        super.update(data);
    }

    /**
    * Get all invites in the channel
    * @returns {Promise<Array<Invite>>}
    */
    getInvites() {
        return this.client.getChannelInvites.call(this.client, this.id);
    }

    toJSON(props = []) {
        return super.toJSON([
            ...props
        ]);
    }
}

module.exports = VoiceChannel;
