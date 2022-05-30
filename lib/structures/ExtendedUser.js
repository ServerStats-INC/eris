"use strict";

const User = require("./User");

/**
* Represents an extended user
* @extends User
* @prop {Boolean} mfaEnabled Whether the user has enabled two-factor authentication
* @prop {Number} premiumType The type of Nitro subscription on the user's account
*/
class ExtendedUser extends User {
    constructor(data, client) {
        super(data, client);
        this.update(data);
    }

    update(data) {
        super.update(data);
        if(data.mfa_enabled !== undefined) {
            this.mfaEnabled = data.mfa_enabled;
        }
        if(data.premium_type !== undefined) {
            this.premiumType = data.premium_type;
        }
    }

    toJSON(props = []) {
        return super.toJSON([
            "mfaEnabled",
            "premium",
            ...props
        ]);
    }
}

module.exports = ExtendedUser;
