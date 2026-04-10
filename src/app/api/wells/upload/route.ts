import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(request: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const wellId = formData.get("wellId") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const typeMap: Record<string, string> = {
    pdf: "pdf", txt: "text", md: "text",
    mp3: "audio", mp4: "audio", wav: "audio", m4a: "audio",
    jpg: "image", jpeg: "image", png: "image", webp: "image",
    doc: "document", docx: "document",
  };
  const fileType = typeMap[ext] ?? "other";

  const uploadsDir = join(process.cwd(), "uploads", session.user.id);
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = join(uploadsDir, filename);
  await writeFile(filePath, buffer);

  const doc = await prisma.wellDocument.create({
    data: {
      wellId: wellId || null,
      uploadedBy: session.user.id,
      filename: file.name,
      fileType,
      fileSize: file.size,
      storagePath: filePath,
      tags: "[]",
    },
  });

  return NextResponse.json({ doc });
}
