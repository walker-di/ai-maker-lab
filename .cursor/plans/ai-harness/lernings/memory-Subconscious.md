


Here are structured learning notes based on the video about the "Subconscious" feature for Claude Code.

# Learning Notes: "Subconscious" for Claude Code

## 1. The Problem it Solves
By default, **Claude Code resets its memory whenever a session is closed.** It forgets the project context (tech stack, file structure), user preferences (coding style, language), and previous conversation history. 
While users can write instructions in a `CLAUDE.md` file, manually updating and managing this file becomes tedious and inefficient as the project grows.

## 2. The Core Concept
"Subconscious" acts as an automated memory management system for Claude Code. 
*   **Powered by Letta (formerly MemGPT):** It uses an AI memory platform with academic origins designed to give AI agents long-term memory.
*   **"Sleeptime Agent" Concept:** Similar to how human brains organize memories during sleep, Subconscious processes, organizes, and saves the session's information in the background *after* the user has finished their session.

## 3. Architecture: The 4 Lifecycle Hooks
Subconscious integrates into Claude Code using four specific lifecycle hooks:

1.  **SessionStart (Initialization):**
    *   Runs immediately upon starting Claude Code.
    *   Checks the operating mode.
    *   Fetches or creates a unique Agent ID and Session ID via the Letta API to track the conversation.
    *   Automatically cleans up legacy `CLAUDE.md` files.
2.  **UserPromptSubmit (The Heart of the System):**
    *   Triggers every time the user sends a prompt.
    *   Fetches memory blocks in parallel to maintain speed.
    *   **Crucial step:** It calculates the difference (diff) between the old memory state and the new one. It only injects this *diff* into Claude's `stdout` (terminal output) so Claude can read it without consuming excessive tokens.
3.  **PreToolUse (Mid-Workflow Check):**
    *   Runs just before Claude executes a tool (like a bash command).
    *   Checks if memory changed during a long, ongoing workflow. If there are changes, it quietly injects them as `additionalContext`.
4.  **Stop (Asynchronous Background Processing):**
    *   Triggers when the session is closed.
    *   Sends the entire session transcript to Letta so the AI can analyze what was important and update its memory blocks.
    *   **Non-blocking:** Because this AI analysis takes time, it uses a Node.js `spawnSilentWorker` (a detached child process). This allows the user's terminal to close instantly while the memory processing continues in the background.

## 4. Memory Structure: The 8 Blocks
Instead of dumping everything into a single text file, Subconscious organizes memory into distinct roles (saving tokens and improving accuracy):

*   **`core_directives`:** The agent's core persona and operational guidelines.
*   **`guidance`:** Specific instructions (e.g., "Always use the Result type for error handling").
*   **`project_context`:** Automatically updated information about the project's tech stack (e.g., "This is a Next.js monorepo using Vitest").
*   **`user_preferences`:** Automatically learned user habits (e.g., "Prefers PascalCase," "Wants error messages in Japanese").
*   **`pending_items`:** Unfinished tasks. If a session ends mid-task, this block saves the state and re-injects it next time (e.g., "Continuing from yesterday, 3 tests were failing...").
*   **`self_improvement`:** The AI's meta-cognition. It reflects on its own performance and leaves notes for itself (e.g., "My previous explanation was too long; I should be more concise next time").
*   **`recent_interactions` & Tool info:** Short-term memory of recent chats.
*(Note: Older information is compressed to ensure the memory doesn't exceed token limits).*

## 5. Key Technical Features
*   **Token-Saving Diff Algorithm:** To prevent hitting token limits, Subconscious acts like Git. It compares the previous memory state with the current one and only injects the lines that were `+ added` or `- removed`.
*   **Security Layers for File Reading:** Subconscious can read project files to understand the context. 
    *   **`read-only` (Default/Recommended):** Only allows safe tools like `Read`, `Grep`, and `Glob`.
    *   **`full`:** Allows writing tools (`Bash`, `Edit`), but carries the risk of the AI modifying code unexpectedly.
*   **Fallback Mechanism:** If the API call fails, the system falls back to a locally saved JSON file, ensuring offline functionality or resilience against network instability.

## 6. Setup and Usage
*   **Installation:** Involves getting a free Letta API key, cloning the Subconscious GitHub repository, running a setup script (`setup.sh`), and setting the `LETTA_API_KEY` environment variable.
*   **Operating Modes (`LETTA_MODE`):**
    *   **`whisper` (Default):** Smart, token-efficient mode that only injects memory differences.
    *   **`full`:** Injects all memory blocks completely every time (high token consumption).
    *   **`off`:** Temporarily disables memory injection (useful for debugging or isolating issues).





Here is a deeper, developer-focused technical breakdown of the "Subconscious" system, detailing the architectural decisions, algorithms, and Node.js patterns used under the hood to integrate with Claude Code.

# Developer Deep Dive: Claude Code "Subconscious" Architecture

## 1. Claude Code Hook Integration & Local State
Claude Code provides a Hook system (`.claude/hooks/`) that allows external scripts to execute at specific lifecycle events. Subconscious leverages this, but with custom state management to ensure resilience.
*   **State Mapping:** Because Claude Code sessions can be transient, Subconscious maintains a local state file (e.g., `sessions.json`) mapping Claude's `session_id` to Letta's `conversation_id`.
*   **Offline/Failure Tolerance:** Hook states are persisted locally in JSON format. If the Letta API times out or the network drops, Subconscious can fall back to the last known local state to prevent Claude from crashing or losing context.

## 2. Technical Breakdown of the 4 Hooks

### A. `SessionStart` (Timeout: 5s)
*   **Execution:** Synchronous block.
*   **Bootstrapping:** Checks the `LETTA_MODE` environment variable. If `off`, it gracefully exits. Otherwise, it makes an API call to Letta to fetch the Agent ID and creates a new `conversation_id` for tracking.
*   **Conflict Resolution:** Automatically scans for and deletes legacy `CLAUDE.md` files (if managed by Subconscious) to prevent manual vs. automated memory conflicts.

### B. `UserPromptSubmit` (Timeout: 10s)
*   **Execution:** Synchronous block.
*   **Parallel Fetching:** To minimize latency before Claude generates a response, it runs `fetchAgent` (gets memory blocks) and `fetchAssistantMessages` (gets chat history) concurrently using `Promise.all()`.
*   **Injection:** Uses the Diffing Algorithm (detailed below) to inject only changed context into Claude's `stdout`.

### C. `PreToolUse` (Timeout: 5s)
*   **Execution:** Synchronous block.
*   **Workflow Safety:** Long-running tasks (like a 30-minute refactoring loop) might span multiple context shifts. This hook fires before Claude executes tools (e.g., Bash commands) to check if the background agent updated memory. If `detectChangedBlocks` returns true, it injects the new data as `additionalContext`. If false, it performs a silent exit.

### D. `Stop` (Timeout: 120s)
*   **Execution:** **Asynchronous Background Process.**
*   **The Problem:** Sending the entire session transcript to Letta for LLM-based summarization and memory updating takes time. Waiting for this would block the developer from closing their terminal.
*   **The Node.js Solution:** It uses the standard Node.js "Orphan Process" pattern to detach the background job.
    ```javascript
    const { spawn } = require('child_process');
    
    // Spawns a silent worker that survives the parent's death
    const child = spawn('node',['worker.js'], {
        detached: true,       // Creates a new process group
        stdio: 'ignore'       // Disconnects stdin/stdout/stderr from parent
    });
    
    child.unref(); // Removes the child from the parent's event loop reference count
    ```
    This grants the AI up to 120 seconds to run "sleep time" processing without hanging the user's CLI.

## 3. The Token-Saving "Diff" Algorithm
To prevent context windows from overflowing and consuming excessive tokens, Subconscious uses a Git-like diffing approach for its memory blocks.

*   **Set Operations:** When a block updates, the algorithm converts the old block and the new block into JavaScript `Set` objects by splitting them line-by-line or chunk-by-chunk.
*   **Calculation:**
    *   `Removed Lines = OldLines - NewLines` (Items to remove)
    *   `Added Lines = NewLines - OldLines` (Items to add)
*   **Output Formatting:** It formats the output exactly like a Git diff (e.g., `+ "Added this rule"`, `- "Removed old stack"`) and passes it to Claude via `stdout`. This allows the LLM to patch its own context window dynamically.

## 4. TTY Output Hack (Bypassing the LLM)
Claude Code monitors the standard output (`stdout`) of its hooks to read data and tool results. However, Subconscious sometimes needs to show status messages *to the human developer* (e.g., "Initializing Subconscious...", "Memory Updated") without Claude "reading" it and getting confused by its own logs.
*   **The Fix:** Subconscious writes these specific UI messages directly to `/dev/tty`. This bypasses the standard `stdout` pipe that Claude is capturing, printing the text directly to the user's terminal display.

## 5. Granular Security and Tool Control
Subconscious allows Letta to use tools to read the user's codebase to build `project_context` automatically. This is secured via environment configurations:

*   **`LETTA_SDK_TOOLS`:**
    *   `read-only` (Default): Only grants access to safe, read-centric tools like `Read`, `Grep`, `Glob`, `WebFetch`, and `WebSearch`.
    *   `full`: Grants access to `Bash`, `Edit`, `Write`, and `MultiEdit`. (Use with caution, as the background agent could theoretically modify code while "sleeping").
*   **`SDK_TOOLS_BLOCKED`:** An array/list that allows developers to blacklist specific tools. Even if the mode is `full`, any tool listed here will throw a permission denied error if the AI attempts to invoke it.

## 6. Memory Block Storage Limits
To prevent infinite context growth, the 8 memory blocks have hard character limits. They use "rolling compression"—when a block gets full, the AI is prompted to rewrite and compress the oldest information.
*   `core_directives`: 5000 chars
*   `guidance`: 5000 chars
*   `self_improvement`: 5000 chars
*   `project_context`: 3000 chars
*   `user_preferences`: 3000 chars
*   `pending_items`: 3000 chars


source:
[Claude Code】潜在意識が記憶する！Subconscious徹底解説｜4つのフック・8つのメモリブロック・非同期パターン](https://www.youtube.com/watch?v=cq2ZYMcftfY)