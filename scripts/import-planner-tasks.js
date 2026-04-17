#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require("dotenv").config();

const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const shouldWrite = args.includes("--write");
const workbookPath =
  args.find((arg) => arg !== "--write") || "/Users/bmac/Downloads/SSF Development.xlsx";

const PYTHON_XLSX_TO_JSON = String.raw`
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

path = sys.argv[1]
ns = {
    'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}

with zipfile.ZipFile(path) as z:
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels}
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        sst = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in sst.findall('a:si', ns):
            shared.append(''.join(t.text or '' for t in si.iterfind('.//a:t', ns)))

    def cell_value(cell):
        cell_type = cell.attrib.get('t')
        value = cell.find('a:v', ns)
        inline = cell.find('a:is', ns)
        if cell_type == 's' and value is not None:
            return shared[int(value.text)]
        if cell_type == 'inlineStr' and inline is not None:
            return ''.join(t.text or '' for t in inline.iterfind('.//a:t', ns))
        return value.text if value is not None else None

    sheet = next(s for s in wb.find('a:sheets', ns) if s.attrib['name'] == 'Tasks')
    rel_id = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
    ws = ET.fromstring(z.read('xl/' + rel_map[rel_id]))
    rows = ws.findall('a:sheetData/a:row', ns)
    header = [cell_value(c) for c in rows[0].findall('a:c', ns)]

    records = []
    for row in rows[1:]:
        values = [cell_value(c) for c in row.findall('a:c', ns)]
        if not any(v not in (None, '') for v in values):
            continue
        record = dict(zip(header, values))
        records.append(record)

print(json.dumps(records))
`;

function runPythonParse(path) {
  const result = spawnSync("python3", ["-c", PYTHON_XLSX_TO_JSON, path], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || "Failed to parse workbook");
  }

  return JSON.parse(result.stdout);
}

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseSemicolonList(value) {
  return (value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return new Date(`${yyyy}-${mm}-${dd}T12:00:00.000Z`);
}

function toPriority(value) {
  switch (normalize(value)) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "low":
      return "low";
    default:
      return "medium";
  }
}

function toColumnName(bucketName, progress) {
  const bucket = normalize(bucketName);
  const progressValue = normalize(progress);

  if (bucket === "completed" || bucket === "archived" || progressValue === "completed") {
    return "Done";
  }
  if (bucket === "in development" || progressValue === "in progress") {
    return "In Progress";
  }
  if (bucket === "testing" || bucket === "customer reply") {
    return "In Review";
  }
  return "Backlog";
}

function chooseRepoName(labels, title, description) {
  const labelSet = new Set(labels.map(normalize));
  const text = `${title || ""}\n${description || ""}`;
  const normalizedText = normalize(text);
  const titleText = title || "";

  if (labelSet.has("portal")) return "portal";
  if (labelSet.has("app")) return "mobile-app";
  if (labelSet.has("intergration")) return "Intergrations";
  if (labelSet.has("backend")) return "data-service";

  if (/\b(bin sentry|maximus|ap refresh|integration|intergration|fas)\b/i.test(text)) {
    return "Intergrations";
  }

  if (
    /\b(data service|data-service|queue|queuing|task engine|sync .* db|logic migration to service|service migration|inventory transaction|notification time)\b/i.test(
      text,
    )
  ) {
    return "data-service";
  }

  if (
    /\b(portal|lot|room|site|dashboard|graph|login|password|user|calendar|treatment|mortality|inventory|startup|start up|overview|invite management)\b/i.test(
      normalizedText,
    )
  ) {
    return "portal";
  }

  if (/\b(app|mobile|release\s+\d+\.\d+)\b/i.test(titleText)) {
    return "mobile-app";
  }

  if (/\b(mqtt|broker)\b/i.test(text)) {
    return "mqtt_portal";
  }

  return "portal";
}

function buildBody(record) {
  const description = (record["Description"] || "").trim();
  const metadata = [
    "Imported from Microsoft Teams Planner",
    `Planner Task ID: ${record["Task ID"] || "unknown"}`,
    `Original Bucket: ${record["Bucket Name"] || "Unknown"}`,
    `Original Progress: ${record["Progress"] || "Unknown"}`,
    record["Created Date"] ? `Created Date: ${record["Created Date"]}` : null,
    record["Start date"] ? `Start Date: ${record["Start date"]}` : null,
    record["Due date"] ? `Due Date: ${record["Due date"]}` : null,
    record["Completed Date"] ? `Completed Date: ${record["Completed Date"]}` : null,
    record["Assigned To"] ? `Assigned To: ${record["Assigned To"]}` : null,
    record["Labels"] ? `Planner Labels: ${record["Labels"]}` : null,
  ].filter(Boolean);

  if (description) {
    return `${description}\n\n---\n${metadata.join("\n")}`;
  }

  return metadata.join("\n");
}

async function main() {
  const rawRecords = runPythonParse(workbookPath);

  const [users, customers, boards, existingCards] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, displayName: true, email: true },
    }),
    prisma.customer.findMany({
      select: { id: true, name: true },
    }),
    prisma.kanbanBoard.findMany({
      select: {
        id: true,
        repo: { select: { id: true, name: true } },
        columns: { select: { id: true, name: true, position: true } },
      },
    }),
    prisma.kanbanCard.findMany({
      select: { id: true, title: true, body: true, columnId: true, position: true },
    }),
  ]);

  const userByName = new Map();
  for (const user of users) {
    for (const alias of [user.displayName, user.name, user.email]) {
      const key = normalize(alias);
      if (key) userByName.set(key, user);
    }
  }

  const customerByName = new Map(customers.map((customer) => [normalize(customer.name), customer]));
  const boardByRepoName = new Map(boards.map((board) => [board.repo.name, board]));

  const existingByPlannerId = new Map();
  const existingTitleSet = new Set();
  for (const card of existingCards) {
    existingTitleSet.add(normalize(card.title));
    const match = card.body?.match(/Planner Task ID:\s*(.+)/);
    if (match) existingByPlannerId.set(match[1].trim(), card);
  }

  const nextPositionByColumnId = new Map();
  for (const card of existingCards) {
    nextPositionByColumnId.set(card.columnId, Math.max(nextPositionByColumnId.get(card.columnId) ?? -1, card.position));
  }

  const planned = [];
  const skipped = [];
  const unmatchedAssignees = new Set();
  const unmatchedCustomers = new Set();

  for (const record of rawRecords) {
    const title = (record["Task Name"] || "").trim();
    const plannerTaskId = String(record["Task ID"] || "").trim();
    const labels = parseSemicolonList(record["Labels"]);
    const assigneeNames = parseSemicolonList(record["Assigned To"]);

    if (!title) {
      skipped.push({ reason: "missing-title", plannerTaskId });
      continue;
    }

    if (plannerTaskId && existingByPlannerId.has(plannerTaskId)) {
      skipped.push({ reason: "already-imported", title, plannerTaskId });
      continue;
    }

    if (existingTitleSet.has(normalize(title))) {
      skipped.push({ reason: "duplicate-title", title, plannerTaskId });
      continue;
    }

    const repoName = chooseRepoName(labels, title, record["Description"]);
    const board = boardByRepoName.get(repoName);
    const columnName = toColumnName(record["Bucket Name"], record["Progress"]);
    const column = board?.columns.find((item) => item.name === columnName);

    if (!board || !column) {
      skipped.push({ reason: "missing-board-or-column", title, plannerTaskId, repoName, columnName });
      continue;
    }

    const assigneeIds = [];
    for (const assigneeName of assigneeNames) {
      const user = userByName.get(normalize(assigneeName));
      if (user) {
        assigneeIds.push(user.id);
      } else {
        unmatchedAssignees.add(assigneeName);
      }
    }

    const customerIds = [];
    for (const label of labels) {
      const customer = customerByName.get(normalize(label));
      if (customer) {
        customerIds.push(customer.id);
      }
    }

    for (const label of labels) {
      const isKnownCustomer = customerByName.has(normalize(label));
      const isSpecial = ["portal", "app", "backend", "intergration", "all clients"].includes(normalize(label));
      if (!isKnownCustomer && !isSpecial) {
        unmatchedCustomers.add(label);
      }
    }

    const currentMaxPosition = nextPositionByColumnId.get(column.id) ?? -1;
    const nextPosition = currentMaxPosition + 1;
    nextPositionByColumnId.set(column.id, nextPosition);

    planned.push({
      plannerTaskId,
      title,
      repoName,
      columnName,
      columnId: column.id,
      priority: toPriority(record["Priority"]),
      labels,
      assigneeIds,
      customerIds: [...new Set(customerIds)],
      body: buildBody(record),
      createdAt: parseDate(record["Created Date"]),
      position: nextPosition,
    });
  }

  const summary = {
    workbookPath,
    mode: shouldWrite ? "write" : "dry-run",
    totalPlannerTasks: rawRecords.length,
    toCreate: planned.length,
    skipped: skipped.length,
    skippedBreakdown: skipped.reduce((acc, item) => {
      acc[item.reason] = (acc[item.reason] || 0) + 1;
      return acc;
    }, {}),
    repoBreakdown: planned.reduce((acc, item) => {
      acc[item.repoName] = (acc[item.repoName] || 0) + 1;
      return acc;
    }, {}),
    columnBreakdown: planned.reduce((acc, item) => {
      acc[item.columnName] = (acc[item.columnName] || 0) + 1;
      return acc;
    }, {}),
    unmatchedAssignees: [...unmatchedAssignees],
    sampleSkips: skipped.slice(0, 10),
  };

  if (!shouldWrite) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const created = [];
  for (const item of planned) {
    const card = await prisma.kanbanCard.create({
      data: {
        columnId: item.columnId,
        title: item.title,
        body: item.body,
        labels: JSON.stringify(item.labels),
        assignees: JSON.stringify(item.assigneeIds),
        priority: item.priority,
        position: item.position,
        ...(item.createdAt ? { createdAt: item.createdAt } : {}),
        ...(item.customerIds.length
          ? {
              customers: {
                connect: item.customerIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      select: { id: true, title: true },
    });
    created.push(card);
  }

  console.log(
    JSON.stringify(
      {
        ...summary,
        createdCount: created.length,
        createdSample: created.slice(0, 10),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
