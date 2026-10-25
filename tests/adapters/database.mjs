export const rpc = (...args) => globalThis.__epRouteTest.rpc(...args);
export const repository = {
  read: () => rpc('ep_snapshot'),
  commit: (expected, state, actor, action) => rpc('ep_commit', {
    p_expected: expected,
    p_state: state,
    p_actor: actor,
    p_action: action,
  })
};
