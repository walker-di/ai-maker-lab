# 📚 Learning Notes: Harness Engineering for AI Agents

## 1. Core Concept: What is a Harness?
In the context of AI, an agent is not just the Large Language Model (LLM). 
**Equation: `AI Agent = Model (LLM) + Harness`**
The "Harness" refers to **everything other than the model itself**. It is the surrounding environment, constraints, and tools that guide the LLM to complete tasks successfully.

### Inner Harness vs. Outer Harness
*   **Inner Harness:** Built directly into the agent by the developers (e.g., Anthropic's system prompts, core orchestration, built-in code search).
*   **Outer Harness:** Configured by the user (e.g., custom instructions in `CLAUDE.md`, linters, hooks, test scripts). *This video focuses heavily on optimizing the Outer Harness.*

## 2. The 5 Roles of a Harness
A well-designed harness manages five critical areas:
1.  **Context Management:** Decides *what* information the model sees and *when*.
2.  **Tool Access:** Controls *what* tools the model is allowed to use.
3.  **Guardrails:** Restricts destructive or unwanted behavior.
4.  **Observability:** Monitors how the model is behaving.
5.  **Feedback Loop:** Determines what the model should do when it fails or encounters an error.

## 3. Why Do We Need a Harness? (Limitations of LLMs alone)
Relying solely on an LLM without a harness leads to common failure patterns:
*   **Context Decay:** Shoving too much information (e.g., millions of tokens) into the prompt reduces the model's accuracy.
*   **Difficulty in Self-Evaluation:** Models struggle to accurately judge if their own output is correct (they suffer from bias and overconfidence).
*   **The "All-at-Once" Trap:** Models try to execute highly complex tasks in a single attempt, which usually leads to collapse.
*   **Premature Victory Declaration:** The model completes a partial step and mistakenly declares the entire task finished.

## 4. Control Mechanisms: Guides vs. Sensors
Harness engineering uses a control matrix based on timing:
*   **Guides (Feedforward / Pre-action):** Prevents errors *before* the agent acts. 
    *   *Examples:* `CLAUDE.md` instructions, strict linters, type checking, blocking destructive bash commands.
*   **Sensors (Feedback / Post-action):** Detects errors *after* the agent acts so it can self-correct.
    *   *Examples:* Automated test execution (e.g., Playwright), formatters, AI code reviews, "LLM-as-a-Judge".

## 5. Context Engineering
This is the evolution of Prompt Engineering. It is the technical skill of deciding **what goes into the context window**. 
*Key Strategies:*
*   **Appropriate Granularity:** Don't give too much or too little detail.
*   **Minimize Tool Output:** Prevent tools from returning massive, unnecessary logs.
*   **Sub-agent Delegation:** Pass specific tasks to separate agents so the main agent's context isn't polluted.
*   **Compaction:** Summarize completed steps.
*   **JIT (Just-In-Time) Context:** Only provide information exactly when the model needs it.

## 6. Implementation Techniques
### A. Hooks (Automation)
Hooks are shell commands that run automatically before or after a tool is used.
*   **PreToolUse:** Prevent dangerous commands (e.g., blocking `rm -rf`).
*   **PostToolUse:** Run formatters (e.g., Prettier) or auto-linters immediately after a file is saved.

### B. Memory (Cross-Session State Management)
Models lose memory between sessions. A harness must persist knowledge.
*   Use a `MEMORY.md` file.
*   Use Git commits and structured logs to track progress.
*   Maintain a JSON "Feature List" to track what is actually complete vs. pending.

### C. Sub-agents & Agent Teams
Instead of one massive agent doing everything, use a team:
*   **Planner / Generator / Evaluator Pattern:** This is highly recommended. 
    *   *Generator:* Writes the code/content.
    *   *Evaluator:* A completely separate agent instance that checks the Generator's work. 
    *   *Why?* Models are bad at self-criticism. Separating the evaluator from the creator dramatically improves quality.

## 7. Anti-Patterns (What NOT to do)
*   🚫 **Overly Restrictive Harness:** Putting too many strict rules kills the LLM's creativity and flexibility.
*   🚫 **No "Completion" Test:** Allowing the agent to say "I'm done" without running an automated End-to-End test.
*   🚫 **Monolithic `AGENTS.md`:** Shoving all instructions, rules, and context into one massive file.
*   🚫 **Outdated Documentation:** Forcing the agent to read docs that no longer match the codebase.

## 8. Step-by-Step: How to Start Building a Harness
1.  **Step 1:** Write a concise `CLAUDE.md` (Keep it under 50 lines; act as a high-level guide).
2.  **Step 2:** Set up basic Linters and Formatters in your project.
3.  **Step 3:** Automate them using Hooks (so the agent doesn't have to manually run them).
4.  **Step 4:** Build a Test Strategy (e.g., using Playwright for browser testing).
5.  **Step 5:** Introduce an Evaluation Loop (Generator -> Evaluator).
6.  **Step 6:** Continuously monitor the agent's failures and tweak the harness to prevent them next time.

---
**Summary Takeaway:** As AI models get smarter, their raw intelligence isn't the only factor in success. The difference between a good AI agent and a great one lies in the **Harness**—how well you design the system that manages its context, tools, and feedback loops.


# 🛠️ Developer Deep Dive: Implementing an AI Agent Harness

To move from "using" an AI agent to "engineering" a harness, developers need to implement structured controls, automated loops, and state management. Here is how to architect those systems.

## 1. Implementing Hooks (Automated Shell Commands)
Hooks are the most powerful way to enforce **Computational Guides** (pre-action) and **Computational Sensors** (post-action). Instead of relying on the LLM to remember to format code or run tests, you automate it at the tool-execution layer.

**Example Implementation (Based on Claude Code Hook Configurations):**

*   **PreToolUse (Guardrail / Blocker):** Intercepts dangerous operations before the LLM executes them.
    ```json
    "PreToolUse":[
      {
        "matcher": "Bash",
        "command": "echo \"$CLAUDE_TOOL_INPUT\" | grep -qE 'rm -rf|--force' && echo '{\"decision\":\"block\"}'"
      }
    ]
    ```
    *Developer Takeaway:* Don't tell the LLM "don't delete files" in the prompt. Intercept the bash tool execution programmatically and block it.

*   **PostToolUse (Auto-Correction / Linter):** Runs immediately after the LLM edits a file.
    ```json
    "PostToolUse":[
      {
        "matcher": "WriteEdit",
        "command": "npx prettier --write \"$CLAUDE_FILE_PATH\""
      }
    ]
    ```
    *Developer Takeaway:* This saves tokens and context window space. The LLM doesn't need to generate perfectly formatted code; the harness handles it deterministically.

## 2. Cross-Session State & Memory Architecture
LLMs are stateless. A robust harness must implement persistent memory via the file system so the agent can retain context across different sessions or when branching into sub-agents.

*   **Structured Feature Lists (`.json`):** Do not track project status in free-text markdown. Have the agent maintain a `feature-list.json`. JSON is deterministic and easy for both the LLM and your code to parse and update (Completed vs. Pending).
*   **Progress Tracking (`claude-progress.txt`):** A dedicated file where the agent leaves a "handover summary" for its future self or for sub-agents.
*   **Metadata in Memory Files:** When creating documentation or memory files (e.g., `MEMORY.md`), use **YAML Frontmatter** to tag files. This allows the harness to programmatically route specific memories to the agent based on the current task.
*   **Git as a Sensor:** Use Git commit messages and logs as a structured history of what the agent has actually accomplished, rather than relying on the agent's internal chat history.

## 3. The 3-Agent "Generator-Evaluator" Pattern
A single agent architecture is cheap and fast, but it fails at complex tasks because **LLMs are terrible at self-critique** (they suffer from "syophancy" and will rubber-stamp their own broken code).

To fix this, developers should architect a 3-Agent Team (Planner -> Generator -> Evaluator):
1.  **Planner:** Analyzes the task, reads the prompt, and creates a strict JSON specification or task list. It does *not* write code.
2.  **Generator:** Takes one task from the Planner and writes the code.
3.  **Evaluator (The Game Changer):** An entirely independent agent/session. 
    *   *Implementation:* Pass the Evaluator *only* the original requirements and the Generator's output. Do not give it the Generator's "thought process."
    *   *Result:* Because it is a fresh context window, the Evaluator can be brutally objective, resulting in concrete feedback ("This UI breaks on mobile" or "You missed this edge case").
    *   *Routing:* If the Evaluator fails the code, route it back to the Generator with the specific feedback. 

## 4. Advanced Context Engineering (JIT & Compaction)
If you dump a whole repository into the context window, the agent will suffer from "Context Decay" (it gets confused by the noise). 

*   **JIT (Just-In-Time) Context:** Provide tools that allow the agent to fetch *only* function signatures or specific file chunks, rather than reading 1,000-line files.
*   **Context Compaction:** Before the context window maxes out, have the agent summarize the conversation history, write the summary to a temporary file, and flush the chat history to start fresh.
*   **MCP (Model Context Protocol) Minimization:** If you are using MCPs to provide tools to the agent, minimize the amount of data those tools return. If a tool returns a massive JSON payload, the LLM's reasoning will degrade.

## 5. Control Matrix: Deterministic vs. Inferential
The video references the "Böckeler Framework," which developers should use to map out their harness:

| | Computational (Deterministic Code) | Inferential (AI / Prompt based) |
| :--- | :--- | :--- |
| **Guides (Before Action)** | Linters, Type Checkers, `PreToolUse` blockers. | `CLAUDE.md` instructions, System Prompts, Coding Guidelines. |
| **Sensors (After Action)** | Unit Tests, Formatters, CI/CD pipelines. | AI Code Review, LLM-as-a-Judge, `UserPromptSubmit` validation. |

*Developer Rule of Thumb:* **Always prefer Computational over Inferential.** If you can solve a problem with a Python script, a Bash hook, or a Linter, do *not* use a prompt to solve it. Save the LLM's tokens and reasoning capacity for actual problem-solving.

## 6. E2E Testing as the Ultimate Sensor
The worst failure mode of an AI agent is the **"Premature Victory Declaration"** (the agent writes the code and says "I'm done!").
*   **Solution:** Integrate browser automation (like Playwright) via an MCP or a shell script. 
*   **Enforcement:** Set a hard rule in the harness: *The agent is not allowed to mark a task as "Complete" unless the E2E test script returns an exit code of `0`.* This forces the agent into a feedback loop where it must debug its own work until it actually functions.


[【全員必見】ハーネスエンジニアリングとは？AIエージェントの必須知識を徹底解説](https://www.youtube.com/watch?v=JvCIgFPgOlk)