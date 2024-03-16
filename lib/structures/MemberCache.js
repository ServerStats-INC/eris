"use strict";

class MemberCache {
    constructor(data, settings) {
        this.id = data.id || data.user.id;
        this.settings = settings;

        this.update(data);
    }

    update(data) {
        if(data.roles !== undefined && this.settings.roleCounter.size > 0) {
            if(!this.roles) this.roles = new Set();
            if(this.roles) this.roles.clear();
            this.settings.roleCounter.forEach((r) => {
                if(data.roles.includes(r)) {
                    this.roles.add(r);
                }
            });
        }
        if(data.roles !== undefined && this.settings.hasNoRole) {
            if(data.roles.length > 0) {
                this.noRoles = false;
            } else {
                this.noRoles = true;
            }
        }
        if((data.joinedAt !== undefined || data.joined_at !== undefined) && this.settings.hasWelcome) {
            this.joinedAt = data.joinedAt || data.joined_at;
        }
    }
}

module.exports = MemberCache;
