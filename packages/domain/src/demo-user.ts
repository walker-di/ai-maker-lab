export interface DemoUser {
  name: string;
  role: 'builder';
}

export function signInDemoUser(name = 'Jane Doe'): DemoUser {
  return {
    name,
    role: 'builder'
  };
}

export function signOutDemoUser(): undefined {
  return undefined;
}
