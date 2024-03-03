"use strict";

/**
* Hold a bunch of something
* @extends Map
* @prop {Class} baseObject The base class for all items
*/
class Collection extends Map {
    /**
    * Construct a Collection
    * @arg {Class} baseObject The base class for all items
    */
    constructor(baseObject) {
        super();
        this.baseObject = baseObject;
    }

    /**
    * Update an object
    * @arg {Object} obj The updated object data
    * @arg {String} obj.id The ID of the object
    * @arg {Class} [extra] An extra parameter the constructor may need
    * @arg {Boolean} [replace] Whether to replace an existing object with the same ID
    * @returns {Class} The updated object
    */
    update(obj, extra, replace) {
        if(!obj.id && obj.id !== 0) {
            throw new Error("Missing object id");
        }
        const item = this.get(obj.id);
        if(!item) {
            return this.add(obj, extra, replace);
        }
        item.update(obj, extra);
        return item;
    }

    /**
    * Add an object
    * @arg {Object} obj The object data
    * @arg {String} obj.id The ID of the object
    * @arg {Class} [extra] An extra parameter the constructor may need
    * @arg {Boolean} [replace] Whether to replace an existing object with the same ID
    * @returns {Class} The existing or newly created object
    */
    add(obj, extra, replace) {
        if(obj.id == null) {
            throw new Error("Missing object id");
        }
        const existing = this.get(obj.id);
        if(existing && !replace) {
            return existing;
        }
        if(!(obj instanceof this.baseObject || obj.constructor.name === this.baseObject.name)) {
            obj = new this.baseObject(obj, extra);
        }

        this.set(obj.id, obj);
        return obj;
    }

    /**
    * Return all the objects that make the function evaluate true
    * @arg {Function} func A function that takes an object and returns true if it matches
    * @returns {Array<Class>} An array containing all the objects that matched
    */
    filter(func) {
        const arr = [];
        for(const item of this.values()) {
            if(func(item)) {
                arr.push(item);
            }
        }
        return arr;
    }

    /**
    * Return the first object to make the function evaluate true
    * @arg {Function} func A function that takes an object and returns true if it matches
    * @returns {Class?} The first matching object, or undefined if no match
    */
    find(func) {
        for(const item of this.values()) {
            if(func(item)) {
                return item;
            }
        }
        return undefined;
    }

    /**
    * Return an array with the results of applying the given function to each element
    * @arg {Function} func A function that takes an object and returns something
    * @returns {Array} An array containing the results
    */
    map(func) {
        const arr = [];
        for(const item of this.values()) {
            arr.push(func(item));
        }
        return arr;
    }

    /**
    * Remove an object
    * @arg {Object} obj The object
    * @arg {String} obj.id The ID of the object
    * @returns {Class?} The removed object, or null if nothing was removed
    */
    remove(obj) {
        const item = this.get(obj.id);
        if(!item) {
            return null;
        }
        this.delete(obj.id);
        return item;
    }

    /**
    * wipe complete collection
    * @arg {Object} obj The object
    * @arg {String} obj.id The ID of the object
    * @returns {Number?} Size of new collection
    */
    wipe(obj) {
        this.clear();
        if(obj) {
            this.set(obj.id, obj);
        }
        return this.size;
    }

    /**
     * Returns true if at least one element satisfies the condition
     * @arg {Function} func A function that takes an object and returns true or false
     * @returns {Boolean} Whether or not at least one element satisfied the condition
     */
    some(func) {
        for(const item of this.values()) {
            if(func(item)) {
                return true;
            }
        }
        return false;
    }

    toString() {
        return `[Collection<${this.baseObject.name}>]`;
    }

    toJSON() {
        const json = {};
        for(const item of this.values()) {
            json[item.id] = item;
        }
        return json;
    }
}

module.exports = Collection;
