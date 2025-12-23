export class ErrorHandler extends Error {
    constructor(statusCode, exception) {
        super();
        this.statusCode = statusCode;
        this.message = exception.message;
    }
}

export const handleError = (err, res) => {
    const { statusCode, message } = err;
    res.status(statusCode).json({
        status: "error",
        statusCode,
        message
    });
};