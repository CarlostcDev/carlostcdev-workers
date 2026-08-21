export interface Flight {
	departure?: {
		scheduledTime?: {
			utc?: string;
			local?: string;
		};
		revisedTime?: {
			utc?: string;
			local?: string;
		};
	};
	arrival?: {
		scheduledTime?: {
			utc?: string;
			local?: string;
		};
		revisedTime?: {
			utc?: string;
			local?: string;
		};
	};
	number?: string;
	status?: string;
	codeshareStatus?: string;
	airline?: {
		iata?: string;
		icao?: string;
	};
}
