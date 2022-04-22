export class HttpError extends Error {
	public statusCode: number;

	constructor(message: string, statusCode = 400) {
		super(message);

		this.statusCode = statusCode;
	}
}
