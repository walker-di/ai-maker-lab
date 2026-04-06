import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTodoService, toTodoErrorResponse } from '$lib/server/todo-service';

export const prerender = false;

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const todoService = await getTodoService();
		return json(await todoService.removeTodo(params.id));
	} catch (error) {
		return toTodoErrorResponse(error);
	}
};
