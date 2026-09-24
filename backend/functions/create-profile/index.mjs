import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { isDuplicateProfileError, profilePutRequest } from "./logic.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event, context) => {
    try {
        await client.send(new PutItemCommand(profilePutRequest(TABLE_NAME, event)));
    } catch (error) {
        if (!isDuplicateProfileError(error)) {
            console.error({
                level: "ERROR",
                event: "UNEXPECTED_ERROR",
                function: process.env.AWS_LAMBDA_FUNCTION_NAME ?? "unknown",
                requestId: context?.awsRequestId ?? null,
                message: "Create profile failed.",
                errorName: typeof error?.name === "string" ? error.name : "Error"
            });
            throw error;
        }
    }

    return event;
};
