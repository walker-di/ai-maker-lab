<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { TodoInput, TodoItem } from 'ui/source';
  import { createTodoPage } from './todo-page.composition.ts';

  const model = createTodoPage();
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
    onAdd={(value: string) => void model.add(value)}
  />

  {#if model.errorMessage}
    <p class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700">
      {model.errorMessage}
    </p>
  {/if}

  {#if model.hasTodos}
    <div class="space-y-3">
      {#each model.todos as todo (todo.id)}
        <TodoItem
          label={todo.title}
          completed={todo.completed}
          removeLabel={m.todo_remove_label()}
          onToggle={() => void model.toggle(todo.id)}
          onRemove={() => void model.remove(todo.id)}
        />
      {/each}
    </div>
  {:else if !model.isLoading && model.hasLoaded}
    <p
      class="text-muted-foreground bg-muted/40 border-border rounded-2xl border border-dashed px-5 py-8 text-center"
    >
      {m.todo_empty_state()}
    </p>
  {:else}
    <div class="text-muted-foreground bg-muted/20 border-border/60 rounded-2xl border border-dashed px-5 py-8 text-center text-sm">
      Loading todos...
    </div>
  {/if}
</div>
