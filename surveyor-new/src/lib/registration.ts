// signUp() signs the new user straight in when email confirmation is off.
// App.tsx would then swap to its logged-in screens before RegisterScreen has
// saved the surveyor row. While this is set, App.tsx ignores auth changes,
// so the new surveyor stays on the Register screen and is sent back to Login.
let registering = false;

export const isRegistering = () => registering;
export const setRegistering = (value: boolean) => { registering = value; };
