type PdokDoc = {
  id?: unknown;
  weergavenaam?: unknown;
  straatnaam?: unknown;
  huisnummer?: unknown;
  huisletter?: unknown;
  huisnummertoevoeging?: unknown;
  postcode?: unknown;
  woonplaatsnaam?: unknown;
  adresseerbaarobject_id?: unknown;
  nummeraanduiding_id?: unknown;
  centroide_ll?: unknown;
};

type PdokResponse = {
  response?: {
    docs?: PdokDoc[];
  };
};

export type PdokAddressCandidate = {
  id: string;
  address: string;
  bagId: string | null;
  postcode: string | null;
  houseNumber: string | null;
  latitude: number | null;
  longitude: number | null;
};

type FindAddressCandidatesInput = {
  postcode: string;
  latitude: number;
  longitude: number;
};

const PDOK_FREE_SEARCH_URL =
  "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

export class PdokAddressService {
  async findAddressCandidates({
    postcode,
    latitude,
    longitude,
  }: FindAddressCandidatesInput): Promise<PdokAddressCandidate[]> {
    const normalizedPostcode = normalizePostcode(postcode);

    if (!normalizedPostcode) {
      return [];
    }

    const url = new URL(PDOK_FREE_SEARCH_URL);
    url.searchParams.set("q", normalizedPostcode);
    url.searchParams.append("fq", "type:adres");
    url.searchParams.append("fq", `postcode:${normalizedPostcode}`);
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("rows", "50");
    url.searchParams.set(
      "fl",
      [
        "id",
        "weergavenaam",
        "straatnaam",
        "huisnummer",
        "huisletter",
        "huisnummertoevoeging",
        "postcode",
        "woonplaatsnaam",
        "adresseerbaarobject_id",
        "nummeraanduiding_id",
        "centroide_ll",
      ].join(","),
    );

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`PDOK address lookup failed with status ${response.status}`);
    }

    const payload = (await response.json()) as PdokResponse;
    const docs = Array.isArray(payload.response?.docs)
      ? payload.response.docs
      : [];

    return docs.map(toAddressCandidate).filter((candidate) => candidate.address);
  }
}

function toAddressCandidate(doc: PdokDoc): PdokAddressCandidate {
  const coordinates = parsePoint(asString(doc.centroide_ll));
  const houseNumber = joinDefined([
    asString(doc.huisnummer),
    asString(doc.huisletter),
    asString(doc.huisnummertoevoeging),
  ]);

  return {
    id:
      asString(doc.id) ||
      joinDefined([asString(doc.nummeraanduiding_id), asString(doc.adresseerbaarobject_id)]),
    address:
      asString(doc.weergavenaam) ||
      formatAddress({
        street: asString(doc.straatnaam),
        houseNumber,
        postcode: asString(doc.postcode),
        city: asString(doc.woonplaatsnaam),
      }),
    bagId: asString(doc.adresseerbaarobject_id) || asString(doc.nummeraanduiding_id) || null,
    postcode: normalizePostcode(asString(doc.postcode)) || null,
    houseNumber: houseNumber || null,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
  };
}

function parsePoint(value: string): { latitude: number; longitude: number } | null {
  const match = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);

  if (!match) {
    return null;
  }

  const longitude = Number(match[1]);
  const latitude = Number(match[2]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function formatAddress({
  street,
  houseNumber,
  postcode,
  city,
}: {
  street: string;
  houseNumber: string;
  postcode: string;
  city: string;
}) {
  return [joinDefined([street, houseNumber]), joinDefined([postcode, city])]
    .filter(Boolean)
    .join(", ");
}

function joinDefined(values: string[]) {
  return values.filter(Boolean).join(" ").trim();
}

function asString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function normalizePostcode(value: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(compact) ? compact : "";
}
