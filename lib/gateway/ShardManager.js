"use strict";

const Base = require("../structures/Base");
const Collection = require("../util/Collection");
const Shard = require("./Shard");
const IORedis = require("ioredis");
const crypto = require("crypto");

class Redis {
    constructor(options, processName, shards) {
        this.redisClient = new IORedis(options.port, options.host, {password: options.password});
        this.processName = processName;
        this.shards = shards;

        this.concurrent = options.concurrent || 16;
        this.redisClient.on("error", console.error);
    }

    async lock(shardId, expiry = 5100, timeout = 400) {
        return new Promise(async (resolve, reject) => {
            const shard = this.shards.get(shardId);

            if (!shard || shard.status !== "identifying") {
                return reject(new Error("Shard not found or not identifying"));
            }
        
            const lockKey = `${this.processName}:shard:${shardId % this.concurrent}`;
            const lockValue = crypto.randomBytes(16).toString("hex");

            const aquired = await this.redisClient.set(lockKey, lockValue, "PX", expiry, "NX") === "OK";
            if (aquired) {
                resolve();
            } else {
                timeout = Math.min(Math.round(timeout * (Math.random() * 2 + 1)), 8000)
                setTimeout(() => this.lock(shardId, expiry, timeout).then(resolve).catch(reject), timeout);
            }
        });
    }
}

class ShardManager extends Collection {
    constructor(client) {
        super(Shard);
        this._client = client;

        this.connectQueue = [];
        this.lastConnect = 0;
        this.connectTimeout = null;

        if(!client.options) return;
        if(client.options.useConcurrentBoot) {
            if (!client.options.redisAuth && !client.options.redisHost && !client.options.redisPort) {
                return new Error("No redis redisAuth and host set in config");
            }
    
            this.redis = new Redis(
                {
                    host: client.options.redisHost,
                    port: client.options.redisPort,
                    password: client.options.redisAuth,
                    concurrent: client.options.concurrentAmountOverwrite
                },
                client.options.processName,
                this
            );
        }
    }

    async connect(shard) {
        if(this._client.options.useConcurrentBoot) {
            shard.connect();
        } else {
            if(shard.sessionID || (this.lastConnect <= Date.now() - 5000 && !this.find((shard) => shard.connecting))) {
                shard.connect();
                this.lastConnect = Date.now() + 7500;
            } else {
                this.connectQueue.push(shard);
                this.tryConnect();
            }
        }
    }

    spawn(id) {
        let shard = this.get(id);
        if (!shard) {
            shard = this.add(new Shard(id, this._client));
            shard.on("ready", () => {
                /**
                * Fired when a shard turns ready
                * @event Client#shardReady
                * @prop {Number} id The ID of the shard
                */
                this._client.emit("shardReady", shard.id);
                if (this._client.ready) {
                    return;
                }
                for (const other of this.values()) {
                    if (!other.ready) {
                        return;
                    }
                }
                this._client.ready = true;
                this._client.startTime = Date.now();
                /**
                * Fired when all shards turn ready
                * @event Client#ready
                */
                this._client.emit("ready");
            }).on("resume", () => {
                /**
                * Fired when a shard resumes
                * @event Client#shardResume
                * @prop {Number} id The ID of the shard
                */
                this._client.emit("shardResume", shard.id);
                if (this._client.ready) {
                    return;
                }
                for (const other of this.values()) {
                    if (!other.ready) {
                        return;
                    }
                }
                this._client.ready = true;
                this._client.startTime = Date.now();
                this._client.emit("ready");
            }).on("disconnect", (error) => {
                /**
                * Fired when a shard disconnects
                * @event Client#shardDisconnect
                * @prop {Error?} error The error, if any
                * @prop {Number} id The ID of the shard
                */
                this._client.emit("shardDisconnect", error, shard.id);
                for (const other of this.values()) {
                    if (other.ready) {
                        return;
                    }
                }
                this._client.ready = false;
                this._client.startTime = 0;
                /**
                * Fired when all shards disconnect
                * @event Client#disconnect
                */
                this._client.emit("disconnect");
            });
        }
        if (shard.status === "disconnected") {
            this.connect(shard);
        }
    }

    tryConnect() {
        if(this.connectQueue.length > 0) {
            if(this.lastConnect <= Date.now() - 5000) {
                const shard = this.connectQueue.shift();
                shard.connect();
                this.lastConnect = Date.now() + 7500;
            } else if(!this.connectTimeout) {
                this.connectTimeout = setTimeout(() => {
                    this.connectTimeout = null;
                    this.tryConnect();
                }, 1000);
            }
        }
    }

    _readyPacketCB() {
        this.lastConnect = Date.now();
        this.tryConnect();
    }

    toString() {
        return `[ShardManager ${this.size}]`;
    }

    toJSON(props = []) {
        return Base.prototype.toJSON.call(this, ["connectQueue", "lastConnect", "connectionTimeout", ...props]);
    }
}

module.exports = ShardManager;
