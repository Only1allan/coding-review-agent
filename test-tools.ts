#!/usr/bin/env bun
import { 
  getFileChangesInDirectory, 
  generateCommitMessage, 
  writeToMarkdownFile 
} from "./tools";

async function testTools() {
  console.log("🧪 Testing Code Review Agent Tools\n");

  const rootDir = "."; // Current directory

  try {
    // Test 1: Get file changes
    console.log("1️⃣ Testing getFileChangesInDirectory...");
    const fileChanges = await getFileChangesInDirectory({ rootDir });
    console.log(`✅ Found ${fileChanges.length} changed files:`);
    fileChanges.forEach(change => {
      console.log(`   📄 ${change.file}`);
    });
    console.log();

    // Test 2: Generate commit message
    console.log("2️⃣ Testing generateCommitMessage...");
    const commitResult = await generateCommitMessage({ rootDir });
    console.log("✅ Generated commit message:");
    console.log("📝 Commit Message:");
    console.log(commitResult.commitMessage);
    console.log();

    // Test 3: Write to markdown
    console.log("3️⃣ Testing writeToMarkdownFile...");
    const testContent = `
## Test Review Report

### Files Analyzed
${fileChanges.map(f => `- ${f.file}`).join('\n')}

### Suggested Commit
\`\`\`
${commitResult.commitMessage}
\`\`\`

### Summary
This is a test of the markdown file generation tool.
    `.trim();

    const markdownResult = await writeToMarkdownFile({
      filePath: ".",
      content: testContent,
      fileName: "test-review"
    });

    if (markdownResult.success) {
      console.log(`✅ Markdown file created: ${markdownResult.filePath}`);
    } else {
      console.log(`❌ Failed to create markdown: ${markdownResult.error}`);
    }

  } catch (error) {
    console.error("❌ Error testing tools:", error);
  }
}

// Run the tests
testTools();