import { signInDemoUser, signOutDemoUser, type DemoUser } from '@ai-maker-lab/domain';

interface CreateShowcasePageModelOptions {
  initialUser?: DemoUser;
}

export function createShowcasePageModel(options: CreateShowcasePageModelOptions = {}) {
  const state = $state<{ user: DemoUser | undefined }>({
    user: options.initialUser
  });

  return {
    state,
    login() {
      state.user = signInDemoUser();
    },
    logout() {
      state.user = signOutDemoUser();
    },
    createAccount() {
      state.user = signInDemoUser();
    }
  };
}
