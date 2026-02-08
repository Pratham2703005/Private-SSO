import { spawnSync } from "child_process";

const stages = [
  "test-stage1.ts",
  "test-stage2.ts",
  "test-stage3.ts",
  "test-stage4.ts",
  "test-stage5.ts",
  "test-stage6.ts",
  "test-stage7.ts",
  "test-stage8.ts",
  "test-stage9.ts",
  "test-stage10.ts",
  "test-stage11.ts",
];

function runStage(file: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`🚀 Running: ${file}`);
  console.log("=".repeat(60) + "\n");

  const result = spawnSync("npx", ["tsx", file], {
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.log("\n❌ STOPPED: A stage failed:", file);
    process.exit(result.status ?? 1);
  }

  console.log(`\n✅ Completed: ${file}`);
}

async function main() {
  console.log("\n🧪 Running ALL SSO stage tests in order...\n");

  for (const file of stages) {
    runStage(file);
  }

  console.log("\n🎉 ALL STAGES PASSED ✅");
}

main();
