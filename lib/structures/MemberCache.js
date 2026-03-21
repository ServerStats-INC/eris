"use strict";

class MemberCache {
    constructor(data, settings) {
        this.id = data.id || data.user.id;
        this.settings = settings;

        this.update(data);
    }

    update(data) {
        if(data.roles !== undefined) {
            if(this.settings.roleCounter.size < 1 && !this.settings.hasNoRole) {
                if(this.roles) delete this.roles;
            }

            if(this.settings.roleCounter.size > 0 || this.settings.hasNoRole) {
                if(this.settings.hasNoRole && data.roles.length > 0 && this.settings.roleCounter.size < 1) {
                    if(this.roles) delete this.roles;
                }

                if(this.settings.hasNoRole && data.roles.length < 1) {
                    if(this.roles) this.roles.clear();
                    if(!this.roles) this.roles = new Set();
                }
    
                if(this.settings.roleCounter.size > 0 && data.roles.length > 0) {
                    if(!!data.roles.find((r) => this.settings.roleCounter.has(r))) {
                        if(this.roles) this.roles.clear();
                        if(!this.roles) this.roles = new Set();
    
                        this.settings.roleCounter.forEach((r) => {
                            if(data.roles.includes(r)) {
                                this.roles.add(r);
                            }
                        });
                    } else {
                        if(this.roles) delete this.roles;
                    }
                }
            }
        }
        if(data.joinedAt !== undefined || data.joined_at !== undefined) {
            if(!this.settings.hasWelcome) {
                if(this.joinedAt) delete this.joinedAt;
            } else {
                this.joinedAt = data.joinedAt || data.joined_at;
            }
        }
        if(data.activities !== undefined) {
            if(!this.settings.hasActivities) {
                if(this.activities) delete this.activities;
            } else {
                this.activities = data.activities;
            }
        }
        if(data.status !== undefined) {
            if(!this.settings.hasStatus) {
                if(this.status) delete this.status;
            } else {
                this.status = data.status;
            }
        }
    }
}

module.exports = MemberCache;
