export const getOpenApiSpec = (url: URL) => ({
	openapi: "3.0.3",
	info: {
		title: "FIDS API",
		description: "API for the Flight Information Display System.",
		version: "1.0.0"
	},
	servers: [{url: url.origin}],
	paths: {
		"/airports": {
			get: {
				summary: "Get airports",
				description: "Returns all airports with an IATA code.",
				operationId: "getAirports",
				responses: {
					"200": {
						description: "List of airports",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: {$ref: "#/components/schemas/Airport"}
								}
							}
						}
					}
				}
			}
		},
		"/nearby-airports": {
			get: {
				summary: "Get nearby airports",
				description: "Returns commercial airports within 200 km of the approximate client location determined from the client IP address.",
				operationId: "getNearbyAirports",
				responses: {
					"200": {
						description: "List of nearby airports",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: {$ref: "#/components/schemas/Airport"}
								}
							}
						}
					},
					"400": {
						description: "Unable to determine client IP address"
					}
				}
			}
		},
		"/schedules": {
			get: {
				summary: "Get flight schedules",
				description: "Returns departures and arrivals from AeroDataBox using a relative 12-hour time range starting from the current time.",
				operationId: "getSchedules",
				parameters: [
					{name: "dep_iata", in: "query", required: false, description: "Departure airport IATA code.", schema: {type: "string", pattern: "^[A-Za-z]{3}$", example: "MAD"}},
					{name: "arr_iata", in: "query", required: false, description: "Arrival airport IATA code.", schema: {type: "string", pattern: "^[A-Za-z]{3}$", example: "MAD"}}
				],
				responses: {
					"200": {description: "AeroDataBox flight schedules"},
					"400": {description: "Invalid parameters"}
				}
			}
		}
	},
	components: {
		schemas: {
			Airport: {
				type: "object",
				properties: {
					iata_code: {type: "string", example: "ALC"},
					name: {type: "string", example: "Alicante-Elche Airport"},
					city: {type: "string", example: "Alicante"}
				}
			}
		}
	}
});
