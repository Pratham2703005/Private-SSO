import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  'https://uoqyupqhxtkluadhogin.supabase.co',
  'sb_secret_anFeKxwHWOQjC0w9aqjkBg_4bKBC2TV'
);

function mapPostgresToTS(type: string): string {
  const t = type.toLowerCase();

  if (
    t.includes("char") ||
    t === "text" ||
    t === "uuid" ||
    t.includes("timestamp") ||
    t === "date"
  ) {
    return "string";
  }

  if (
    t === "integer" ||
    t === "int4" ||
    t === "int8" ||
    t === "bigint" ||
    t === "numeric" ||
    t === "double precision"
  ) {
    return "number";
  }

  if (t === "boolean") {
    return "boolean";
  }

  if (t === "json" || t === "jsonb") {
    return "Json";
  }

  if (t === "bytea") {
    return "string"; // hashed values
  }

  return "unknown"; // safer than any
}
async function generate() {
  const { data, error } = await supabase.rpc("export_schema_metadata");

  if (error) {
    console.error(error);
    return;
  }

  let output = `export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];\n\n`;

  output += `export interface Database {\n  public: {\n    Tables: {\n`;

  for (const table of data) {
    output += `      ${table.table_name}: {\n        Row: {\n`;

    for (const col of table.columns) {
      const tsType = mapPostgresToTS(col.data_type);
      const nullable = col.is_nullable === "YES" ? " | null" : "";
      output += `          ${col.column_name}: ${tsType}${nullable};\n`;
    }

    output += `        };\n      };\n`;
  }

  output += `    };\n  };\n}\n`;

  fs.writeFileSync("lib/database.types.ts", output);
  console.log("✅ database.types.ts generated");
}

generate();