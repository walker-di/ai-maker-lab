


Here are comprehensive learning notes translated and structured from the video about **Harness Engineering for AI Coding Agents**.

---

# 📚 Learning Notes: Harness Engineering for AI Coding Agents

## 🎯 Core Concept: The Horse Analogy
When using AI coding agents (like Claude Code), they often make mistakes: editing wrong files, breaking code styles, or ignoring instructions. Many developers think, *"I'll just wait for the next model (GPT-5, Claude 4) to fix this."* 
**The Reality:** An AI model is like an Olympic-level racehorse. No matter how strong or fast the horse is, without a harness and reins, it will run wild. **You cannot control the model's evolution, but you can control the harness.**

### The Fundamental Equation
> **Agent = Model + Harness**
*   **Model (The Horse):** The pure AI (Claude, GPT-4). You cannot control its capabilities or when it gets updated.
*   **Harness (The Reins):** The system that controls and guides the AI. You have 100% control over this. It includes `CLAUDE.md` files, linters, test suites, and CI/CD pipelines.

---

## 🛠️ The Two Pillars of Control: Feedforward & Feedback
To prevent the AI from going rogue, you must use a combination of prevention and correction. **Both are required.**

1.  **Feedforward (Preventative / Steering):** 
    *   Giving instructions *before* the AI writes code.
    *   **Examples:** `CLAUDE.md` files, system prompts, architecture guidelines.
    *   *Flaw if used alone:* The AI might simply ignore the instructions, and without checks, you won't realize it until it's too late.
2.  **Feedback (Corrective / Pulling the Reins):** 
    *   Catching mistakes *after* the AI writes code.
    *   **Examples:** ESLint, TypeScript type checkers, unit tests (Jest).
    *   *Flaw if used alone:* The AI will make the same mistakes repeatedly, get yelled at by the linter, and get stuck in an infinite error loop.

---

## ⚙️ How to Check AI Code: Computational vs. Inferential
When building your harness, prioritize deterministic checks over subjective ones.

*   **Computational Checks (Prioritize these):** Mechanical, deterministic, fast (milliseconds), cheap, and 100% accurate. 
    *   *Examples:* Syntax errors, Type errors (TypeScript), Linting rules.
*   **Inferential Checks (Use sparingly):** Probabilistic, slow, expensive, and require context or "understanding."
    *   *Examples:* AI code reviews, evaluating if a design will scale, checking business logic. AI can hallucinate these checks.

---

## 📐 The 3 Levels of Harness Restrictions
You should implement harness rules in phases, from easiest to hardest:

1.  **Maintainability (Easiest):** Complexity checks, code styles, test coverage. Easily automated with existing tools (Linters, SonarQube).
2.  **Architecture Fitness (Medium):** Enforcing dependency directions and layer boundaries (e.g., "UI layer cannot access the Database directly"). Can be automated but requires setup.
3.  **Behavior (Hardest):** Does the code actually do what the user wants? Requires high-level functional testing, E2E testing, and human verification. *Start with maintainability first.*

---

## 🏗️ "Harnessability" (Is your code AI-Friendly?)
Not all codebases are equal for AI agents. 
*   **High Harnessability:** Strongly typed languages (TypeScript, Rust, Go), strict linters, high test coverage. *AI thrives here because it gets instant, accurate feedback.*
*   **Low Harnessability:** Vanilla JavaScript (no types), legacy code, spaghetti architecture, no tests. *AI fails here because there are no "guardrails" to tell it when it messed up.*

**Key Mindset Shift:** Don't expect the AI to adapt to a messy codebase. Instead, refactor your codebase to make it an easy environment for the AI to work in.

---

## 🔄 The Steering Loop (Continuous Improvement)
Harness Engineering is not a one-time setup. It requires a Continuous Loop:
1.  **Identify:** Notice a mistake the AI keeps making.
2.  **Update Harness:** Add a rule, guideline, or test to prevent it.
3.  **Generate:** Let the AI try again.
4.  **Repeat.**

*💡 Meta-Trick:* You can **use the AI to build its own harness!** If the AI makes a mistake, ask it: *"Write an ESLint custom rule to prevent this mistake in the future."*

---

## 🧑‍💻 The Value of the Human Engineer in the AI Era
If AI writes the code and checks the code, what does the human do? Humans provide **4 irreplaceable values**:
1.  **Tacit Knowledge:** Knowing the undocumented history ("We don't use that library because it caused a production outage last year").
2.  **Organizational Alignment:** Prioritizing tasks based on business goals (e.g., "Skip refactoring for now, we just need a hotfix to release today").
3.  **Accountability:** If the system breaks, the human takes the responsibility, not the AI.
4.  **Aesthetic/Contextual Judgment:** Knowing *when* to accept technical debt or when to refactor.

**Summary:** The AI does the labor; the human designs the constraints and makes the critical judgments.

---

## 🚀 Actionable Checklist (What to do tomorrow)

1.  [ ] **Flesh out your `CLAUDE.md` (or equivalent):** Explicitly write down team-specific rules, architectural boundaries, and "things NOT to do." Turn tacit knowledge into explicit text.
2.  [ ] **Strictify your Linters & Types:** Turn on TypeScript `strict: true`, strict null checks, and comprehensive ESLint rules. Make the boundaries mechanical.
3.  [ ] **Start a Weekly AI Mistake Review:** Keep a 3-column log: *What did the AI do wrong? -> What did we do to fix it? -> Did the harness fix work?*
4.  [ ] **Design for Testability:** Write pure functions and inject dependencies so the AI has an easier time writing tests for its own code.

---

# 💻 Developer’s Deep Dive: Implementing AI Harness Engineering

As a developer, your job is shifting from *writing the syntax* to *designing the constraints*. Here is how you technically implement a highly effective "Harness" for AI coding agents like Claude Code, Cursor, or Copilot Workspace.

## 1. Structuring Your "Feedforward" Context (`CLAUDE.md` / `.cursorrules`)
AI models lack implicit project knowledge. Feedforward is about explicitly mapping your mental model into the project root so the AI parses it before generating a single line of code.

**What a highly effective `CLAUDE.md` looks like:**
```markdown
# Project Constraints & Rules

## 1. Tech Stack & Syntax Directives
- **React:** Use Functional Components and Hooks ONLY. `Component` classes are strictly forbidden.
- **Data Fetching:** Do NOT use the native `fetch` API. Always use `axios` imported from `src/lib/apiClient.ts`.
- **Comments:** All inline code comments must be written in Japanese.

## 2. Directory Mapping (Anti-Hallucination)
- `src/components/`: Pure, stateless UI components only.
- `src/hooks/`: Custom React hooks containing business logic.
- `src/api/`: All external API calls. Components must NOT call external endpoints directly.

## 3. Explicit Anti-Patterns (Tacit Knowledge)
- Do NOT use the `moment.js` library; use `date-fns` instead.
- Do not mutate the Redux state directly; always dispatch actions.
```
*   **Developer Value:** By defining the directory structure, you prevent the AI from hallucinating file paths or creating new files in the wrong directories. By defining anti-patterns, you stop it from using outdated libraries it learned from its training data.

## 2. Maximizing "Harnessability" via Strict Feedback Loops
AI agents often have access to your terminal. They will write code, run your build commands, read the terminal output, and self-correct. **If your compiler is forgiving, the AI will write sloppy code.**

### The "Computational" Check Configurations
You want deterministic, machine-enforced rules that execute in milliseconds.

*   **TypeScript Strict Mode:** You must eliminate ambiguity. 
    ```json
    // tsconfig.json - The ultimate AI Harness
    {
      "compilerOptions": {
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "noUncheckedIndexedAccess": true
      }
    }
    ```
    *Why?* If the AI passes a string into a function expecting a number, `tsc` instantly throws an error in the terminal. The AI reads the error and fixes it. Without this, the AI commits the bug.

*   **Linter Enforcement:**
    Don't rely on the AI's "aesthetic judgment" (Inferential checking). Make it Computational. Enable `eslint:recommended` and plugins like `eslint-plugin-import` to mechanically enforce rules. Set cyclomatic complexity limits so the AI is forced to refactor massive functions.

## 3. Designing Code Architecture for AI 
An AI writes better code when the existing codebase is modular and testable. Spaghetti code breaks AI agents because the context window cannot hold the entire tangled application.

*   **Dependency Injection (DI):** 
    Instead of hardcoding database connections or API clients inside functions, pass them as arguments.
    *   *Why it helps the AI:* When you ask the AI to "write a unit test for this function," DI allows the AI to easily generate mock dependencies. If dependencies are tightly coupled, the AI will struggle to write the test and may hallucinate mock files.
*   **Pure Functions & Separation of Side Effects:**
    Keep business logic (pure functions) separate from side effects (API calls, DOM manipulation). 
    *   *Why it helps the AI:* The AI can easily verify pure functions using simple input/output unit tests, giving it instant *Feedback* on whether its logic is correct.

## 4. Architecture Fitness: Enforcing Dependency Directions
The video mentions "Architecture Fitness" (ensuring UI layers don't talk to DB layers directly). For a developer, this shouldn't be a human code review task; it should be automated in the harness.

**Implementation Trick:** Use tools like `eslint-plugin-boundaries` or `dependency-cruiser` in your CI pipeline.
*   Configure a rule: `src/components/**/*.ts` is restricted from importing from `src/database/**/*.ts`.
*   When the AI tries to take a shortcut and imports the DB into a UI button, the linter fails, the AI sees the terminal error, and is forced to route the data through your defined API layer.

## 5. The "Meta-Trick": Using AI to Build the Harness (AST Linting)
When the AI makes a specific, repetitive business-logic mistake that standard TypeScript doesn't catch, don't just fix the code. **Build a custom linter rule.**

Because writing Abstract Syntax Tree (AST) rules for ESLint is notoriously annoying for humans, *use the AI to write the rule.*

**Developer Workflow:**
1.  **Prompt the AI:** *"You keep making a mistake where you use `dangerouslySetInnerHTML` in our React components. Write a custom ESLint plugin using AST nodes that targets `JSXAttribute` to throw an error if the name is `dangerouslySetInnerHTML`. Return a helpful error message telling the developer to use our internal `SafeHTML` component."*
2.  **Add to Harness:** Add this generated rule to your ESLint config.
3.  **Result:** The next time the AI (or a human) tries to use it, the compiler slaps its wrist immediately.

## 6. The "Steering Loop" Agile Workflow
Incorporate Harness Engineering into your weekly Agile/Scrum ceremonies (like Retrospectives).

Create a simple Markdown log (or Jira ticket format):
| AI Mistake (The Bug) | Action Taken (The Harness Update) | Result (Did it work?) |
| :--- | :--- | :--- |
| AI used legacy `.then().catch()` instead of `async/await`. | Added `async/await` strict rule to `CLAUDE.md`. | ✅ AI now uses `async/await`. |
| AI imported test files into production builds. | Added `.test.ts` exclusion to `tsconfig.build.json`. | ✅ Build pipeline no longer breaks. |

### The Developer's New Core Paradigm
**"Do not optimize the code for the AI; optimize the environment so the AI can write optimal code."**

If you have a legacy, untyped Python or JavaScript codebase, *do not* let the AI loose on it yet. Your first task is to use the AI to generate unit tests and add type hints (JSDoc/TypeScript). Only once that "Harness" is in place should you ask the AI to start building new features.


Source:
[【全員必見】ハーネスエンジニアリングとは？AIエージェントの必須知識を徹底解説](https://www.youtube.com/watch?v=JvCIgFPgOlk)