function ApiResponseHandler(statusCode, data, message = "Success") {
    return {
        statusCode: statusCode,
        data: data,
        message: message,
        success: statusCode < 400
    };
}

module.export = ApiResponseHandler;
