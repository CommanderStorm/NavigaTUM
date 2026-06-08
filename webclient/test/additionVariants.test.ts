import { describe, expect, it } from "vitest";
import {
  additionVariants,
  buildAddition,
  emptyAdditionDraft,
  emptyDraftFor,
  isAdditionValid,
  validateAddition,
} from "../app/composables/additionVariants";

// These cover the discriminated-union registry end to end: for every kind we exercise the same
// `empty -> validate -> build` path the modal drives, plus the unselected state and the kind switch.
// They intentionally mirror the Rust validator rstest tables (see `additionSchema.ts`), so a backend
// rule change that desyncs the Zod schema should surface here.

// Coordinates the user has confirmed on the map. `picked` gates `coordsSchema`.
const PICKED_COORDS = { lat: 48.149, lon: 11.568, picked: true };

describe("emptyAdditionDraft (unselected)", () => {
  it("starts with no kind and never validates or builds", () => {
    const draft = emptyAdditionDraft();
    expect(draft.kind).toBeNull();
    expect(isAdditionValid(draft)).toBe(false);
    // No kind means nothing to validate yet, so the modal shows no field errors.
    expect(validateAddition(draft)).toEqual({});
    expect(buildAddition(draft)).toBeNull();
  });
});

describe("room variant", () => {
  function validRoomDraft() {
    return {
      ...additionVariants.room.empty(),
      id: "5510.01.001",
      parent_id: "5510",
      alt_name: "Lecture Hall 1",
      arch_name: "001@5510",
      usage_id: 4,
      coords: { ...PICKED_COORDS },
    };
  }

  it("seeds an empty room draft that fails validation", () => {
    const draft = additionVariants.room.empty();
    expect(draft.kind).toBe("room");
    expect(isAdditionValid(draft)).toBe(false);
    // Empty required fields each surface their own error key.
    expect(validateAddition(draft)).toMatchObject({
      id: expect.any(String),
      parent_id: expect.any(String),
      alt_name: expect.any(String),
      arch_name: expect.any(String),
      usage_id: expect.any(String),
      "coords.picked": expect.any(String),
    });
  });

  it("validates and builds a complete room draft", () => {
    const draft = validRoomDraft();
    expect(validateAddition(draft)).toEqual({});
    expect(isAdditionValid(draft)).toBe(true);
    expect(buildAddition(draft)).toEqual({
      kind: "room",
      parent_building_id: "5510",
      alt_name: "Lecture Hall 1",
      arch_name: "001@5510",
      usage_id: 4,
      coords: { lat: 48.149, lon: 11.568 },
      // No seats entered, so the whole block is omitted rather than sent as zeros.
      seats: null,
      floor_type: null,
      floor_level: null,
      address: null,
      links: undefined,
    });
  });

  it("includes seats and links only once the user fills them", () => {
    const built = buildAddition({
      ...validRoomDraft(),
      seats: { sitting: 120, standing: null, wheelchair: 2 },
      floor_type: "ground",
      // The blank-url row is dropped; only the real link survives.
      room_links: [
        { text_de: "", text_en: "", url: "" },
        { text_de: "Plan", text_en: "Plan", url: "https://example.org" },
      ],
    });
    expect(built).toMatchObject({
      seats: { sitting: 120, standing: null, wheelchair: 2 },
      floor_type: "ground",
      links: [{ text_de: "Plan", text_en: "Plan", url: "https://example.org" }],
    });
  });

  it("rejects a malformed arch name", () => {
    const errors = validateAddition({ ...validRoomDraft(), arch_name: "no-at-sign" });
    expect(errors.arch_name).toBe("error.arch_name_format");
  });
});

describe("building variant", () => {
  function validBuildingDraft() {
    return {
      ...additionVariants.building.empty(),
      id: "5510",
      parent_id: "mi",
      name: "Mathematik & Informatik",
      node_kind: "building" as const,
      building_prefixes: ["5510"],
      coords: { ...PICKED_COORDS },
    };
  }

  it("seeds an empty building draft that fails validation", () => {
    const draft = additionVariants.building.empty();
    expect(draft.kind).toBe("building");
    expect(isAdditionValid(draft)).toBe(false);
  });

  it("validates and builds a complete building draft", () => {
    const draft = validBuildingDraft();
    expect(validateAddition(draft)).toEqual({});
    expect(buildAddition(draft)).toEqual({
      kind: "building",
      parent_id: "mi",
      name: "Mathematik & Informatik",
      short_name: null,
      node_kind: "building",
      building_prefixes: ["5510"],
      internal_id: null,
      visible_id: null,
      coords: { lat: 48.149, lon: 11.568 },
    });
  });

  it("requires exactly one prefix for a plain building", () => {
    const errors = validateAddition({
      ...validBuildingDraft(),
      building_prefixes: ["5510", "5512"],
    });
    expect(errors.building_prefixes).toBe("error.building_needs_one_prefix");
  });

  it("requires multiple prefixes for a joined building", () => {
    const errors = validateAddition({
      ...validBuildingDraft(),
      node_kind: "joined_building",
      building_prefixes: ["5510"],
    });
    expect(errors.building_prefixes).toBe("error.joined_building_needs_multi_prefix");
  });

  it("returns no payload while the node kind is still unset", () => {
    // `build` guards the one field validation cannot default: an unset node kind yields null,
    // which the modal treats as "incomplete".
    const draft = { ...validBuildingDraft(), node_kind: null };
    expect(buildAddition(draft)).toBeNull();
  });
});

describe("poi variant", () => {
  function validPoiDraft() {
    return {
      ...additionVariants.poi.empty(),
      id: "mensa-arcisstr",
      parent_id: "mi",
      name: "Mensa",
      usage_name: "Cafeteria",
      coords: { ...PICKED_COORDS },
    };
  }

  it("seeds an empty poi draft that fails validation", () => {
    const draft = additionVariants.poi.empty();
    expect(draft.kind).toBe("poi");
    expect(isAdditionValid(draft)).toBe(false);
  });

  it("validates and builds a complete poi draft", () => {
    const draft = validPoiDraft();
    expect(validateAddition(draft)).toEqual({});
    expect(buildAddition(draft)).toEqual({
      kind: "poi",
      parent: "mi",
      name: "Mensa",
      usage_name: "Cafeteria",
      coords: { lat: 48.149, lon: 11.568 },
      comment: null,
      links: undefined,
      generic_props: undefined,
    });
  });

  it("keeps a comment and only the filled generic props", () => {
    const built = buildAddition({
      ...validPoiDraft(),
      comment_de: "Hauptmensa",
      comment_en: "",
      generic_props: [
        { name_de: "", name_en: "", text: "" },
        { name_de: "Plätze", name_en: "Seats", text: "1000" },
      ],
    });
    expect(built).toMatchObject({
      comment: { de: "Hauptmensa", en: "" },
      generic_props: [{ name: { de: "Plätze", en: "Seats" }, text: "1000" }],
    });
  });

  it("rejects an upper-case poi key", () => {
    const errors = validateAddition({ ...validPoiDraft(), id: "Mensa" });
    expect(errors.id).toBe("error.poi_key_format");
  });
});

describe("emptyDraftFor", () => {
  it("returns each kind's own empty draft", () => {
    for (const kind of ["room", "building", "poi"] as const) {
      const draft = emptyDraftFor(kind);
      expect(draft.kind).toBe(kind);
      // A freshly selected kind is never immediately valid - required fields are still blank.
      expect(isAdditionValid(draft)).toBe(false);
    }
  });
});
