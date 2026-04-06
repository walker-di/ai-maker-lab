import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTodoService, toTodoErrorResponse } from '$lib/server/todo-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	const todoService = await getTodoService();
	return json(await todoService.listTodos());
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const todoService = await getTodoService();
		const { title } = await request.json() as { title: string };
		return json(await todoService.createTodo(title));
	} catch (error) {
		return toTodoErrorResponse(error);
	}
};
