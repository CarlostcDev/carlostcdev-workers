import {AeroDataBoxAirport} from "./aerodatabox-airport";

export interface AeroDataBoxAirportSearchResponse {
	searchBy?: {
		lat?: number;
		lon?: number;
	};
	count?: number;
	items?: AeroDataBoxAirport[];
}
