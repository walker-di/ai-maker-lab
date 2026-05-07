# Learning Notes: Designing AI Agent Skills for Consistent Quality

## 💡 The Core Problem
When working with AI agents, a common issue is that **the same request yields inconsistent results depending on the day**. Requirements might be ignored, implementation strategies fluctuate, or validation steps are forgotten. 
*   **The Root Cause:** This happens not just because the AI model is unstable, but because the **"Execution Vessel" (Harness)** supporting the workflow is weak.
*   **Paradigm Shift:** Stop treating AI skills as mere "prompt templates" (focused on clever wording) and start designing them as an **"execution harness"** (a structural workflow with rails and constraints).

---

## 🏗️ 1. The 3-Layer System Architecture
To organize AI execution and prevent the AI from getting confused, structure your system into three layers:
1.  **Command (The Entrance):** Acts as a switch. It takes an ambiguous user request and forces it onto a fixed, standardized workflow (e.g., "Review PR" automatically triggers a Test -> Lint -> Diff -> Review flow).
2.  **Agent (The Role):** Defines the persona (e.g., Implementer vs. Verifier). Assigning clear, separated roles fixes the AI's perspective and prevents it from making biased judgments.
3.  **Skill (The Procedure):** Reusable execution steps. It fixes the decision-making structure and operational flow, ensuring reproducible results.

---

## 🛡️ 2. The Harness Philosophy (Stabilizing Quality)
If your AI's quality is fluctuating, implement these three core principles:

### A. Decoupling (Separating Generation from Evaluation)
*   **The Danger of Self-Validation:** The AI "brain" that just wrote code will almost always approve it. If you ask an AI to write code and then verify it in the same prompt, it will suffer from self-affirmation bias.
*   **The Fix:** Separate the roles. Have a **Generator** agent (optimizes for creativity and changes) and a separate **Evaluator** agent (optimizes for strictness and accuracy).

### B. Context Reset (Context Forking)
*   **The Danger of Long Threads:** The longer a task goes on, the more "dirty context" (logs, failed attempts, previous errors) accumulates, which acts as noise and causes the AI's judgment to drift.
*   **The Fix:** Use a **"Context Fork."** For heavy processing, log reading, or validation, fork the context into a separate thread. Once the task is done, discard the noisy thread and only return the final, clean result to the main thread.

### C. Sprint Contract
*   **Define "Done" First:** Before the AI does any work, establish a strict "Contract" of completion conditions (e.g., 1. Tests must pass, 2. Diff matches the intent, 3. Impact scope is documented).
*   The Evaluator agent only checks against this fixed contract. If the conditions aren't met, the loop breaks or forces a retry.

---

## 🧩 3. The 5 Skill Implementation Patterns
Use these structural patterns to prevent common AI failures:

1.  **Plan-Validate-Execute:** Don't let the AI execute potentially destructive actions immediately. Force it to output a machine-readable plan (e.g., JSON). Validate the plan's schema first, and only then execute it. 
2.  **Generator-Evaluator Loop:** The Generator creates a diff (in a forked context), and the Evaluator checks it using restricted tools. The Evaluator should return very short, specific reasons for failure to keep the retry loop efficient.
3.  **Progressive Disclosure:** Keep standard skill prompts very short. If the AI encounters a specific edge case (e.g., a Database migration), instruct it to read an external `references/` file. This drastically reduces the AI's cognitive load during normal tasks.
4.  **Gotchas-First:** Place known pitfalls and frequent mistakes at the very top of the prompt. If the AI makes a new mistake, add it to this list to prevent future recurrence.
5.  **Orchestration:** Avoid "menu hell" where the AI has too many options and gets confused. Create a single, linear pipeline (Command -> Planner -> Generator -> Evaluator -> Reporter) with only one entrance.

---

## ⚙️ 4. Frontmatter Design (Configuring the Harness)
The settings (frontmatter) of your skills should be configured intentionally across three categories:

*   **Safety & Control:**
    *   `allowed-tools`: Adopt a **"deny by default"** policy. Don't give the AI open access like `bash(*)`. Restrict it to exactly what it needs, e.g., `bash(npm test)` or `bash(git diff)`.
*   **Quality & Response:**
    *   `model` & `effort`: Allocate lighter/faster models for generation loops, and heavier/smarter models for strict evaluation tasks.
    *   `context`: Set to `fork` for any noisy tasks.
    *   `argument-hint`: Strictly define the expected input formats to prevent formatting crashes.
*   **Operations:**
    *   `hooks`: Automate pre-work checks (e.g., checking if on the right git branch) and post-work checks (e.g., running lint) so the AI doesn't have to remember to do them.
    *   `shell`: Explicitly define whether to use bash or powershell to eliminate frustrating syntax errors.

---

## 🚀 5. Practical Guide: How to Start
1.  **Start Small:** Pick a routine task that is frequent but suffers from minor, annoying AI mistakes (e.g., PR final checks, release prep).
2.  **Find the "Judgment Blur":** Look at the logs of failed AI attempts. Identify the exact moment the AI made a poor decision.
3.  **Refactor the Skill:**
    *   Keep the main instructions short.
    *   Put "Gotchas" (known failures) at the top.
    *   Move edge cases into external reference files.
    *   Hardcode the validation loop (Test -> Lint -> Diff).
4.  **Iterate:** Run the new skill three times. If the success rate improves and becomes reproducible, you have successfully built a harness.

**🔑 Final Takeaway:** 
Designing reliable AI skills is not about writing "better prose" or begging the AI to be careful. It is about **hardcoding your evaluation criteria** and building a physical system workflow (Decouple, Reset, Contract) that prevents the AI from making erratic choices.


---

# 💻 Developer Implementation Guide: Designing Reliable AI Agents

This guide translates the video's conceptual framework into actionable system design, directory structures, and configuration patterns for developers building autonomous AI workflows.

## 📁 1. Project Directory Structure
To prevent the AI (and the developer) from getting confused, physically separate the concerns into a strict directory structure. Avoid creating a monolithic "God Skill" file.

```text
root/
├── commands/     # Entry points (User UI -> Agent triggers)
│                 # e.g., /pr-review, /db-migrate
├── agents/       # Persona and role definitions (System Prompts)
│                 # e.g., implementer.md, evaluator.md
├── skills/       # Executable logic and standard operating procedures (SOPs)
│                 # e.g., run_tests.md, lint_code.md
└── references/   # Edge cases, specific tech stack docs, safety protocols
                  # e.g., db_migration_safety_checklist.md
```
* **Why this works:** It utilizes **Progressive Disclosure**. The AI only loads files from `references/` when specific conditions are met, keeping the base context window small and reducing hallucination.

## ⚙️ 2. Frontmatter Configuration (The 12 Parameters)
The video emphasizes using a YAML-like frontmatter to control the agent's environment dynamically. Stop relying on natural language prompts to control behavior; use system-level constraints instead.

### Security & Tool Control (Least Privilege)
*   **`allowed-tools`**: Follow a "deny by default" policy.
    *   ❌ *Bad:* `bash(*)` (Allows the AI to run any arbitrary command).
    *   ✅ *Good:* `bash(npm test)`, `bash(git diff --name-only)` (Restricts the AI to exact, safe commands).
*   **`disable-model-invocation`**: Used for admin/routing steps to prevent the LLM from generating unnecessary conversational filler when executing a strict pipeline.

### State & Quality Routing
*   **`context`**: Set this to `fork` for heavy tasks (like reading logs or testing). This spins up an isolated sub-agent, preventing the main thread's memory from being polluted by intermediate errors.
*   **`model`**: Route dynamically based on the task. Use faster/cheaper models for generation, and heavier/smarter models for evaluation.
*   **`effort`**: Defines how hard the AI should try (e.g., number of retries before failing).
*   **`argument-hint`**: Enforces strict input schemas to prevent formatting crashes when passing data between skills.

### Operations & Integration
*   **`agent`**: Binds the skill to a specific persona (e.g., forcing a verification skill to run as the `Evaluator` agent, not the `Generator`).
*   **`hooks`**: Defines Pre-work and Post-work automations (similar to Git Hooks).
    *   *Pre-work:* Verify the correct branch, pull latest code.
    *   *Post-work:* Automatically run linters or unit tests without relying on the AI's "attention span."
*   **`shell`**: Explicitly specify the environment (e.g., `bash` vs. `powershell`) so the AI doesn't crash due to cross-platform syntax errors.
*   **`user-invocable`**: Set to `false` for internal sub-skills. Hide backend mechanics from the end-user to ensure they only enter the pipeline through a single, controlled Command entry point.
*   **`name` & `description`**: Keep names short and unique (e.g., `run_linter`). Descriptions should explicitly state the *trigger condition* (e.g., "Use this right before final PR submission"), rather than a vague summary.

## 🏗️ 3. Implementing the 5 Architecture Patterns

### Pattern 1: Plan-Validate-Execute (JSON Schema Validation)
Never let the AI write and execute destructive commands in one step.
1.  **Plan:** Force the AI to output a plan as structured data (e.g., `plan.json`).
2.  **Validate:** Run a pre-written script (e.g., `validate_plan.py`) to validate the schema and perform static checks (e.g., "Does this plan delete a production DB table?").
3.  **Execute:** Only pass to `apply_plan.py` if validation succeeds. Add a final sanity check (e.g., `smoke_test.py`) after execution.

### Pattern 2: Context Forking (`Main Line` vs `Forked Line`)
Logs are poison to LLM context windows. Long logs cause "judgment drift."
*   **Main Line:** Holds the core objective, high-level rules, and a clean history summary.
*   **Forked Line:** When tests fail, fork the thread. Dump the 1000-line stack trace here. The sub-agent analyzes the trace, generates a fix, tests it, and then *only returns a Boolean (Pass/Fail) and a 1-sentence summary* back to the Main Line. The massive log is discarded.

### Pattern 3: The Generator-Evaluator Loop
Implement a strict while-loop in your agent orchestrator:
*   **Generator Agent:** Modifies code.
*   **Evaluator Agent:** Checks the diff against the "Sprint Contract" (the definition of done).
*   **Crucial Developer Constraint:** Hardcode the Evaluator's response limit. Instruct the Evaluator to return a maximum of **3 bullet points** for why a validation failed. Long conversational feedback breaks the loop and confuses the Generator.

### Pattern 4: Gotchas-First (Error Handling at the Top)
In your `skill.md` files, put frequent failure patterns at the very top of the file, not the bottom.
```markdown
# GOTCHAS (Do not make these mistakes)
1. ALWAYS update the index.ts export when adding a new component.
2. DO NOT use relative paths for asset imports; use absolute paths.
3. If modifying the DB schema, read `references/db_rules.md` first.

# Execution Steps
...
```

### Pattern 5: Orchestration Pipeline
Avoid giving the AI a menu of 10 choices and asking it "what do you want to do?". Build a definitive State Machine pipeline:
`Command (User Input) -> Planner -> Generator -> Evaluator (Loop if Fail) -> Reporter (Output)`

## 🏁 4. The "Sprint Contract" Checklists
When defining a task, don't ask the AI to "do a good job." Pass it a strict, boolean checklist (the Sprint Contract) that must evaluate to `True` before the task is considered done.

**Example Contract:**
*   `[ ]` Unit tests execute without errors.
*   `[ ]` Linter reports 0 errors.
*   `[ ]` Git diff reflects ONLY the requested changes (no unintended formatting changes).
*   `[ ]` Impact scope has been identified and documented.

If any of these evaluate to false, the system automatically kicks the process back to the Generator agent.

## 🚀 How to Start Refactoring Your Agents Today
1.  **Audit Your Logs:** Find the exact step where your agent usually fails or goes off-script.
2.  **Shrink the Prompt:** Move all edge-case instructions out of the main prompt and into a `references/` file triggered by a specific condition.
3.  **Restrict Tools:** Change open-ended `bash` tool access to explicitly whitelisted commands.
4.  **Implement the Evaluator:** Write a secondary prompt whose *only* job is to look at the first agent's output and say "Pass" or "Fail: [Reason]".

Source:
[【徹底解説】Claude Code Skills設計──Anthropicハーネス思想で品質が落ちない書き方](https://www.youtube.com/watch?v=ah_1f5WCklw)