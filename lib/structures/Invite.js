"use strict";

const Base = require("./Base");

/**
* Represents an invite. Some properties are only available when fetching invites from channels, which requires the Manage Channel permission.
* @prop {TextChannel | NewsChannel | VoiceChannel | StageChannel | Object} channel Info on the invite channel
* @prop {String} channel.id The ID of the invite's channel
* @prop {String?} channel.name The name of the invite's channel
* @prop {Number} channel.type The type of the invite's channel
* @prop {String} code The invite code
* @prop {Number?} createdAt Timestamp of invite creation
* @prop {Guild?} guild Info on the invite guild
* @prop {User?} inviter The invite creator
* @prop {Number?} maxAge How long the invite lasts in seconds
* @prop {Number?} maxUses The max number of invite uses
* @prop {Number?} memberCount The **approximate** member count for the guild
* @prop {Number?} presenceCount The **approximate** presence count for the guild
* @prop {Object?} stageInstance The active public stage instance data for the stage channel this invite is for
* @prop {String?} targetApplicationID The target application id
* @prop {Number?} targetType The type of the target application
* @prop {User?} targetUser The user whose stream is displayed for the invite (voice channel only)
* @prop {Boolean?} temporary Whether the invite grants temporary membership or not
* @prop {Number?} uses The number of invite uses
*/
class Invite extends Base {
    constructor(data, client) {
        super();
        this._client = client;
        this.code = data.code;
        this.channel = {
            id: data.channel.id,
            name: data.channel.name || 'Channel unknown'
        };
        if(data.inviter) {
            this.inviter = {
                id: data.inviter.id,
                username: data.inviter.username || 'Creator unknown'
            }
        }
        this.uses = data.uses !== undefined ? data.uses : null;
        this.maxUses = data.max_uses !== undefined ? data.max_uses : null;
        this.maxAge = data.max_age !== undefined ? data.max_age : null;
        this.temporary = data.temporary !== undefined ? data.temporary : null;
        this._createdAt = data.created_at !== undefined ? data.created_at : null;
    }

    get createdAt() {
        return Date.parse(this._createdAt);
    }

    toString() {
        return `[Invite ${this.code}]`;
    }

    toJSON(props = []) {
        return super.toJSON([
            "channel",
            "code",
            "createdAt",
            "maxAge",
            "maxUses",
            "memberCount",
            "presenceCount",
            "revoked",
            "temporary",
            "uses",
            ...props
        ]);
    }
}

module.exports = Invite;
