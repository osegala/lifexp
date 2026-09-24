import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import {
    disableDeviceRequest,
    validateDeviceId
} from "./logic.mjs";
import {
    authSubject,
    badRequest,
    internalServerError,
    noContent,
    notFound,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
export const handler = async (event) => {
    const userId = authSubject(event);
    const deviceId = event.pathParameters?.deviceId;
    if (!userId) return unauthorized();
    if (!validateDeviceId(deviceId)) return badRequest("VALIDATION_ERROR", "deviceId is invalid.");

    try {
        await client.send(new UpdateItemCommand(disableDeviceRequest(
            TABLE_NAME,
            userId,
            deviceId,
            new Date().toISOString()
        )));
        return noContent();
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            return notFound("DEVICE_NOT_FOUND", "Device not found.");
        }
        return internalServerError("Disable device failed", error);
    }
};
