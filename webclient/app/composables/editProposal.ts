import type { DeepWritable } from "ts-essentials";
import type { ComputedRef } from "vue";
import type { components } from "~/api_types";
import {
  type AdditionDraft,
  type AdditionKind,
  additionVariants,
  type DraftFor,
  emptyAdditionDraft,
} from "~/composables/additionVariants";

type EditRequest = components["schemas"]["EditRequest"];
type EditRequestData = Omit<EditRequest, "privacy_checked" | "token" | "edits" | "additions"> & {
  edits: NonNullable<EditRequest["edits"]>;
  additions: NonNullable<EditRequest["additions"]>;
};

interface PropertyFields {
  name: string;
  shortName: string;
  categoryDe: string;
  categoryEn: string;
  categoryDin277: string;
  categoryDin277Desc: string;
  linkUrl: string;
  linkTextDe: string;
  linkTextEn: string;
}
interface EditProposalState {
  open: boolean;
  addOpen: boolean;
  selected: {
    id: string | null;
    name: string | null;
  };
  data: DeepWritable<EditRequestData>;
  locationPicker: {
    open: boolean;
    lat: number;
    lon: number;
    floors: number[];
    floor: number | null;
  };
  imageUpload: {
    open: boolean;
    selectedFile: {
      base64: string;
      fileName: string;
    } | null;
    metadata: DeepWritable<components["schemas"]["ImageMetadata"]>;
  };
  propertyFields: PropertyFields;
  originalPropertyFields: PropertyFields;
  pendingAddition: AdditionDraft;
}

function emptyPropertyFields(): PropertyFields {
  return {
    name: "",
    shortName: "",
    categoryDe: "",
    categoryEn: "",
    categoryDin277: "",
    categoryDin277Desc: "",
    linkUrl: "",
    linkTextDe: "",
    linkTextEn: "",
  };
}

export const useEditProposal = () =>
  useState<EditProposalState>("editProposal", () => ({
    open: false,
    addOpen: false,
    selected: {
      id: null,
      name: null,
    },
    data: {
      additional_context: "",
      edits: {},
      additions: {},
    },
    locationPicker: {
      open: false,
      lat: 0,
      lon: 0,
      floors: [],
      floor: null,
    },
    imageUpload: {
      open: false,
      selectedFile: null,
      metadata: {
        author: "",
        license: { text: "", url: "" },
      },
    },
    propertyFields: emptyPropertyFields(),
    originalPropertyFields: emptyPropertyFields(),
    pendingAddition: emptyAdditionDraft(),
  }));

function emptyRoomEdit() {
  return { coordinate: null, image: null, properties: null };
}

// Hands a field sub-component the live draft narrowed to its own kind, so it can bind variant-only
// fields without re-checking `kind`. A sub-component renders only while its kind is active; the
// empty fallback keeps the type honest for the brief unmount tick after a kind switch.
function useAdditionDraft<K extends AdditionKind>(kind: K): ComputedRef<DraftFor<K>> {
  const editProposal = useEditProposal();
  return computed(() => {
    const draft = editProposal.value.pendingAddition;
    return draft.kind === kind ? (draft as DraftFor<K>) : additionVariants[kind].empty();
  });
}

export type { PropertyFields };
export { emptyPropertyFields, emptyRoomEdit, useAdditionDraft };
