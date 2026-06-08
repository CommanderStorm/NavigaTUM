// The "propose a new entry" draft, modelled as a discriminated union on `kind`. Each variant owns
// only its own fields, and each variant's `empty`/`schema`/`build` live together in the
// `additionVariants` registry below. Adding a fifth kind is one new variant plus one registry
// entry - no scattered `switch`es to keep in sync. `validateAddition`/`buildAddition` are pure
// registry lookups, so they never re-derive "which subset is mine".
import type { z } from "zod";
import type { components } from "~/api_types";
import { newBuildingSchema, newPoiSchema, newRoomSchema } from "~/composables/additionSchema";

type BuildingKind = components["schemas"]["BuildingKind"];
// One value of the addition map the backend accepts; what each variant's `build` produces.
type AdditionPayload = components["schemas"]["LimitedHashMap_String_Addition"][string];

type AdditionKind = "room" | "building" | "poi";

interface LinkDraft {
  text_de: string;
  text_en: string;
  url: string;
}
interface GenericPropDraft {
  name_de: string;
  name_en: string;
  text: string;
}
interface SeatsDraft {
  sitting: number | null;
  standing: number | null;
  wheelchair: number | null;
}
interface CoordsDraft {
  lat: number;
  lon: number;
  picked: boolean;
}

// Fields every addition carries regardless of kind. Kept on the union (including the unselected
// state) so the modal can bind id/parent/coords without first narrowing on `kind`.
interface AdditionDraftBase {
  id: string;
  parent_id: string;
  parent_name: string;
  coords: CoordsDraft;
}

// The initial state before the user picks a kind. A real variant once a tab is chosen.
interface UnselectedAdditionDraft extends AdditionDraftBase {
  kind: null;
}
interface RoomDraft extends AdditionDraftBase {
  kind: "room";
  alt_name: string;
  arch_name: string;
  usage_id: number | null;
  floor_type: string;
  floor_level: string;
  seats: SeatsDraft;
  room_links: LinkDraft[];
}
interface BuildingDraft extends AdditionDraftBase {
  kind: "building";
  name: string;
  short_name: string;
  node_kind: BuildingKind | null;
  building_prefixes: string[];
  internal_id: string;
  visible_id: string;
}
interface PoiDraft extends AdditionDraftBase {
  kind: "poi";
  name: string;
  usage_name: string;
  comment_de: string;
  comment_en: string;
  poi_links: LinkDraft[];
  generic_props: GenericPropDraft[];
}

type AdditionDraft = UnselectedAdditionDraft | RoomDraft | BuildingDraft | PoiDraft;

// Maps a kind to its variant draft, so callers can request a single narrowed variant by key.
interface AdditionDraftByKind {
  room: RoomDraft;
  building: BuildingDraft;
  poi: PoiDraft;
}
type DraftFor<K extends AdditionKind> = AdditionDraftByKind[K];

interface AdditionVariant<D extends AdditionDraft> {
  // Seeds a draft for this kind with empty/default field values.
  empty(): D;
  // The Zod validator for this kind, mirroring the backend rules (see `additionSchema.ts`).
  schema: z.ZodType;
  // Maps a draft to the API payload, or `null` while a still-required field is unset.
  build(draft: D): AdditionPayload | null;
}

function emptyAdditionBase(): AdditionDraftBase {
  return { id: "", parent_id: "", parent_name: "", coords: { lat: 0, lon: 0, picked: false } };
}

export const additionVariants: { readonly [K in AdditionKind]: AdditionVariant<DraftFor<K>> } = {
  room: {
    empty: () => ({
      kind: "room",
      ...emptyAdditionBase(),
      alt_name: "",
      arch_name: "",
      usage_id: null,
      floor_type: "",
      floor_level: "",
      seats: { sitting: null, standing: null, wheelchair: null },
      room_links: [],
    }),
    schema: newRoomSchema,
    build: (draft) => {
      const seats =
        draft.seats.sitting !== null ||
        draft.seats.standing !== null ||
        draft.seats.wheelchair !== null
          ? { ...draft.seats }
          : null;
      const links = draft.room_links.filter((l) => l.url.trim());
      return {
        kind: "room",
        parent_building_id: draft.parent_id,
        alt_name: draft.alt_name,
        arch_name: draft.arch_name,
        usage_id: draft.usage_id as number,
        coords: { lat: draft.coords.lat, lon: draft.coords.lon },
        seats,
        floor_type: draft.floor_type || null,
        floor_level: draft.floor_level || null,
        // Address omitted on purpose: the server inherits it from the parent building.
        address: null,
        links: links.length ? links : undefined,
      } as AdditionPayload;
    },
  },
  building: {
    empty: () => ({
      kind: "building",
      ...emptyAdditionBase(),
      name: "",
      short_name: "",
      node_kind: null,
      building_prefixes: [],
      internal_id: "",
      visible_id: "",
    }),
    schema: newBuildingSchema,
    build: (draft) => {
      if (!draft.node_kind) return null;
      return {
        kind: "building",
        parent_id: draft.parent_id,
        name: draft.name,
        short_name: draft.short_name || null,
        node_kind: draft.node_kind,
        building_prefixes: [...draft.building_prefixes],
        internal_id: draft.internal_id || null,
        visible_id: draft.visible_id || null,
        coords: { lat: draft.coords.lat, lon: draft.coords.lon },
      } as AdditionPayload;
    },
  },
  poi: {
    empty: () => ({
      kind: "poi",
      ...emptyAdditionBase(),
      name: "",
      usage_name: "",
      comment_de: "",
      comment_en: "",
      poi_links: [],
      generic_props: [],
    }),
    schema: newPoiSchema,
    build: (draft) => {
      const links = draft.poi_links
        .filter((l) => l.url.trim())
        .map((l) => ({ url: l.url, text: { de: l.text_de, en: l.text_en } }));
      const generic_props = draft.generic_props
        .filter((p) => p.name_de.trim() || p.name_en.trim() || p.text.trim())
        .map((p) => ({ name: { de: p.name_de, en: p.name_en }, text: p.text }));
      const comment =
        draft.comment_de.trim() || draft.comment_en.trim()
          ? { de: draft.comment_de, en: draft.comment_en }
          : null;
      return {
        kind: "poi",
        parent: draft.parent_id,
        name: draft.name,
        usage_name: draft.usage_name,
        coords: { lat: draft.coords.lat, lon: draft.coords.lon },
        comment,
        links: links.length ? links : undefined,
        generic_props: generic_props.length ? generic_props : undefined,
      } as AdditionPayload;
    },
  },
};

export function emptyAdditionDraft(): UnselectedAdditionDraft {
  return { kind: null, ...emptyAdditionBase() };
}

export function emptyDraftFor(kind: AdditionKind): AdditionDraft {
  return additionVariants[kind].empty();
}

export type AdditionFieldErrors = Partial<Record<string, string>>;

export function validateAddition(draft: AdditionDraft): AdditionFieldErrors {
  if (draft.kind === null) return {};
  const result = additionVariants[draft.kind].schema.safeParse(draft);
  if (result.success) return {};
  const errors: AdditionFieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_";
    if (!errors[path]) errors[path] = issue.message;
  }
  return errors;
}

export function isAdditionValid(draft: AdditionDraft): boolean {
  if (draft.kind === null) return false;
  return additionVariants[draft.kind].schema.safeParse(draft).success;
}

export function buildAddition(draft: AdditionDraft): AdditionPayload | null {
  if (draft.kind === null) return null;
  // `draft.kind` selects the variant, so its `build` accepts this exact draft at runtime. The cast
  // only re-states a correlation TypeScript drops once the kind index widens the draft union.
  const build = additionVariants[draft.kind].build as (
    draft: AdditionDraft
  ) => AdditionPayload | null;
  return build(draft);
}

export type {
  AdditionDraft,
  AdditionKind,
  BuildingDraft,
  CoordsDraft,
  DraftFor,
  GenericPropDraft,
  LinkDraft,
  PoiDraft,
  RoomDraft,
  SeatsDraft,
  UnselectedAdditionDraft,
};
