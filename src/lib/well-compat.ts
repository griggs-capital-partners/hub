type WellLike = {
  id: string;
  name: string;
  address?: string | null;
  status: string;
  priority?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt: Date;
};

type ContactLike = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type DocumentLike = {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
  uploader?: { name: string | null; email: string; image: string | null };
};

type NoteLike = {
  id: string;
  type: string;
  body: string;
  createdAt: Date;
  author?: { id: string; name: string | null; displayName: string | null; image: string | null };
};

export function mapWellStatusToCustomerStatus(status: string, priority?: string | null) {
  if (status === "inactive") return "inactive";
  if (status === "plugged") return "inactive";
  if (priority === "critical" || priority === "high") return "at-risk";
  return "active";
}

export function mapWellPriorityToTier(priority?: string | null) {
  if (priority === "critical") return "enterprise";
  if (priority === "high") return "enterprise";
  if (priority === "low") return "startup";
  return "standard";
}

export function mapWellPriorityToHealthScore(priority?: string | null) {
  if (priority === "critical") return 1;
  if (priority === "high") return 2;
  if (priority === "low") return 4;
  return 3;
}

export function mapWellToCustomerRef(well: Pick<WellLike, "id" | "name" | "status" | "priority">) {
  return {
    id: well.id,
    name: well.name,
    logoUrl: null,
    status: mapWellStatusToCustomerStatus(well.status, well.priority),
  };
}

export function mapWellToCustomerSummary(
  well: WellLike & {
    contacts: ContactLike[];
    documents: Array<Pick<DocumentLike, "id">>;
    noteItems: Array<Pick<NoteLike, "id">>;
  }
) {
  return {
    id: well.id,
    name: well.name,
    logoUrl: null,
    website: null,
    status: mapWellStatusToCustomerStatus(well.status, well.priority),
    healthScore: mapWellPriorityToHealthScore(well.priority),
    tier: mapWellPriorityToTier(well.priority),
    industry: well.address ?? null,
    notes: well.notes ?? null,
    updatedAt: well.updatedAt,
    contacts: well.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title ?? null,
      isPrimary: contact.isPrimary,
    })),
    documents: well.documents,
    noteItems: well.noteItems,
  };
}

export function mapWellToCustomerDetail(
  well: WellLike & {
    contacts: ContactLike[];
    documents: DocumentLike[];
    noteItems: NoteLike[];
  }
) {
  return {
    id: well.id,
    name: well.name,
    logoUrl: null,
    website: null,
    productionUrls: "[]",
    status: mapWellStatusToCustomerStatus(well.status, well.priority),
    healthScore: mapWellPriorityToHealthScore(well.priority),
    tier: mapWellPriorityToTier(well.priority),
    industry: well.address ?? null,
    notes: well.notes ?? null,
    createdAt: well.createdAt ?? well.updatedAt,
    updatedAt: well.updatedAt,
    contacts: well.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      title: contact.title ?? null,
      isPrimary: contact.isPrimary,
      notes: contact.notes ?? null,
      createdAt: contact.createdAt ?? well.updatedAt,
      updatedAt: contact.updatedAt ?? well.updatedAt,
    })),
    documents: well.documents.map((doc) => ({
      ...doc,
      uploader: doc.uploader ?? { name: null, email: "", image: null },
    })),
    noteItems: well.noteItems.map((note) => ({
      ...note,
      author: note.author ?? { id: "", name: null, displayName: null, image: null },
    })),
  };
}

export function mapWellToWeeklyCustomerSnap(well: Pick<WellLike, "id" | "name" | "status" | "priority"> | null) {
  if (!well) return null;
  return {
    id: well.id,
    name: well.name,
    logoUrl: null,
    healthScore: mapWellPriorityToHealthScore(well.priority),
    tier: mapWellPriorityToTier(well.priority),
    status: mapWellStatusToCustomerStatus(well.status, well.priority),
  };
}
