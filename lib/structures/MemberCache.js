"use strict";

class MemberCache {
    constructor(data, guild) {
        this.id = data.id || data.user.id;
        this.roles = [];

        // prevent this from being added if welcome and/or goal isn't used
        this.joinedAt = data.joined_at;

        this.update(data);
    }

    update(data) {
        if(data.roles !== undefined) {
            // Make a check so only roles that have a role counter will be added
            this.roles = data.roles;
        }
    }
}

module.exports = MemberCache;
