### **The Problem: The Failure of Single-Agent Systems in Long Tasks**
When relying on a single AI agent for long-running or complex tasks, failures are common due to structural bottlenecks:
*   **Context Loss:** As the chat history grows, the LLM attempts to summarize the context to survive, causing it to "forget" specific or unusual requirements.
*   **Biased Self-Evaluation:** A single agent acts as both the creator and the evaluator. This leads to creator's bias, where the agent falsely judges its incomplete or buggy code as "done" or "successful."
*   **Premature Completion:** Combining the above issues results in the agent confidently reporting task completion, but upon inspection, the implementation is missing or broken.

### **The Solution: Anthropic-Style Harness Architecture (GAN-inspired)**
To solve the single-agent bottleneck, the video proposes an architecture inspired by Generative Adversarial Networks (GANs). The core idea is to separate the role of "creating" from the role of "evaluating" and put them in opposition.

#### **The 3 Pillars of Harness Design**
1.  **WHAT (Separation):** Separate the agent that makes the code (Generator) from the agent that evaluates it (Evaluator). Establish strict boundaries between their roles.
2.  **HOW (Iteration Loop):** Implement a continuous loop of Generation -> Evaluation -> Feedback -> Regeneration. This iterative process drives the system toward convergence and higher quality.
3.  **WHY (Prevent False Completion):** Using an independent third-party evaluation ensures objectivity and prevents the system from stopping before the work is actually done.

### **Deep Dive into the Architecture Roles**
The architecture is composed of three main roles working in a cycle:

#### **1. Planner (The Entrance)**
*   **Responsibility:** Translates vague user requests into concrete, specific implementation specifications and acceptance criteria.
*   **Action:** For example, instead of passing a vague request like "make a chat," it defines specific conditions like "The message must be reflected in the chat history within 1 second of sending."
*   **Value:** By defining clear acceptance conditions upfront, it prevents the Generator from getting lost or confused.

#### **2. Generator (The Implementer)**
*   **Responsibility:** Generates the code based on the Planner's specifications.
*   **Strategy:** It should focus on small, iterative changes (small diffs) rather than attempting a "big bang" implementation all at once, which is harder to track and debug.
*   **Forbidden Action:** It must not evaluate its own code to determine if it is "complete."

#### **3. Evaluator (The Reviewer & Last Line of Defense)**
*   **Responsibility:** Tests the generated code against the acceptance criteria and provides feedback. It separates checking if something simply "works" from if it is actually "usable" (E2E testing vs. UX testing).
*   **Feedback Mechanism:** Feedback must not be subjective "feelings" (e.g., "It's hard to use"). It must be **reproducible action logs** (e.g., "Clicking the save button does nothing").
*   **Structured Output:** It should output feedback in a structured format (like JSON) detailing: Severity, Reproducible Steps, Expected Behavior, and Actual Behavior. This automatically sets the priority for the Generator's next fix.
*   **Forbidden Action:** The Evaluator must **never** directly fix or rewrite the code. Mixing the evaluator and implementer roles breaks the system.

### **The Iteration Loop in Practice**
*   **Repetition is Key:** A "smart one-shot" prompt is less effective than a system built for "reproducible repetition." A realistic number of iterations to polish a product is between **5 to 15 loops**.
*   **Decreasing Defect Density:** With each loop, the Evaluator's feedback is fed back into the Generator, steadily decreasing the number of bugs and lowering the psychological burden on the team.
*   **Phased Refinement:** Typically, early loops catch broad structural errors, mid-loops solidify functionality, and late loops refine the UX/UI.

### **Cost Optimization and Deployment**
*   **Cost vs. Quality:** A full 3-agent harness is more expensive (e.g., $200 vs. $9 for a single agent) and takes longer. However, a single agent often fails to deliver the core features, making its cost effectively wasted. The cost evaluation must include the loss of undelivered features.
*   **How to Optimize Safely:**
    1.  **Re-evaluate on Model Updates:** When a smarter LLM is released, re-evaluate if all control layers are still necessary.
    2.  **Cut Unnecessary Controls:** Use A/B testing (running the system with and without a specific control layer). If the quality doesn't drop, remove that layer to save costs.
    3.  **Never Cut the Evaluator:** The independent Evaluator is the final safety net and must be preserved to guarantee quality.

### **Actionable Advice for Implementation**
*   **Start Small:** Don't try to build the entire complex system at once. Start with the minimum viable structure: just one **Generator** and one **Evaluator**.
*   **Define Strict Boundaries:** Create clear design documents for your agents detailing their *Responsibilities*, *Permissions*, and *Forbidden Actions*.
*   **Change How You Write Specs:** Move from abstract instructions to concrete acceptance conditions to guide the agents effectively.

---

### **1. Agent Configuration: The "Design Document" Template**
To prevent context leakage and role confusion, each agent in the harness must be explicitly configured with a strict "Design Document" contract. As a developer, you should configure your agent system prompts using these three distinct sections:
*   **Responsibility (What it must do):** Define the input it receives, the specific processing it does, and the exact output format (e.g., "Receive UI requirements, output React code").
*   **Permission (What it is allowed to do):** Use a white-list approach. For example, explicitly grant permission to "Read files," "Execute Bash scripts," or "Write to specific directories."
*   **Forbidden (What it MUST NOT do):** Explicitly blacklist actions to maintain boundaries. 
    *   *For Evaluator:* `[Forbidden] Do not directly modify or fix the source code.`
    *   *For Generator:* `[Forbidden] Do not self-evaluate your own output.`

### **2. The Evaluator Implementation (Testing & Feedback Stack)**
The Evaluator cannot rely on "vibes" or LLM intuition; it must rely on deterministic testing tools.

*   **Testing Tool:** The video explicitly highlights **Playwright** for automated browser interaction.
*   **Mechanics:** Playwright is used to physically instantiate the app, navigate pages, click buttons, input text, and record failures. It also tests edge cases, such as changing the viewport to mobile (e.g., 375px) to ensure critical UI elements (like "Save" buttons) don't get hidden off-screen.
*   **Structured Feedback Format (JSON):** The Evaluator must not return conversational feedback. It should output a strict JSON structure so the system can automatically prioritize tasks for the Generator without LLM confusion. A standard payload should include:
    ```json
    {
      "severity": "High",
      "repro_steps":[
        "1. Open Settings screen",
        "2. Click Save",
        "3. Wait 3 seconds"
      ],
      "expected": "Success message appears and settings are saved.",
      "actual": "No action occurs, network logs show timeout.",
      "priority": 1
    }
    ```

### **3. The 4-Axis Evaluation Framework**
When building the Evaluator's prompt/logic, configure it to score the Generator's work across four specific dimensions to prevent "It technically compiles but looks awful" scenarios:
1.  **Visual Design:** UI consistency, layout balance, typographical hierarchy.
2.  **Originality:** Interaction design, micro-animations, unique UX touches.
3.  **Craftsmanship:** Code quality, error handling, accessibility (ARIA), performance optimization (preventing memory leaks/race conditions).
4.  **Functionality:** Does it pass E2E tests? State management correctness, edge-case handling.
*   *Developer Note:* Always separate "Works" (Functionality) from "Usable" (UX). If the E2E tests pass but the user journey is confusing, the Evaluator must dock points.

### **4. The Generator Stack & Version Control Strategy**
*   **Recommended Tech Stack:** The video demonstrates the Generator operating on a modern, decoupled stack: **React + Vite** for the frontend, and **FastAPI + SQLite** for the backend.
*   **The "Micro-Diff" Strategy:** The Generator must be constrained from attempting "Big Bang Deployments" (submitting massive, multi-file architectural changes all at once). Force the Generator to output small, incremental diffs. Small diffs limit the blast radius if the code breaks, making it much easier for the Evaluator to pinpoint the exact line of failure.

### **5. Planner: Prompt Engineering to Acceptance Criteria**
For the Planner agent, the developer must design a translation layer. 
*   **Abstract Input:** "Make a chat app."
*   **Concrete Output (Acceptance Criteria):** "When a user submits a chat, the message must be reflected in the chat history DOM within 1 second. The network request must not exceed 500ms."
This ensures the Evaluator has a mathematical baseline to test against, rather than subjective interpretation.

### **6. Lifecycle & Optimization (A/B Testing the Harness)**
As underlying foundational LLMs improve (the video references the jump to "Opus 4.6 generation" models), you will need to optimize your architecture to save API costs and token usage.
*   **How to optimize safely:** Do not guess which control layers to remove. When a new LLM drops, temporarily disable a specific constraint layer (e.g., a specific validation prompt or minor review loop) and run an **A/B test**.
*   **The Rule of Pruning:** If the A/B test shows no drop in output quality, delete that layer to save costs and latency. 
*   **The Unbreakable Rule:** No matter how smart the LLM gets, **never remove the independent Evaluator layer**. It is the final quality gatekeeper.


Source:
[【徹底解説】Anthropic式ハーネス設計──GAN発想で長時間実行AIが変わる全貌](https://www.youtube.com/watch?v=p_zxYc2JG8w)