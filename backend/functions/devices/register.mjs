import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import {
    DeviceError,
    deviceResponse,
    registerDeviceRequest,
    validateRegistration
} from "./logic.mjs";
import {
    authSubject,
    badRequest,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    parseJsonBody,
    requireActivePlayer,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();
    try {
        await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand);
    } catch (error) {
        return handleApiError(error, "Register device active player check failed");
    }

    let body;
    try { body = parseJsonBody(event); }
    catch (error) { return handleApiError(error, "Register device JSON parsing failed"); }

    try {
        const registration = validateRegistration(body);
        const result = await client.send(new UpdateItemCommand(registerDeviceRequest(
            TABLE_NAME,
            userId,
            registration,
            new Date().toISOString()
        )));
        return response(200, { device: deviceResponse(result.Attributes) });
    } catch (error) {
        if (error instanceof DeviceError) return badRequest(error.code, error.message);
        return internalServerError("Register device failed", error);
    }
};
