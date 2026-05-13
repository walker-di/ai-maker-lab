<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import MousePointer2Icon from '@lucide/svelte/icons/mouse-pointer-2';
	import SquareIcon from '@lucide/svelte/icons/square';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import TypeIcon from '@lucide/svelte/icons/type';
	import ImageIcon from '@lucide/svelte/icons/image';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import EraserIcon from '@lucide/svelte/icons/eraser';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import Redo2Icon from '@lucide/svelte/icons/redo-2';
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
	import MaximizeIcon from '@lucide/svelte/icons/maximize';

	interface Props {
		canUndo?: boolean;
		canRedo?: boolean;
		onAddRectangle?: () => void;
		onAddCircle?: () => void;
		onAddText?: () => void;
		onAddImage?: () => void;
		onAddLine?: () => void;
		onDelete?: () => void;
		onClear?: () => void;
		onUndo?: () => void;
		onRedo?: () => void;
		onZoomIn?: () => void;
		onZoomOut?: () => void;
		onZoomReset?: () => void;
	}

	let {
		canUndo = false,
		canRedo = false,
		onAddRectangle,
		onAddCircle,
		onAddText,
		onAddImage,
		onAddLine,
		onDelete,
		onClear,
		onUndo,
		onRedo,
		onZoomIn,
		onZoomOut,
		onZoomReset,
	}: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-1 rounded-md border bg-card p-1.5" role="toolbar" aria-label="Canvas tools">
	<div class="flex items-center gap-0.5 border-r pr-1.5 mr-0.5">
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onAddRectangle} title="Add Rectangle">
			<SquareIcon class="h-4 w-4" />
		</Button>
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onAddCircle} title="Add Circle">
			<CircleIcon class="h-4 w-4" />
		</Button>
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onAddText} title="Add Text">
			<TypeIcon class="h-4 w-4" />
		</Button>
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onAddImage} title="Add Image">
			<ImageIcon class="h-4 w-4" />
		</Button>
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onAddLine} title="Add Line">
			<MinusIcon class="h-4 w-4" />
		</Button>
	</div>

	<div class="flex items-center gap-0.5 border-r pr-1.5 mr-0.5">
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onDelete} title="Delete Selected">
			<Trash2Icon class="h-4 w-4" />
		</Button>
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onClear} title="Clear Canvas">
			<EraserIcon class="h-4 w-4" />
		</Button>
	</div>

	<div class="flex items-center gap-0.5 border-r pr-1.5 mr-0.5">
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onUndo} disabled={!canUndo} title="Undo">
			<Undo2Icon class="h-4 w-4" />
		</Button>
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onRedo} disabled={!canRedo} title="Redo">
			<Redo2Icon class="h-4 w-4" />
		</Button>
	</div>

	<div class="flex items-center gap-0.5">
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onZoomIn} title="Zoom In">
			<ZoomInIcon class="h-4 w-4" />
		</Button>
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onZoomOut} title="Zoom Out">
			<ZoomOutIcon class="h-4 w-4" />
		</Button>
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onZoomReset} title="Reset Zoom">
			<MaximizeIcon class="h-4 w-4" />
		</Button>
	</div>
</div>
