/* eslint-disable */
import type { Prisma, User, Platform, Game, GameVersion, AchievementSet, Achievement, UserAchievement, Trophy, UserGame, CollectionItem, DLC, UserDLC, Bundle, UserBundle } from "@prisma/client";
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
        RelationName: "achievements" | "trophies" | "userGames" | "collectionItems" | "achievementSets" | "ownedDlcs" | "ownedBundles";
        ListRelations: "achievements" | "trophies" | "userGames" | "collectionItems" | "achievementSets" | "ownedDlcs" | "ownedBundles";
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
            ownedBundles: {
                Shape: UserBundle[];
                Name: "UserBundle";
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
        RelationName: "games" | "collectionItems" | "userGames";
        ListRelations: "games" | "collectionItems" | "userGames";
        Relations: {
            games: {
                Shape: Game[];
                Name: "Game";
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
        RelationName: "platform" | "achievementSets" | "trophies" | "userGames" | "collectionItems" | "versions" | "dlcs" | "bundles";
        ListRelations: "achievementSets" | "trophies" | "userGames" | "collectionItems" | "versions" | "dlcs" | "bundles";
        Relations: {
            platform: {
                Shape: Platform | null;
                Name: "Platform";
                Nullable: true;
            };
            achievementSets: {
                Shape: AchievementSet[];
                Name: "AchievementSet";
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
            versions: {
                Shape: GameVersion[];
                Name: "GameVersion";
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
        RelationName: "game" | "dlcs" | "achievementSets" | "userGames" | "collectionItems";
        ListRelations: "dlcs" | "achievementSets" | "userGames" | "collectionItems";
        Relations: {
            game: {
                Shape: Game;
                Name: "Game";
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
        RelationName: "game" | "gameVersion" | "dlc" | "createdBy" | "achievements";
        ListRelations: "achievements";
        Relations: {
            game: {
                Shape: Game;
                Name: "Game";
                Nullable: false;
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
        RelationName: "game" | "achievementSets" | "gameVersions" | "bundles" | "userDlcs";
        ListRelations: "achievementSets" | "gameVersions" | "bundles" | "userDlcs";
        Relations: {
            game: {
                Shape: Game;
                Name: "Game";
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
        RelationName: "games" | "dlcs" | "userBundles";
        ListRelations: "games" | "dlcs" | "userBundles";
        Relations: {
            games: {
                Shape: Game[];
                Name: "Game";
                Nullable: false;
            };
            dlcs: {
                Shape: DLC[];
                Name: "DLC";
                Nullable: false;
            };
            userBundles: {
                Shape: UserBundle[];
                Name: "UserBundle";
                Nullable: false;
            };
        };
    };
    UserBundle: {
        Name: "UserBundle";
        Shape: UserBundle;
        Include: Prisma.UserBundleInclude;
        Select: Prisma.UserBundleSelect;
        OrderBy: Prisma.UserBundleOrderByWithRelationInput;
        WhereUnique: Prisma.UserBundleWhereUniqueInput;
        Where: Prisma.UserBundleWhereInput;
        Create: {};
        Update: {};
        RelationName: "user" | "bundle";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            bundle: {
                Shape: Bundle;
                Name: "Bundle";
                Nullable: false;
            };
        };
    };
}
export function getDatamodel(): PothosPrismaDatamodel { return JSON.parse("{\"datamodel\":{\"models\":{\"User\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"clerkId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"email\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"UserRole\",\"kind\":\"enum\",\"name\":\"role\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"UserAchievement\",\"kind\":\"object\",\"name\":\"achievements\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserAchievement\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Trophy\",\"kind\":\"object\",\"name\":\"trophies\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TrophyToUser\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserGame\",\"kind\":\"object\",\"name\":\"userGames\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToUser\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSets\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetCreator\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserDLC\",\"kind\":\"object\",\"name\":\"ownedDlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserDLC\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserBundle\",\"kind\":\"object\",\"name\":\"ownedBundles\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserBundle\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Platform\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"slug\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"games\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToPlatform\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToPlatform\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserGame\",\"kind\":\"object\",\"name\":\"userGames\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PlatformToUserGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Game\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"title\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coverUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"developer\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"publisher\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"genre\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"esrbRating\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"screenshots\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Platform\",\"kind\":\"object\",\"name\":\"platform\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToPlatform\",\"relationFromFields\":[\"platformId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"platformId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSets\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Trophy\",\"kind\":\"object\",\"name\":\"trophies\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToTrophy\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserGame\",\"kind\":\"object\",\"name\":\"userGames\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToUserGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"versions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToGameVersion\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCToGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Bundle\",\"kind\":\"object\",\"name\":\"bundles\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleGames\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"title\",\"platformId\"]}]},\"GameVersion\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"slug\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coverUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"isDefault\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToGameVersion\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionDLCs\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSets\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToGameVersion\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserGame\",\"kind\":\"object\",\"name\":\"userGames\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionToUserGame\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"CollectionItem\",\"kind\":\"object\",\"name\":\"collectionItems\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToGameVersion\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"gameId\",\"slug\"]}]},\"AchievementSet\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"title\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementSetType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementSetVisibility\",\"kind\":\"enum\",\"name\":\"visibility\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToGame\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersion\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToGameVersion\",\"relationFromFields\":[\"gameVersionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameVersionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlc\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToDLC\",\"relationFromFields\":[\"dlcId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"dlcId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"createdBy\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetCreator\",\"relationFromFields\":[\"createdByUserId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"createdByUserId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Achievement\",\"kind\":\"object\",\"name\":\"achievements\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementToAchievementSet\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"gameId\",\"title\",\"type\",\"createdByUserId\"]}]},\"Achievement\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"title\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"iconUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"points\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementTier\",\"kind\":\"enum\",\"name\":\"tier\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSet\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementToAchievementSet\",\"relationFromFields\":[\"achievementSetId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"achievementSetId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"UserAchievement\",\"kind\":\"object\",\"name\":\"users\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementToUserAchievement\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"achievementSetId\",\"title\"]}]},\"UserAchievement\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserAchievement\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Achievement\",\"kind\":\"object\",\"name\":\"achievement\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementToUserAchievement\",\"relationFromFields\":[\"achievementId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"achievementId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"achievementId\"]}]},\"Trophy\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TrophyToUser\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToTrophy\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"gameId\"]}]},\"UserGame\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserGame\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameToUserGame\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Platform\",\"kind\":\"object\",\"name\":\"platform\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PlatformToUserGame\",\"relationFromFields\":[\"platformId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"platformId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersion\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionToUserGame\",\"relationFromFields\":[\"gameVersionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameVersionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"gameId\"]}]},\"CollectionItem\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToUser\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToGame\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Platform\",\"kind\":\"object\",\"name\":\"platform\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToPlatform\",\"relationFromFields\":[\"platformId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"platformId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersion\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"CollectionItemToGameVersion\",\"relationFromFields\":[\"gameVersionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameVersionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"hasDisc\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"hasBox\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"hasManual\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"hasExtras\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"isSealed\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"GameRegion\",\"kind\":\"enum\",\"name\":\"region\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"DLC\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"slug\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DLCType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coverUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"price\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"game\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCToGame\",\"relationFromFields\":[\"gameId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"gameId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AchievementSet\",\"kind\":\"object\",\"name\":\"achievementSets\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"AchievementSetToDLC\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"GameVersion\",\"kind\":\"object\",\"name\":\"gameVersions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"GameVersionDLCs\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Bundle\",\"kind\":\"object\",\"name\":\"bundles\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleDLCs\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserDLC\",\"kind\":\"object\",\"name\":\"userDlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCToUserDLC\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"gameId\",\"slug\"]}]},\"UserDLC\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserDLC\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlc\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DLCToUserDLC\",\"relationFromFields\":[\"dlcId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"dlcId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"ownedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"dlcId\"]}]},\"Bundle\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"slug\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"BundleType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coverUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"releaseDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"price\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Game\",\"kind\":\"object\",\"name\":\"games\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleGames\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DLC\",\"kind\":\"object\",\"name\":\"dlcs\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleDLCs\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"UserBundle\",\"kind\":\"object\",\"name\":\"userBundles\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleToUserBundle\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"UserBundle\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"UserToUserBundle\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Bundle\",\"kind\":\"object\",\"name\":\"bundle\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BundleToUserBundle\",\"relationFromFields\":[\"bundleId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"bundleId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"ownedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"userId\",\"bundleId\"]}]}}}}"); }