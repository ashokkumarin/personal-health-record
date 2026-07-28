import { PrismaClient } from "@prisma/client";
import "dotenv/config";
const prisma = new PrismaClient();
const records = await prisma.medicalRecord.findMany({ where: { thumbnailPath: null } });
for (const r of records) console.log(r.id, r.title, r.filePath);
process.exit(0);
