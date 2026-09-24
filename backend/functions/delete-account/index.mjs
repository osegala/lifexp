import {
    BatchWriteItemCommand,
    DynamoDBClient,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import {
    AdminDeleteUserCommand,
    CognitoIdentityProviderClient
} from "@aws-sdk/client-cognito-identity-provider";
import {
    authSubject,
    internalServerError,
    noContent,
    unauthorized
} from "/opt/nodejs/http.mjs";
import {
    cognitoUsername,
    deleteUserPartition,
    executeAccountDeletion
} from "./logic.mjs";

const dynamodb = new DynamoDBClient({});
const cognito = new CognitoIdentityProviderClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const USER_POOL_ID = process.env.USER_POOL_ID;

function log(level, event, context, details = {}) {
    const record = {
        level,
        event,
        function: process.env.AWS_LAMBDA_FUNCTION_NAME ?? "unknown",
        requestId: context?.awsRequestId ?? null,
        ...details
    };
    if (level === "ERROR") console.error(record);
    else console.info(record);
}

export const handler = async (event, context) => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();

    const username = cognitoUsername(event, userId);
    let stage = "APPLICATION_DATA";
    log("INFO", "ACCOUNT_DELETION_STARTED", context);

    try {
        await executeAccountDeletion({
            deleteApplicationData: async () => {
                const deletedRecords = await deleteUserPartition({
                    tableName: TABLE_NAME,
                    userId,
                    queryPage: (request) => dynamodb.send(new QueryCommand(request)),
                    writeBatch: (request) => dynamodb.send(new BatchWriteItemCommand(request))
                });
                log("INFO", "ACCOUNT_APPLICATION_DATA_DELETED", context, { deletedRecords });
                stage = "COGNITO";
            },
            deleteCognitoIdentity: async () => {
                try {
                    await cognito.send(new AdminDeleteUserCommand({
                        UserPoolId: USER_POOL_ID,
                        Username: username
                    }));
                } catch (error) {
                    if (error?.name !== "UserNotFoundException") throw error;
                }
                log("INFO", "ACCOUNT_COGNITO_IDENTITY_DELETED", context);
            }
        });
        return noContent();
    } catch (error) {
        log("ERROR", "ACCOUNT_DELETION_FAILED", context, {
            stage,
            errorName: typeof error?.name === "string" ? error.name : "Error"
        });
        return internalServerError("Account deletion failed", error);
    }
};
