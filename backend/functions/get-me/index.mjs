import {
    DynamoDBClient,
    GetItemCommand
} from "@aws-sdk/client-dynamodb";
import {
    authSubject,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    notFound,
    requireActivePlayer,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client =
    new DynamoDBClient({});

const TABLE_NAME =
    process.env.TABLE_NAME;


// ======================================================
// LEVELING
// ======================================================

function xpRequiredForNextLevel(level) {

    return 100 + ((level - 1) * 50);
}


function getLevelFromXp(totalXp) {

    let level = 1;
    let remainingXp = totalXp;


    while (
        remainingXp >=
        xpRequiredForNextLevel(level)
    ) {

        remainingXp -=
            xpRequiredForNextLevel(level);

        level++;
    }


    const xpForNextLevel =
        xpRequiredForNextLevel(level);


    return {

        level,

        xpIntoLevel:
            remainingXp,

        xpForNextLevel,

        xpToNextLevel:
            xpForNextLevel -
            remainingXp
    };
}


// ======================================================
// HANDLER
// ======================================================

export const handler =
async (event) => {

    try {

        const userId = authSubject(event);


        if (!userId) {

            return unauthorized();
        }

        let profile;
        try {
            ({ profile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand));
        } catch (error) {
            return handleApiError(error, "Get profile active player check failed");
        }


        const totalXp =
            Number(
                profile.xp?.N ??
                0
            );


        const levelInfo =
            getLevelFromXp(
                totalXp
            );


        return response(
            200,
            {

                displayName:
                    profile
                        .displayName
                        ?.S
                    ??
                    "Adventurer",

                timeZone:
                    profile
                        .timeZone
                        ?.S
                    ??
                    "UTC",

                level:
                    levelInfo.level,

                xp:
                    totalXp,

                xpIntoLevel:
                    levelInfo.xpIntoLevel,

                xpForNextLevel:
                    levelInfo.xpForNextLevel,

                xpToNextLevel:
                    levelInfo.xpToNextLevel,

                coins:
                    Number(
                        profile
                            .coins
                            ?.N
                        ??
                        0
                    ),

                worldPoints:
                    Number(
                        profile
                            .worldPoints
                            ?.N
                        ??
                        0
                    ),

                tasksCompleted:
                    Number(
                        profile
                            .tasksCompleted
                            ?.N
                        ??
                        0
                    ),

                createdAt:
                    profile
                        .createdAt
                        ?.S
                    ??
                    null,

                updatedAt:
                    profile
                        .updatedAt
                        ?.S
                    ??
                    null,

                lastTaskCompletedAt:
                    profile
                        .lastTaskCompletedAt
                        ?.S
                    ??
                    null
            }
        );


    } catch (error) {

        return internalServerError("Get profile failed", error);
    }
};
