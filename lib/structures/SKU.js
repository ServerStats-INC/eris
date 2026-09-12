"use strict";
const Base = require("./Base");

/**
 * Represents a SKU
 * @extends Base
 */
class SKU extends Base {
    constructor(data, client) {
        super(data.id);
        this._client = client;
        
        /**
         * The type of the SKU
         * @type {Number}
         */
        this.type = data.type;

        /**
         * The ID of the application that owns this SKU
         * @type {String}
         */
        this.applicationID = data.application_id;

        /**
         * The customer-facing name of the SKU
         * @type {String}
         */
        this.name = data.name;

        /**
         * A system-generated URL slug for the SKU
         * @type {String}
         */
        this.slug = data.slug;

        /**
         * The SKU flag bitfield
         * @type {Number}
         */
        this.flags = data.flags;
    }

    /**
     * Gets a subscription to this SKU
     * @param {String} subscriptionID The ID of the subscription
     * @returns {Promise<Subscription>}
     */
    getSubscription(subscriptionID) {
        return this._client.getSKUSubscription.call(this._client, this.id, subscriptionID);
    }

    /**
     * Gets the list of subscriptions to this SKU
     * @param {Object} options The options for the request
     * @param {String} [options.after] Get subscriptions after this subscription ID
     * @param {String} [options.before] Get subscriptions before this subscription ID
     * @param {Number} [options.limit] The maximum number of subscriptions to get
     * @param {String} options.userID The ID of the user to get subscriptions for (can be omitted only if requesting with an OAuth token)
     * @returns {Promise<Array<Subscription>>}
     */
    getSubscriptions(options) {
        return this._client.getSKUSubscriptions.call(this._client, this.id, options);
    }

    toJSON(props = []) {
        return super.toJSON([
            "type",
            "applicationID",
            "name",
            "slug",
            "flags",
            ...props
        ]);
    }
}

module.exports = SKU;
