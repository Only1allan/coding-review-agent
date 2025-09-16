import { tool } from "ai";
import { simpleGit } from "simple-git";
import { z } from "zod";
import { writeFileSync } from "fs";

const excludeFiles = ["dist", "bun.lock"];

const fileChange = z.object({
  rootDir: z.string().min(1).describe("The root directory"),
});

const commitMessageGeneration = z.object({
  rootDir: z.string().min(1).describe("The root directory"),
  commitType: z
    .enum(["feat", "fix", "docs", "style", "refactor", "test", "chore"])
    .optional()
    .describe("The type of commit (conventional commits format)"),
});

const markdownGeneration = z.object({
  filePath: z.string().min(1).describe("The file path where to save the markdown file"),
  content: z.string().min(1).describe("The content to write to the markdown file"),
  fileName: z.string().min(1).describe("The name of the markdown file"),
});

type FileChange = z.infer<typeof fileChange>;
type CommitMessageGeneration = z.infer<typeof commitMessageGeneration>;
type MarkdownGeneration = z.infer<typeof markdownGeneration>;

async function getFileChangesInDirectory({ rootDir }: FileChange) {
  const git = simpleGit(rootDir);
  const summary = await git.diffSummary();
  const diffs: { file: string; diff: string }[] = [];

  for (const file of summary.files) {
    if (excludeFiles.includes(file.file)) continue;
    const diff = await git.diff(["--", file.file]);
    diffs.push({ file: file.file, diff });
  }

  return diffs;
}

async function generateCommitMessage({ rootDir, commitType }: CommitMessageGeneration) {
  const git = simpleGit(rootDir);
  const summary = await git.diffSummary();
  const status = await git.status();
  
  // Get the staged changes
  const stagedFiles = status.staged;
  const modifiedFiles = status.modified;
  const newFiles = status.created;
  const deletedFiles = status.deleted;
  
  // Analyze the changes to determine the commit type if not provided
  let inferredType = commitType;
  if (!inferredType) {
    if (newFiles.length > 0) {
      inferredType = "feat";
    } else if (deletedFiles.length > 0) {
      inferredType = "chore";
    } else if (modifiedFiles.some(file => file.includes("test") || file.includes("spec"))) {
      inferredType = "test";
    } else if (modifiedFiles.some(file => file.includes("README") || file.includes(".md"))) {
      inferredType = "docs";
    } else {
      inferredType = "fix";
    }
  }
  
  // Get a brief diff to understand the changes
  const diffSummary = await git.diff(["--stat"]);
  
  // Generate commit message components
  const filesChanged = summary.files.length;
  const insertions = summary.insertions;
  const deletions = summary.deletions;
  
  // Create a descriptive commit message
  let scope = "";
  const mainFiles = summary.files.slice(0, 3); // Focus on first 3 files
  if (mainFiles.length === 1 && mainFiles[0]) {
    const fileParts = mainFiles[0].file.split("/");
    const fileName = fileParts[fileParts.length - 1]?.split(".")[0];
    if (fileName) scope = `(${fileName})`;
  } else if (mainFiles.every(f => f.file.includes("test"))) {
    scope = "(tests)";
  } else if (mainFiles.every(f => f.file.includes("doc") || f.file.includes("README"))) {
    scope = "(docs)";
  }
  
  const shortDescription = generateShortDescription(inferredType, mainFiles, { insertions, deletions, filesChanged });
  
  const commitMessage = `${inferredType}${scope}: ${shortDescription}

Changes:
- ${filesChanged} file(s) modified
- +${insertions} insertions, -${deletions} deletions

Files changed:
${summary.files.slice(0, 5).map(f => `- ${f.file}`).join('\n')}${summary.files.length > 5 ? `\n- ... and ${summary.files.length - 5} more` : ''}`;

  return {
    commitMessage,
    type: inferredType,
    filesChanged,
    insertions,
    deletions,
    summary: diffSummary
  };
}

function generateShortDescription(type: string, files: any[], stats: { insertions: number; deletions: number; filesChanged: number }) {
  const fileNames = files.map(f => f.file.split("/").pop()?.split(".")[0]).filter(Boolean);
  
  switch (type) {
    case "feat":
      return `add new functionality to ${fileNames.join(", ") || "codebase"}`;
    case "fix":
      return `resolve issues in ${fileNames.join(", ") || "codebase"}`;
    case "docs":
      return `update documentation for ${fileNames.join(", ") || "project"}`;
    case "style":
      return `improve code formatting and style`;
    case "refactor":
      return `restructure ${fileNames.join(", ") || "code"} without changing functionality`;
    case "test":
      return `add or update tests for ${fileNames.join(", ") || "codebase"}`;
    case "chore":
      return `maintain ${fileNames.join(", ") || "codebase"} and dependencies`;
    default:
      return `update ${fileNames.join(", ") || "codebase"}`;
  }
}

async function writeToMarkdownFile({ filePath, content, fileName }: MarkdownGeneration) {
  try {
    const fullPath = `${filePath}/${fileName}.md`;
    const markdownContent = `# Code Review Report

Generated on: ${new Date().toLocaleString()}

---

${content}

---

*Generated by Code Review Agent*
`;

    writeFileSync(fullPath, markdownContent, "utf8");
    
    return {
      success: true,
      filePath: fullPath,
      message: `Markdown file successfully written to ${fullPath}`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      message: "Failed to write markdown file"
    };
  }
}

// Export the functions for direct testing
export { getFileChangesInDirectory, generateCommitMessage, writeToMarkdownFile };

export const getFileChangesInDirectoryTool = tool({
  description: "Gets the code changes made in given directory",
  inputSchema: fileChange,
  execute: getFileChangesInDirectory,
});

export const generateCommitMessageTool = tool({
  description: "Generates a conventional commit message based on git changes in the directory",
  inputSchema: commitMessageGeneration,
  execute: generateCommitMessage,
});

export const writeToMarkdownFileTool = tool({
  description: "Writes content to a markdown file with proper formatting",
  inputSchema: markdownGeneration,
  execute: writeToMarkdownFile,
});