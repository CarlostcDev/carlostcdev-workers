export interface AeroDataBoxAirport {
	icao?: string | null;
	iata?: string | null;
	localCode?: string | null;
	name: string;
	shortName?: string | null;
	municipalityName?: string | null;
	location?: {
		lat: number;
		lon: number;
	};
	countryCode?: string | null;
	timeZone?: string | null;
}
