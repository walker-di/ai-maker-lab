<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { TodoInput, TodoItem } from 'ui/source';
  import { createTodoPageModel } from './todo-page.svelte.ts';

  const model = createTodoPageModel();
</script>

<svelte:head>
  <title>{m.todo_page_title()}</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12 lg:px-8">
  <section class="space-y-3">
    <h1 class="text-foreground text-4xl font-semibold tracking-tight">
      {m.todo_page_title()}
    </h1>
    <p class="text-muted-foreground text-lg leading-8">
      {m.todo_page_intro()}
    </p>
  </section>

  <TodoInput
    placeholder={m.todo_input_placeholder()}
    addLabel={m.todo_add_label()}
    onAdd={(value: string) => model.add(value)}
  />

  {#if model.hasTodos}
    <div class="space-y-3">
      {#each model.todos as todo (todo.id)}
        <TodoItem
          label={todo.title}
          completed={todo.completed}
          removeLabel={m.todo_remove_label()}
          onToggle={() => model.toggle(todo.id)}
          onRemove={() => model.remove(todo.id)}
        />
      {/each}
    </div>
  {:else}
    <p
      class="text-muted-foreground bg-muted/40 border-border rounded-2xl border border-dashed px-5 py-8 text-center"
    >
      {m.todo_empty_state()}
    </p>
  {/if}
</div>
