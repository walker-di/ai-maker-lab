<script lang="ts">
  import { createWorkspaceChecklist } from '@ai-maker-lab/domain';
  import { ShowcasePage } from '@ai-maker-lab/ui';

  const checklist = createWorkspaceChecklist();
</script>

<ShowcasePage {checklist} />
