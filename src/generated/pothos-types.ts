/* eslint-disable */
import type { Prisma, User, Platform, PlatformRelease, GameFamily, Game, GameVersion, GameVersionReleaseDate, AchievementSet, Achievement, UserAchievement, Trophy, PlaySession, UserGame, CollectionItem, DLC, UserDLC, Bundle, BuylistItem, SellListItem } from "@prisma/client";
import type { PothosPrismaDatamodel } from "@pothos/plugin-prisma";
export default interface PrismaTypes {
    User: {
        Name: "User";
        Shape: User;
        Include: Prisma.UserInclude;
        Select: Prisma.UserSelect;
        OrderBy: Prisma.UserOrderByWithRelationInput;
        WhereUnique: Prisma.UserWhereUniqueInput;
        Where: Prisma.UserWhereInput;
        Create: {};
        Update: {};
        RelationName: "achievements" | "trophies" | "userGames" | "collectionItems" | "playSessions" | "achievementSets" | "ownedDlcs" | "buylistItems" | "sellListItems";
        ListRelations: "achievements" | "trophies" | "userGames" | "collectionItems" | "playSessions" | "achievementSets" | "ownedDlcs" | "buylistItems" | "sellListItems";
        Relations: {
            achievements: {
                Shape: UserAchievement[];
                Name: "UserAchievement";
                Nullable: false;
            };
            trophies: {
                Shape: Trophy[];
                Name: "Trophy";
                Nullable: false;
            };
            userGames: {
                Shape: UserGame[];
                Name: "UserGame";
                Nullable: false;
            };
            collectionItems: {
                Shape: CollectionItem[];
                Name: "CollectionItem";
                Nullable: false;
            };
            playSessions: {
                Shape: PlaySession[];
                Name: "PlaySession";
                Nullable: false;
            };
            achievementSets: {
                Shape: AchievementSet[];
                Name: "AchievementSet";
                Nullable: false;
            };
            ownedDlcs: {
                Shape: UserDLC[];
                Name: "UserDLC";
                Nullable: false;
            };
            buylistItems: {
                Shape: BuylistItem[];
                Name: "BuylistItem";
                Nullable: false;
            };
            sellListItems: {
                Shape: SellListItem[];
                Name: "SellListItem";
                Nullable: false;
            };
        };
    };
    Platform: {
        Name: "Platform";
        Shape: Platform;
        Include: Prisma.PlatformInclude;
        Select: Prisma.PlatformSelect;
        OrderBy: Prisma.PlatformOrderByWithRelationInput;
        WhereUnique: Prisma.PlatformWhereUniqueInput;
        Where: Prisma.PlatformWhereInput;
        Create: {};
        Update: {};
        RelationName: "games" | "bundles" | "dlcs" | "collectionItems" | "userGames" | "releases";
        ListRelations: "games" | "bundles" | "dlcs" | "collectionItems" | "userGames" | "releases";
        Relations: {
            games: {
                Shape: Game[];
                Name: "Game";
                Nullable: false;
            };
            bundles: {
                Shape: Bundle[];
                Name: "Bundle";
                Nullable: false;
            };
            dlcs: {
                Shape: DLC[];
                Name: "DLC";
                Nullable: false;
            };
            collectionItems: {
                Shape: CollectionItem[];
                Name: "CollectionItem";
                Nullable: false;
            };
            userGames: {
                Shape: UserGame[];
                Name: "UserGame";
                Nullable: false;
            };
            releases: {
                Shape: PlatformRelease[];
                Name: "PlatformRelease";
                Nullable: false;
            };
        };
    };
    PlatformRelease: {
        Name: "PlatformRelease";
        Shape: PlatformRelease;
        Include: Prisma.PlatformReleaseInclude;
        Select: Prisma.PlatformReleaseSelect;
        OrderBy: Prisma.PlatformReleaseOrderByWithRelationInput;
        WhereUnique: Prisma.PlatformReleaseWhereUniqueInput;
        Where: Prisma.PlatformReleaseWhereInput;
        Create: {};
        Update: {};
        RelationName: "platform";
        ListRelations: never;
        Relations: {
            platform: {
                Shape: Platform;
                Name: "Platform";
                Nullable: false;
            };
        };
    };
    GameFamily: {
        Name: "GameFamily";
        Shape: GameFamily;
        Include: Prisma.GameFamilyInclude;
        Select: Prisma.GameFamilySelect;
        OrderBy: Prisma.GameFamilyOrderByWithRelationInput;
        WhereUnique: Prisma.GameFamilyWhereUniqueInput;
        Where: Prisma.GameFamilyWhereInput;
        Create: {};
        Update: {};
        RelationName: "baseGameFamilies" | "derivedGameFamilies" | "games" | "achievementSets" | "dlcs" | "bundles" | "buylistItems";
        ListRelations: "baseGameFamilies" | "derivedGameFamilies" | "games" | "achievementSets" | "dlcs" | "bundles" | "buylistItems";
        Relations: {
            baseGameFamilies: {
                Shape: GameFamily[];
                Name: "GameFamily";
                Nullable: false;
            };
            derivedGameFamilies: {
                Shape: GameFamily[];
                Name: "GameFamily";
                Nullable: false;
            };
            games: {
                Shape: Game[];
                Name: "Game";
                Nullable: false;
            };
            achievementSets: {
                Shape: AchievementSet[];
                Name: "AchievementSet";
                Nullable: false;
            };
            dlcs: {
                Shape: DLC[];
                Name: "DLC";
                Nullable: false;
            };
            bundles: {
                Shape: Bundle[];
                Name: "Bundle";
                Nullable: false;
            };
            buylistItems: {
                Shape: BuylistItem[];
                Name: "BuylistItem";
                Nullable: false;
            };
        };
    };
    Game: {
        Name: "Game";
        Shape: Game;
        Include: Prisma.GameInclude;
        Select: Prisma.GameSelect;
        OrderBy: Prisma.GameOrderByWithRelationInput;
        WhereUnique: Prisma.GameWhereUniqueInput;
        Where: Prisma.GameWhereInput;
        Create: {};
        Update: {};
        RelationName: "gameFamily" | "platform" | "trophies" | "userGames" | "collectionItems" | "versions" | "versionReleaseDates" | "buylistItems" | "playSessions";
        ListRelations: "trophies" | "userGames" | "collectionItems" | "versions" | "versionReleaseDates" | "buylistItems" | "playSessions";
        Relations: {
            gameFamily: {
                Shape: GameFamily | null;
                Name: "GameFamily";
                Nullable: true;
            };
            platform: {
                Shape: Platform | null;
                Name: "Platform";
                Nullable: true;
            };
            trophies: {
                Shape: Trophy[];
                Name: "Trophy";
                Nullable: false;
            };
            userGames: {
                Shape: UserGame[];
                Name: "UserGame";
                Nullable: false;
            };
            collectionItems: {
                Shape: CollectionItem[];
                Name: "CollectionItem";
                Nullable: false;
            };
            versions: {
                Shape: GameVersion[];
                Name: "GameVersion";
                Nullable: false;
            };
            versionReleaseDates: {
                Shape: GameVersionReleaseDate[];
                Name: "GameVersionReleaseDate";
                Nullable: false;
            };
            buylistItems: {
                Shape: BuylistItem[];
                Name: "BuylistItem";
                Nullable: false;
            };
            playSessions: {
                Shape: PlaySession[];
                Name: "PlaySession";
                Nullable: false;
            };
        };
    };
    GameVersion: {
        Name: "GameVersion";
        Shape: GameVersion;
        Include: Prisma.GameVersionInclude;
        Select: Prisma.GameVersionSelect;
        OrderBy: Prisma.GameVersionOrderByWithRelationInput;
        WhereUnique: Prisma.GameVersionWhereUniqueInput;
        Where: Prisma.GameVersionWhereInput;
        Create: {};
        Update: {};
        RelationName: "games" | "versionReleaseDates" | "dlcs" | "achievementSets" | "userGames" | "collectionItems" | "buylistItems";
        ListRelations: "games" | "versionReleaseDates" | "dlcs" | "achievementSets" | "userGames" | "collectionItems" | "buylistItems";
        Relations: {
            games: {
                Shape: Game[];
                Name: "Game";
                Nullable: false;
            };
            versionReleaseDates: {
                Shape: GameVersionReleaseDate[];
                Name: "GameVersionReleaseDate";
                Nullable: false;
            };
            dlcs: {
                Shape: DLC[];
                Name: "DLC";
                Nullable: false;
            };
            achievementSets: {
                Shape: AchievementSet[];
                Name: "AchievementSet";
                Nullable: false;
            };
            userGames: {
                Shape: UserGame[];
                Name: "UserGame";
                Nullable: false;
            };
            collectionItems: {
                Shape: CollectionItem[];
                Name: "CollectionItem";
                Nullable: false;
            };
            buylistItems: {
                Shape: BuylistItem[];
                Name: "BuylistItem";
                Nullable: false;
            };
        };
    };
    GameVersionReleaseDate: {
        Name: "GameVersionReleaseDate";
        Shape: GameVersionReleaseDate;
        Include: Prisma.GameVersionReleaseDateInclude;
        Select: Prisma.GameVersionReleaseDateSelect;
        OrderBy: Prisma.GameVersionReleaseDateOrderByWithRelationInput;
        WhereUnique: Prisma.GameVersionReleaseDateWhereUniqueInput;
        Where: Prisma.GameVersionReleaseDateWhereInput;
        Create: {};
        Update: {};
        RelationName: "game" | "gameVersion";
        ListRelations: never;
        Relations: {
            game: {
                Shape: Game;
                Name: "Game";
                Nullable: false;
            };
            gameVersion: {
                Shape: GameVersion;
                Name: "GameVersion";
                Nullable: false;
            };
        };
    };
    AchievementSet: {
        Name: "AchievementSet";
        Shape: AchievementSet;
        Include: Prisma.AchievementSetInclude;
        Select: Prisma.AchievementSetSelect;
        OrderBy: Prisma.AchievementSetOrderByWithRelationInput;
        WhereUnique: Prisma.AchievementSetWhereUniqueInput;
        Where: Prisma.AchievementSetWhereInput;
        Create: {};
        Update: {};
        RelationName: "gameFamily" | "gameVersion" | "dlc" | "createdBy" | "achievements";
        ListRelations: "achievements";
        Relations: {
            gameFamily: {
                Shape: GameFamily | null;
                Name: "GameFamily";
                Nullable: true;
            };
            gameVersion: {
                Shape: GameVersion | null;
                Name: "GameVersion";
                Nullable: true;
            };
            dlc: {
                Shape: DLC | null;
                Name: "DLC";
                Nullable: true;
            };
            createdBy: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            achievements: {
                Shape: Achievement[];
                Name: "Achievement";
                Nullable: false;
            };
        };
    };
    Achievement: {
        Name: "Achievement";
        Shape: Achievement;
        Include: Prisma.AchievementInclude;
        Select: Prisma.AchievementSelect;
        OrderBy: Prisma.AchievementOrderByWithRelationInput;
        WhereUnique: Prisma.AchievementWhereUniqueInput;
        Where: Prisma.AchievementWhereInput;
        Create: {};
        Update: {};
        RelationName: "achievementSet" | "users";
        ListRelations: "users";
        Relations: {
            achievementSet: {
                Shape: AchievementSet;
                Name: "AchievementSet";
                Nullable: false;
            };
            users: {
                Shape: UserAchievement[];
                Name: "UserAchievement";
                Nullable: false;
            };
        };
    };
    UserAchievement: {
        Name: "UserAchievement";
        Shape: UserAchievement;
        Include: Prisma.UserAchievementInclude;
        Select: Prisma.UserAchievementSelect;
        OrderBy: Prisma.UserAchievementOrderByWithRelationInput;
        WhereUnique: Prisma.UserAchievementWhereUniqueInput;
        Where: Prisma.UserAchievementWhereInput;
        Create: {};
        Update: {};
        RelationName: "user" | "achievement";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            achievement: {
                Shape: Achievement;
                Name: "Achievement";
                Nullable: false;
            };
        };
    };
    Trophy: {
        Name: "Trophy";
        Shape: Trophy;
        Include: Prisma.TrophyInclude;
        Select: Prisma.TrophySelect;
        OrderBy: Prisma.TrophyOrderByWithRelationInput;
        WhereUnique: Prisma.TrophyWhereUniqueInput;
        Where: Prisma.TrophyWhereInput;
        Create: {};
        Update: {};
        RelationName: "user" | "game";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            game: {
                Shape: Game;
                Name: "Game";
                Nullable: false;
            };
        };
    };
    PlaySession: {
        Name: "PlaySession";
        Shape: PlaySession;
        Include: Prisma.PlaySessionInclude;
        Select: Prisma.PlaySessionSelect;
        OrderBy: Prisma.PlaySessionOrderByWithRelationInput;
        WhereUnique: Prisma.PlaySessionWhereUniqueInput;
        Where: Prisma.PlaySessionWhereInput;
        Create: {};
        Update: {};
        RelationName: "user" | "game";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            game: {
                Shape: Game;
                Name: "Game";
                Nullable: false;
            };
        };
    };
    UserGame: {
        Name: "UserGame";
        Shape: UserGame;
        Include: Prisma.UserGameInclude;
        Select: Prisma.UserGameSelect;
        OrderBy: Prisma.UserGameOrderByWithRelationInput;
        WhereUnique: Prisma.UserGameWhereUniqueInput;
        Where: Prisma.UserGameWhereInput;
        Create: {};
        Update: {};
        RelationName: "user" | "game" | "platform" | "gameVersion";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            game: {
                Shape: Game;
                Name: "Game";
                Nullable: false;
            };
            platform: {
                Shape: Platform | null;
                Name: "Platform";
                Nullable: true;
            };
            gameVersion: {
                Shape: GameVersion | null;
                Name: "GameVersion";
                Nullable: true;
            };
        };
    };
    CollectionItem: {
        Name: "CollectionItem";
        Shape: CollectionItem;
        Include: Prisma.CollectionItemInclude;
        Select: Prisma.CollectionItemSelect;
        OrderBy: Prisma.CollectionItemOrderByWithRelationInput;
        WhereUnique: Prisma.CollectionItemWhereUniqueInput;
        Where: Prisma.CollectionItemWhereInput;
        Create: {};
        Update: {};
        RelationName: "user" | "game" | "bundle" | "platform" | "gameVersion" | "sellListItems";
        ListRelations: "sellListItems";
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            game: {
                Shape: Game | null;
                Name: "Game";
                Nullable: true;
            };
            bundle: {
                Shape: Bundle | null;
                Name: "Bundle";
                Nullable: true;
            };
            platform: {
                Shape: Platform | null;
                Name: "Platform";
                Nullable: true;
            };
            gameVersion: {
                Shape: GameVersion | null;
                Name: "GameVersion";
                Nullable: true;
            };
            sellListItems: {
                Shape: SellListItem[];
                Name: "SellListItem";
                Nullable: false;
            };
        };
    };
    DLC: {
        Name: "DLC";
        Shape: DLC;
        Include: Prisma.DLCInclude;
        Select: Prisma.DLCSelect;
        OrderBy: Prisma.DLCOrderByWithRelationInput;
        WhereUnique: Prisma.DLCWhereUniqueInput;
        Where: Prisma.DLCWhereInput;
        Create: {};
        Update: {};
        RelationName: "gameFamily" | "platforms" | "achievementSets" | "gameVersions" | "bundles" | "userDlcs" | "buylistItems";
        ListRelations: "platforms" | "achievementSets" | "gameVersions" | "bundles" | "userDlcs" | "buylistItems";
        Relations: {
            gameFamily: {
                Shape: GameFamily | null;
                Name: "GameFamily";
                Nullable: true;
            };
            platforms: {
                Shape: Platform[];
                Name: "Platform";
                Nullable: false;
            };
            achievementSets: {
                Shape: AchievementSet[];
                Name: "AchievementSet";
                Nullable: false;
            };
            gameVersions: {
                Shape: GameVersion[];
                Name: "GameVersion";
                Nullable: false;
            };
            bundles: {
                Shape: Bundle[];
                Name: "Bundle";
                Nullable: false;
            };
            userDlcs: {
                Shape: UserDLC[];
                Name: "UserDLC";
                Nullable: false;
            };
            buylistItems: {
                Shape: BuylistItem[];
                Name: "BuylistItem";
                Nullable: false;
            };
        };
    };
    UserDLC: {
        Name: "UserDLC";
        Shape: UserDLC;
        Include: Prisma.UserDLCInclude;
        Select: Prisma.UserDLCSelect;
        OrderBy: Prisma.UserDLCOrderByWithRelationInput;
        WhereUnique: Prisma.UserDLCWhereUniqueInput;
        Where: Prisma.UserDLCWhereInput;
        Create: {};
        Update: {};
        RelationName: "user" | "dlc";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            dlc: {
                Shape: DLC;
                Name: "DLC";
                Nullable: false;
            };
        };
    };
    Bundle: {
        Name: "Bundle";
        Shape: Bundle;
        Include: Prisma.BundleInclude;
        Select: Prisma.BundleSelect;
        OrderBy: Prisma.BundleOrderByWithRelationInput;
        WhereUnique: Prisma.BundleWhereUniqueInput;
        Where: Prisma.BundleWhereInput;
        Create: {};
        Update: {};
        RelationName: "platforms" | "gameFamilies" | "dlcs" | "buylistItems" | "collectionItems";
        ListRelations: "platforms" | "gameFamilies" | "dlcs" | "buylistItems" | "collectionItems";
        Relations: {
            platforms: {
                Shape: Platform[];
                Name: "Platform";
                Nullable: false;
            };
            gameFamilies: {
                Shape: GameFamily[];
                Name: "GameFamily";
                Nullable: false;
            };
            dlcs: {
                Shape: DLC[];
                Name: "DLC";
                Nullable: false;
            };
            buylistItems: {
                Shape: BuylistItem[];
                Name: "BuylistItem";
                Nullable: false;
            };
            collectionItems: {
                Shape: CollectionItem[];
                Name: "CollectionItem";
                Nullable: false;
            };
        };
    };
    BuylistItem: {
        Name: "BuylistItem";
        Shape: BuylistItem;
        Include: Prisma.BuylistItemInclude;
        Select: Prisma.BuylistItemSelect;
        OrderBy: Prisma.BuylistItemOrderByWithRelationInput;
        WhereUnique: Prisma.BuylistItemWhereUniqueInput;
        Where: Prisma.BuylistItemWhereInput;
        Create: {};
        Update: {};
        RelationName: "user" | "gameFamily" | "game" | "gameVersion" | "dlc" | "bundle";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            gameFamily: {
                Shape: GameFamily | null;
                Name: "GameFamily";
                Nullable: true;
            };
            game: {
                Shape: Game | null;
                Name: "Game";
                Nullable: true;
            };
            gameVersion: {
                Shape: GameVersion | null;
                Name: "GameVersion";
                Nullable: true;
            };
            dlc: {
                Shape: DLC | null;
                Name: "DLC";
                Nullable: true;
            };
            bundle: {
                Shape: Bundle | null;
                Name: "Bundle";
                Nullable: true;
            };
        };
    };
    SellListItem: {
        Name: "SellListItem";
        Shape: SellListItem;
        Include: Prisma.SellListItemInclude;
        Select: Prisma.SellListItemSelect;
        OrderBy: Prisma.SellListItemOrderByWithRelationInput;
        WhereUnique: Prisma.SellListItemWhereUniqueInput;
        Where: Prisma.SellListItemWhereInput;
        Create: {};
        Update: {};
        RelationName: "user" | "collectionItem";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            collectionItem: {
                Shape: CollectionItem;
                Name: "CollectionItem";
                Nullable: false;
            };
        };
    };
}
export function getDatamodel(): PothosPrismaDatamodel { return JSON.parse("{\"datamodel\":{\"models\":{\"User\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"clerkId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"email\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"UserRole\",\"kind\":\"enum\",\"name\":\"role\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"UserAchievement\",\"kind\":\"object\",\"name\":\"achievements\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserAchievement\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Trophy\",\"kind\":\"object\",\"name\":\"trophies\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TrophyToUser\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserGame\",\"kind\":\"object\",\"name\":\"userGames\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToUser\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"PlaySession\",\"kind\":\"object\",\"name\":\"playSessions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PlaySessionToUser\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSets\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetCreator\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserDLC\",\"kind\":\"object\",\"name\":\"ownedDlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserDLC\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"BuylistItem\",\"kind\":\"object\",\"name\":\"buylistItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToUser\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"SellListItem\",\"kind\":\"object\",\"name\":\"sellListItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"SellListItemToUser\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Platform\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"slug\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"consolePictureUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"promotionalPictures\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"games\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToPlatform\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Bundle\",\"kind\":\"object\",\"name\":\"bundles\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundlePlatforms\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCPlatforms\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToPlatform\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserGame\",\"kind\":\"object\",\"name\":\"userGames\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PlatformToUserGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"PlatformRelease\",\"kind\":\"object\",\"name\":\"releases\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PlatformToPlatformRelease\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"PlatformRelease\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"Platform\",\"kind\":\"object\",\"name\":\"platform\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PlatformToPlatformRelease\",\"relationFromFields\":[\"platformId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"platformId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"region\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"platformId\",\"region\"]}]},\"GameFamily\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"title\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"slug\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"searchTitle\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coverUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"developer\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"publisher\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"genre\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"esrbRating\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"screenshots\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameFamily\",\"kind\":\"object\",\"name\":\"baseGameFamilies\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameFamilyBaseGames\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"GameFamily\",\"kind\":\"object\",\"name\":\"derivedGameFamilies\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameFamilyBaseGames\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"games\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToGameFamily\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSets\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToGameFamily\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCToGameFamily\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Bundle\",\"kind\":\"object\",\"name\":\"bundles\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleGameFamilies\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"BuylistItem\",\"kind\":\"object\",\"name\":\"buylistItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToGameFamily\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Game\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"GameFamily\",\"kind\":\"object\",\"name\":\"gameFamily\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToGameFamily\",\"relationFromFields\":[\"gameFamilyId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameFamilyId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Platform\",\"kind\":\"object\",\"name\":\"platform\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToPlatform\",\"relationFromFields\":[\"platformId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"platformId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coverUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Trophy\",\"kind\":\"object\",\"name\":\"trophies\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToTrophy\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserGame\",\"kind\":\"object\",\"name\":\"userGames\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToUserGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"versions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionGames\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"GameVersionReleaseDate\",\"kind\":\"object\",\"name\":\"versionReleaseDates\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToGameVersionReleaseDate\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"BuylistItem\",\"kind\":\"object\",\"name\":\"buylistItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"PlaySession\",\"kind\":\"object\",\"name\":\"playSessions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToPlaySession\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"gameFamilyId\",\"platformId\"]}]},\"GameVersion\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"slug\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coverUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"isDefault\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"digitalOnly\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"games\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionGames\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"GameVersionReleaseDate\",\"kind\":\"object\",\"name\":\"versionReleaseDates\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionToGameVersionReleaseDate\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionDLCs\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSets\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToGameVersion\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserGame\",\"kind\":\"object\",\"name\":\"userGames\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionToUserGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToGameVersion\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"BuylistItem\",\"kind\":\"object\",\"name\":\"buylistItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToGameVersion\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"GameVersionReleaseDate\":{\"fields\":[{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToGameVersionReleaseDate\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersion\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionToGameVersionReleaseDate\",\"relationFromFields\":[\"gameVersionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameVersionId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false}],\"primaryKey\":{\"name\":null,\"fields\":[\"gameId\",\"gameVersionId\"]},\"uniqueIndexes\":[]},\"AchievementSet\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"title\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementSetType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementSetVisibility\",\"kind\":\"enum\",\"name\":\"visibility\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameFamily\",\"kind\":\"object\",\"name\":\"gameFamily\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToGameFamily\",\"relationFromFields\":[\"gameFamilyId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameFamilyId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersion\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToGameVersion\",\"relationFromFields\":[\"gameVersionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameVersionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlc\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToDLC\",\"relationFromFields\":[\"dlcId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"dlcId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"createdBy\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetCreator\",\"relationFromFields\":[\"createdByUserId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"createdByUserId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Achievement\",\"kind\":\"object\",\"name\":\"achievements\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementToAchievementSet\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"gameFamilyId\",\"title\",\"type\",\"createdByUserId\"]}]},\"Achievement\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"title\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"iconUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"points\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementTier\",\"kind\":\"enum\",\"name\":\"tier\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSet\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementToAchievementSet\",\"relationFromFields\":[\"achievementSetId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"achievementSetId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"UserAchievement\",\"kind\":\"object\",\"name\":\"users\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementToUserAchievement\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"achievementSetId\",\"title\"]}]},\"UserAchievement\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserAchievement\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Achievement\",\"kind\":\"object\",\"name\":\"achievement\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementToUserAchievement\",\"relationFromFields\":[\"achievementId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"achievementId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"achievementId\"]}]},\"Trophy\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TrophyToUser\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToTrophy\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"gameId\"]}]},\"PlaySession\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PlaySessionToUser\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToPlaySession\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"playedOn\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"minutes\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"UserGame\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserGame\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToUserGame\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Platform\",\"kind\":\"object\",\"name\":\"platform\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PlatformToUserGame\",\"relationFromFields\":[\"platformId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"platformId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersion\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionToUserGame\",\"relationFromFields\":[\"gameVersionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameVersionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"purchasePrice\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"purchasedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"gameId\"]}]},\"CollectionItem\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToUser\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToGame\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Bundle\",\"kind\":\"object\",\"name\":\"bundle\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleToCollectionItem\",\"relationFromFields\":[\"bundleId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"bundleId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Platform\",\"kind\":\"object\",\"name\":\"platform\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToPlatform\",\"relationFromFields\":[\"platformId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"platformId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersion\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToGameVersion\",\"relationFromFields\":[\"gameVersionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameVersionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"hasDisc\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"hasBox\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"hasManual\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"hasExtras\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"isDigital\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"isSealed\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameRegion\",\"kind\":\"enum\",\"name\":\"region\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"purchasePrice\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"purchasedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"SellListItem\",\"kind\":\"object\",\"name\":\"sellListItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToSellListItem\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"DLC\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"slug\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DLCType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coverUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"price\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameFamily\",\"kind\":\"object\",\"name\":\"gameFamily\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCToGameFamily\",\"relationFromFields\":[\"gameFamilyId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameFamilyId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Platform\",\"kind\":\"object\",\"name\":\"platforms\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCPlatforms\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSets\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToDLC\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionDLCs\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Bundle\",\"kind\":\"object\",\"name\":\"bundles\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleDLCs\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserDLC\",\"kind\":\"object\",\"name\":\"userDlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCToUserDLC\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"BuylistItem\",\"kind\":\"object\",\"name\":\"buylistItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToDLC\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"gameFamilyId\",\"slug\"]}]},\"UserDLC\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserDLC\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlc\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCToUserDLC\",\"relationFromFields\":[\"dlcId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"dlcId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"purchasePrice\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"purchasedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"ownedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"dlcId\"]}]},\"Bundle\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"slug\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"BundleType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coverUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"price\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Platform\",\"kind\":\"object\",\"name\":\"platforms\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundlePlatforms\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"GameFamily\",\"kind\":\"object\",\"name\":\"gameFamilies\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleGameFamilies\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleDLCs\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"BuylistItem\",\"kind\":\"object\",\"name\":\"buylistItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleToBuylistItem\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleToCollectionItem\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"BuylistItem\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameFamilyId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameVersionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"dlcId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"bundleId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"BuylistPriority\",\"kind\":\"enum\",\"name\":\"priority\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"estimatedPrice\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"addedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToUser\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"GameFamily\",\"kind\":\"object\",\"name\":\"gameFamily\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToGameFamily\",\"relationFromFields\":[\"gameFamilyId\"],\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToGame\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersion\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToGameVersion\",\"relationFromFields\":[\"gameVersionId\"],\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlc\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BuylistItemToDLC\",\"relationFromFields\":[\"dlcId\"],\"isUpdatedAt\":false},{\"type\":\"Bundle\",\"kind\":\"object\",\"name\":\"bundle\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleToBuylistItem\",\"relationFromFields\":[\"bundleId\"],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"gameFamilyId\",\"gameId\",\"gameVersionId\",\"dlcId\",\"bundleId\"]}]},\"SellListItem\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"collectionItemId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"askingPrice\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ItemCondition\",\"kind\":\"enum\",\"name\":\"condition\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"conditionNotes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"listingUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"SellListItemStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"salePrice\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"soldAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"addedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"SellListItemToUser\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItem\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToSellListItem\",\"relationFromFields\":[\"collectionItemId\"],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"collectionItemId\"]}]}}}}"); }