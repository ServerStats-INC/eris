"use strict";

const Client = require("./lib/Client");

function Eris(token, options) {
    return new Client(token, options);
}

Eris.AutocompleteInteraction = require("./lib/structures/AutocompleteInteraction");
Eris.Base = require("./lib/structures/Base");
Eris.Bucket = require("./lib/util/Bucket");
Eris.CategoryChannel = require("./lib/structures/CategoryChannel");
Eris.Channel = require("./lib/structures/Channel");
Eris.CommandInteraction = require("./lib/structures/CommandInteraction");
Eris.ComponentInteraction = require("./lib/structures/ComponentInteraction");
Eris.Client = Client;
Eris.Collection = require("./lib/util/Collection");
Eris.Constants = require("./lib/Constants");
Eris.DiscordHTTPError = require("./lib/errors/DiscordHTTPError");
Eris.DiscordRESTError = require("./lib/errors/DiscordRESTError");
Eris.ExtendedUser = require("./lib/structures/ExtendedUser");
Eris.Guild = require("./lib/structures/Guild");
Eris.GuildChannel = require("./lib/structures/GuildChannel");
Eris.GuildIntegration = require("./lib/structures/GuildIntegration");
Eris.Interaction = require("./lib/structures/Interaction");
Eris.Invite = require("./lib/structures/Invite");
Eris.Member = require("./lib/structures/Member");
Eris.NewsChannel = require("./lib/structures/NewsChannel");
Eris.Permission = require("./lib/structures/Permission");
Eris.PermissionOverwrite = require("./lib/structures/PermissionOverwrite");
Eris.PingInteraction = require("./lib/structures/PingInteraction");
Eris.RequestHandler = require("./lib/rest/RequestHandler");
Eris.Role = require("./lib/structures/Role");
Eris.SequentialBucket = require("./lib/util/SequentialBucket");
Eris.Shard = require("./lib/gateway/Shard");
Eris.StageChannel = require("./lib/structures/StageChannel");
Eris.StageInstance = require("./lib/structures/StageInstance");
Eris.StoreChannel = require("./lib/structures/StoreChannel");
Eris.TextChannel = require("./lib/structures/TextChannel");
Eris.UnavailableGuild = require("./lib/structures/UnavailableGuild");
Eris.User = require("./lib/structures/User");
Eris.VERSION = require("./package.json").version;
Eris.VoiceChannel = require("./lib/structures/VoiceChannel");

module.exports = Eris;
