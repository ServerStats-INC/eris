import Eris from "./index.js";

export default function(token, options) {
  return new Eris.Client(token, options);
}

export const {
  AutocompleteInteraction,
  Base,
  Bucket,
  CategoryChannel,
  Channel,
  Client,
  Collection,
  CommandInteraction,
  ComponentInteraction,
  Constants,
  DiscordHTTPError,
  DiscordRESTError,
  Guild,
  GuildChannel,
  Interaction,
  Invite,
  Member,
  NewsChannel,
  Permission,
  PermissionOverwrite,
  PingInteraction,
  RequestHandler,
  Role,
  SequentialBucket,
  Shard,
  StageChannel,
  StageInstance,
  StoreChannel,
  TextChannel,
  UnavailableGuild,
  VERSION,
  VoiceChannel,
} = Eris;
